// Surgically swap one tournament player for another. Use case: Sylvie
// can't participate any more; Jamie was late to sign up. Sylvie's bracket
// slot becomes Jamie's, Sylvie is marked eliminated, Jamie gets an
// account + a magic-link sign-in email. Idempotent-ish — if Jamie's
// already a user we don't clobber them, and re-running with the same
// args is safe (Sylvie stays eliminated, Jamie stays in her slot).
//
// Usage:
//   DATABASE_URL=... AUTH_SECRET=... RESEND_API_KEY=... \
//   EMAIL_FROM='Mia... <onboarding@resend.dev>' \
//     npx tsx scripts/replace-player.ts \
//       --in jamie@example.com \
//       [--name "Jamie"] \
//       [--out sylvie] \
//       [--yes]

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, desc, eq, inArray, ilike } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Resend } from "resend";
import * as schema from "../db/schema.ts";

// Tiny .env.local loader so we don't fight shell quoting on every run.
// (Single-line KEY=VALUE pairs, optionally wrapped in matching quotes.)
function loadEnvLocal() {
  try {
    const text = readFileSync(".env.local", "utf8");
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // No .env.local — that's fine, env may already be exported.
  }
}
loadEnvLocal();

const TARGET_ORIGIN =
  process.env.SITE_ORIGIN ?? "https://quiz.miaswebsites.art";

function parseArgs(): {
  outName: string;
  inEmail: string;
  inName: string | null;
  yes: boolean;
} {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: string | null = null) => {
    const i = args.indexOf(flag);
    if (i === -1) return fallback;
    return args[i + 1] ?? fallback;
  };
  const yes = args.includes("--yes") || args.includes("-y");
  const inEmail = (get("--in") ?? "").trim().toLowerCase();
  if (!inEmail || !inEmail.includes("@")) {
    console.error(
      "❌ Need --in <email> for the incoming player.\n" +
        "   Example: --in jamie@example.com"
    );
    process.exit(2);
  }
  return {
    outName: (get("--out", "sylvie") ?? "sylvie").trim(),
    inEmail,
    inName: get("--name"),
    yes,
  };
}

function require(varName: string): string {
  const v = process.env[varName];
  if (!v) {
    console.error(`❌ env var ${varName} not set`);
    process.exit(2);
  }
  return v;
}

function hashToken(rawToken: string, secret: string): string {
  return createHash("sha256").update(`${rawToken}${secret}`).digest("hex");
}

function makeId(): string {
  // Match the app's 12-char id helper format (0-9 + a-z).
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % 36];
  return out;
}

async function main() {
  const cfg = parseArgs();
  const dbUrl = require("DATABASE_URL");
  const authSecret = require("AUTH_SECRET");
  const resendKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ||
    "Mia's Quiz Tournament <onboarding@resend.dev>";

  const sql = neon(dbUrl, { fetchOptions: { cache: "no-store" } });
  const db = drizzle(sql, { schema });

  // ── 1) Pick the active/latest tournament ───────────────────────────────
  const [tournament] = await db
    .select()
    .from(schema.tournaments)
    .orderBy(desc(schema.tournaments.createdAt))
    .limit(1);
  if (!tournament) {
    console.error("❌ No tournament found in the DB.");
    process.exit(1);
  }
  console.log(
    `\nTournament: ${tournament.title} (${tournament.id}, status=${tournament.status})`
  );

  // ── 2) Find the outgoing player by name within this tournament ─────────
  const candidates = await db
    .select({
      uId: schema.users.id,
      uEmail: schema.users.email,
      uName: schema.users.name,
      eId: schema.enrollments.id,
      eliminatedAt: schema.enrollments.eliminatedAt,
    })
    .from(schema.users)
    .innerJoin(
      schema.enrollments,
      eq(schema.enrollments.userId, schema.users.id)
    )
    .where(
      and(
        eq(schema.enrollments.tournamentId, tournament.id),
        ilike(schema.users.name, `%${cfg.outName}%`)
      )
    );

  if (candidates.length === 0) {
    console.error(
      `❌ No enrolled user matches name like "${cfg.outName}" in this tournament.`
    );
    process.exit(1);
  }
  if (candidates.length > 1) {
    console.error(
      `❌ Multiple enrollees match "${cfg.outName}" — narrow down the --out value.`
    );
    for (const c of candidates) {
      console.error(`   • ${c.uName}  (${c.uEmail})  enrollmentId=${c.eId}`);
    }
    process.exit(1);
  }
  const out = candidates[0];

  // Sylvie's matchups in the bracket — we'll move these to Jamie.
  const allMatchups = await db
    .select()
    .from(schema.matchups)
    .where(eq(schema.matchups.tournamentId, tournament.id));
  const outMatchups = allMatchups.filter(
    (m) =>
      m.playerAUserId === out.uId ||
      m.playerBUserId === out.uId ||
      m.winnerUserId === out.uId
  );

  // ── 3) Find or create the incoming user ─────────────────────────────────
  const [existingIn] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, cfg.inEmail))
    .limit(1);
  const inWillBeNew = !existingIn;
  const inUserId = existingIn?.id ?? makeId();
  const inName =
    cfg.inName ?? existingIn?.name ?? cfg.inEmail.split("@")[0] ?? "Player";

  // ── 4) Confirm preview ─────────────────────────────────────────────────
  console.log("\n--- PLAN ---");
  console.log(
    `OUT: ${out.uName ?? "(no name)"} <${out.uEmail}> (userId=${out.uId})`
  );
  console.log(`     enrollmentId=${out.eId}, eliminated=${!!out.eliminatedAt}`);
  console.log(`     ${outMatchups.length} matchup row(s) reference this user`);
  console.log(
    `IN:  ${inName} <${cfg.inEmail}> (userId=${inUserId}${
      inWillBeNew ? ", NEW" : ", existing"
    })`
  );
  console.log("Steps to execute:");
  console.log(
    `  1. ${inWillBeNew ? "Create" : "Keep existing"} user row for ${cfg.inEmail}`
  );
  console.log("  2. Enroll incoming user in this tournament (if not already)");
  console.log(
    `  3. Rewrite ${outMatchups.length} matchup row(s) — replace ${out.uName} → ${inName}`
  );
  console.log(
    `  4. Mark ${out.uName}'s enrollment as eliminatedAt=now() (so they vanish from "still in" lists)`
  );
  console.log("  5. Insert a verification token + send a magic-link email");
  console.log("");
  if (!cfg.yes) {
    const rl = createInterface({ input, output });
    const yn = await rl.question("Proceed? (yes/no) > ");
    rl.close();
    if (yn.trim().toLowerCase() !== "yes") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  // ── 5) Apply the swap ───────────────────────────────────────────────────
  if (inWillBeNew) {
    await db.insert(schema.users).values({
      id: inUserId,
      email: cfg.inEmail,
      name: inName,
      role: "reader",
    });
    console.log(`✓ created user ${inUserId}`);
  } else {
    // Update display name only if they hadn't picked one yet.
    if (!existingIn?.name && cfg.inName) {
      await db
        .update(schema.users)
        .set({ name: inName })
        .where(eq(schema.users.id, inUserId));
      console.log(`✓ filled in display name for existing user`);
    }
  }

  // Enroll incoming user (idempotent via unique index on (userId, tournamentId)).
  const [existingEnrollIn] = await db
    .select()
    .from(schema.enrollments)
    .where(
      and(
        eq(schema.enrollments.userId, inUserId),
        eq(schema.enrollments.tournamentId, tournament.id)
      )
    )
    .limit(1);
  if (!existingEnrollIn) {
    await db.insert(schema.enrollments).values({
      id: makeId(),
      userId: inUserId,
      tournamentId: tournament.id,
      strikeCount: 0,
    });
    console.log(`✓ enrolled incoming user`);
  } else {
    // Make sure they aren't accidentally marked eliminated.
    if (existingEnrollIn.eliminatedAt) {
      await db
        .update(schema.enrollments)
        .set({ eliminatedAt: null, eliminatedInRoundId: null })
        .where(eq(schema.enrollments.id, existingEnrollIn.id));
    }
    console.log(`✓ incoming user already enrolled (kept as-is)`);
  }

  // Replace outgoing user references in matchups.
  for (const m of outMatchups) {
    const patch: Record<string, string | null> = {};
    if (m.playerAUserId === out.uId) patch.playerAUserId = inUserId;
    if (m.playerBUserId === out.uId) patch.playerBUserId = inUserId;
    if (m.winnerUserId === out.uId) patch.winnerUserId = inUserId;
    if (Object.keys(patch).length > 0) {
      await db
        .update(schema.matchups)
        .set(patch)
        .where(eq(schema.matchups.id, m.id));
    }
  }
  console.log(
    `✓ rewrote ${outMatchups.length} matchup row(s) to reference incoming user`
  );

  // Eliminate the outgoing player.
  await db
    .update(schema.enrollments)
    .set({ eliminatedAt: new Date(), eliminatedInRoundId: null })
    .where(eq(schema.enrollments.id, out.eId));
  console.log(`✓ marked ${out.uName ?? out.uEmail} as eliminated`);

  // ── 6) Mint a magic-link token + send email ───────────────────────────
  const rawToken = randomBytes(24).toString("hex");
  const hashed = hashToken(rawToken, authSecret);
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await db
    .insert(schema.verificationTokens)
    .values({ identifier: cfg.inEmail, token: hashed, expires })
    .onConflictDoNothing();

  const callbackUrl = `${TARGET_ORIGIN}/play`;
  const magicUrl =
    `${TARGET_ORIGIN}/api/auth/callback/email` +
    `?token=${encodeURIComponent(rawToken)}` +
    `&email=${encodeURIComponent(cfg.inEmail)}` +
    `&callbackUrl=${encodeURIComponent(callbackUrl)}`;

  const subject = "You're in — Mia's Quiz Tournament";
  const text = [
    `Hey ${inName},`,
    "",
    "You've been added to Mia's Quiz Tournament — a spot just opened up and you're in.",
    "",
    "Tap the link below to sign in. It works once, within 24 hours.",
    "",
    magicUrl,
    "",
    "Once you're signed in you'll see the bracket, the active round, and your hearts.",
    "",
    "— Sam (admin)",
    "Mia's Quiz Tournament",
  ].join("\n");

  const html = `<!doctype html>
<html><body style="background:#B7E5FF;margin:0;padding:32px;font-family:Quicksand,sans-serif;color:#1B2A4E">
  <div style="max-width:560px;margin:0 auto;background:white;padding:36px;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 0 #1B2A4E">
    <p style="font-family:Fredoka,sans-serif;font-size:14px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#E94B7E;margin:0 0 6px">Welcome to the tournament</p>
    <h1 style="font-family:Fredoka,sans-serif;font-size:32px;font-weight:700;line-height:1.15;margin:0 0 14px;color:#1B2A4E">You're in, ${inName}! 🎉</h1>
    <p style="font-size:17px;line-height:1.55;margin:0 0 12px">A spot just opened up in <strong>Mia&rsquo;s Quiz Tournament</strong> and you&rsquo;ve been added. Tap below to sign in — it works once, within 24 hours.</p>
    <p style="margin:24px 0"><a href="${magicUrl}" style="display:inline-block;padding:14px 26px;background:#FF6B9D;color:white;text-decoration:none;font-family:Fredoka,sans-serif;font-weight:600;font-size:18px;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E">🔮 Sign in to play →</a></p>
    <p style="font-size:13px;line-height:1.5;color:#3B4A7E;margin:20px 0 0">Once you&rsquo;re in you&rsquo;ll see the bracket, the active round, and your hearts.</p>
    <p style="font-size:13px;line-height:1.5;color:#3B4A7E;margin:14px 0 0">If the button doesn&rsquo;t work, paste this URL into your browser:<br/><span style="word-break:break-all;color:#1B2A4E">${magicUrl}</span></p>
    <p style="font-size:13px;line-height:1.5;color:#3B4A7E;margin:24px 0 0">— Sam<br/>Site administrator · Mia&rsquo;s Quiz Tournament</p>
  </div>
</body></html>`;

  if (!resendKey) {
    console.log(
      `\n⚠️  RESEND_API_KEY not set — printing the magic link instead of sending:`
    );
    console.log(`   to: ${cfg.inEmail}`);
    console.log(`   subject: ${subject}`);
    console.log(`   url: ${magicUrl}`);
  } else {
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from,
      to: cfg.inEmail,
      subject,
      text,
      html,
    });
    if (error) {
      console.error(
        `❌ Resend failed: ${error.message ?? String(error)}\n` +
          `   The DB swap is already done — you can resend the magic link by re-running the script with --yes.`
      );
      process.exit(3);
    }
    console.log(`✓ sent magic-link email to ${cfg.inEmail}`);
  }

  console.log("\n✅ Done. Summary:");
  console.log(`   - Removed: ${out.uName} (${out.uEmail})`);
  console.log(`   - Added:   ${inName} (${cfg.inEmail})`);
  console.log(`   - Bracket rows rewritten: ${outMatchups.length}`);
  console.log(`   - Magic link expires: ${expires.toISOString()}`);
}

main().catch((e) => {
  console.error("\n❌ Failed:", e);
  process.exit(1);
});
