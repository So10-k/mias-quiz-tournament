// Add 1+ late-arriving players to the live R1 bracket without disturbing
// existing matchups. Pairing rule:
//   - First call → creates a NEW R1 matchup with the player as side A
//     (an "open box"). Downstream R2/R3/R4 placeholders are extended if
//     the new R1 slot would otherwise have nowhere to advance to.
//   - Second call → fills the open box's empty side B (so the two new
//     players play each other).
//   - Third call → creates the next box, and so on.
// Run once per player. Each new player gets a magic-link sign-in email.
//
//   npx tsx scripts/add-player.ts --in jane@x.com --name "Jane"

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, asc, desc, eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Resend } from "resend";
import * as schema from "../db/schema.ts";

const TARGET_ORIGIN =
  process.env.SITE_ORIGIN ?? "https://quiz.miaswebsites.art";

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
  } catch {}
}
loadEnvLocal();

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ env ${name} not set`);
    process.exit(2);
  }
  return v;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i === -1 ? null : args[i + 1] ?? null;
  };
  const inEmail = (get("--in") ?? "").trim().toLowerCase();
  if (!inEmail || !inEmail.includes("@")) {
    console.error("❌ Need --in <email>");
    process.exit(2);
  }
  return {
    inEmail,
    inName: get("--name"),
    yes: args.includes("--yes") || args.includes("-y"),
  };
}

function makeId(): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % 36];
  return out;
}

function hashToken(rawToken: string, secret: string): string {
  return createHash("sha256").update(`${rawToken}${secret}`).digest("hex");
}

async function main() {
  const cfg = parseArgs();
  const dbUrl = need("DATABASE_URL");
  const authSecret = need("AUTH_SECRET");
  const resendKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ||
    "Mia's Quiz Tournament <onboarding@resend.dev>";

  const sql = neon(dbUrl, { fetchOptions: { cache: "no-store" } });
  const db = drizzle(sql, { schema });

  const [tournament] = await db
    .select()
    .from(schema.tournaments)
    .orderBy(desc(schema.tournaments.createdAt))
    .limit(1);
  if (!tournament) {
    console.error("❌ No tournament found.");
    process.exit(1);
  }
  console.log(`Tournament: ${tournament.title}`);

  // ── 1) find/create user ────────────────────────────────────────────────
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, cfg.inEmail))
    .limit(1);
  const isNew = !existing;
  const userId = existing?.id ?? makeId();
  const displayName =
    cfg.inName ?? existing?.name ?? cfg.inEmail.split("@")[0] ?? "Player";

  if (isNew) {
    console.log(`Will create user ${cfg.inEmail} (${displayName})`);
  } else {
    console.log(`User ${cfg.inEmail} already exists (${existing!.id})`);
  }

  // ── 2) inspect current R1 to decide fill vs create ─────────────────────
  const r1 = await db
    .select()
    .from(schema.matchups)
    .where(
      and(
        eq(schema.matchups.tournamentId, tournament.id),
        eq(schema.matchups.roundIndex, 1)
      )
    )
    .orderBy(asc(schema.matchups.slot));

  // Skip the original top-seed BYE (resolved at gen time with winnerUserId
  // set). We only want to fill matchups left empty by a previous run of
  // this script — i.e. has playerA, no playerB, no winner.
  const openMatchup = [...r1]
    .reverse()
    .find(
      (m) =>
        m.playerAUserId &&
        !m.playerBUserId &&
        !m.winnerUserId &&
        !m.resolvedVia
    );

  let plan: "fill" | "create";
  let targetSlot: number;
  if (openMatchup) {
    plan = "fill";
    targetSlot = openMatchup.slot;
  } else {
    plan = "create";
    targetSlot = (r1[r1.length - 1]?.slot ?? -1) + 1;
  }

  console.log(`\nPlan: ${plan === "fill"
    ? `FILL existing R1 slot ${targetSlot} (side B)`
    : `CREATE new R1 slot ${targetSlot} (player as side A)`}`);

  if (!cfg.yes) {
    const rl = createInterface({ input, output });
    const yn = await rl.question("Proceed? (yes/no) > ");
    rl.close();
    if (yn.trim().toLowerCase() !== "yes") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  // ── 3) write user + enrollment ─────────────────────────────────────────
  if (isNew) {
    await db.insert(schema.users).values({
      id: userId,
      email: cfg.inEmail,
      name: displayName,
      role: "reader",
    });
    console.log(`✓ created user ${userId}`);
  } else if (!existing!.name && cfg.inName) {
    await db
      .update(schema.users)
      .set({ name: displayName })
      .where(eq(schema.users.id, userId));
  }
  const [existingEnroll] = await db
    .select()
    .from(schema.enrollments)
    .where(
      and(
        eq(schema.enrollments.userId, userId),
        eq(schema.enrollments.tournamentId, tournament.id)
      )
    )
    .limit(1);
  if (!existingEnroll) {
    await db.insert(schema.enrollments).values({
      id: makeId(),
      userId,
      tournamentId: tournament.id,
      strikeCount: 0,
    });
    console.log(`✓ enrolled in tournament`);
  } else if (existingEnroll.eliminatedAt) {
    await db
      .update(schema.enrollments)
      .set({ eliminatedAt: null, eliminatedInRoundId: null })
      .where(eq(schema.enrollments.id, existingEnroll.id));
    console.log(`✓ un-eliminated existing enrollment`);
  }

  // ── 4) fill or create the R1 matchup ───────────────────────────────────
  if (plan === "fill") {
    await db
      .update(schema.matchups)
      .set({ playerBUserId: userId })
      .where(eq(schema.matchups.id, openMatchup!.id));
    console.log(
      `✓ filled R1 slot ${targetSlot} side B — those two new players play each other`
    );
  } else {
    await db.insert(schema.matchups).values({
      id: makeId(),
      tournamentId: tournament.id,
      roundIndex: 1,
      slot: targetSlot,
      playerAUserId: userId,
      playerBUserId: null,
      winnerUserId: null,
      resolvedVia: null,
      resolvedAt: null,
    });
    console.log(`✓ created R1 slot ${targetSlot} with new player as side A`);

    // Ensure a downstream R2/R3/… placeholder exists for floor(slot/2)
    // up the tree so the winner has somewhere to advance to.
    let curRound = 1;
    let curSlot = targetSlot;
    while (true) {
      const nextRound = curRound + 1;
      const nextSlot = Math.floor(curSlot / 2);
      const [exists] = await db
        .select()
        .from(schema.matchups)
        .where(
          and(
            eq(schema.matchups.tournamentId, tournament.id),
            eq(schema.matchups.roundIndex, nextRound),
            eq(schema.matchups.slot, nextSlot)
          )
        )
        .limit(1);
      if (exists) break; // already there — stop walking up
      await db.insert(schema.matchups).values({
        id: makeId(),
        tournamentId: tournament.id,
        roundIndex: nextRound,
        slot: nextSlot,
        playerAUserId: null,
        playerBUserId: null,
        winnerUserId: null,
        resolvedVia: null,
        resolvedAt: null,
      });
      console.log(`  + extended bracket: added R${nextRound} slot ${nextSlot} placeholder`);
      curRound = nextRound;
      curSlot = nextSlot;
      if (nextSlot === 0 && curRound > 1) {
        // Reached top of bracket; final match exists.
        // (Loop will re-check at next iteration and break.)
      }
      if (curRound > 12) break; // safety
    }
  }

  // ── 5) magic-link sign-in email ────────────────────────────────────────
  const rawToken = randomBytes(24).toString("hex");
  const hashed = hashToken(rawToken, authSecret);
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
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

  if (!resendKey) {
    console.log(
      `\n⚠️  RESEND_API_KEY not set — magic link below (paste into browser):\n   ${magicUrl}\n`
    );
  } else {
    const resend = new Resend(resendKey);
    const subject = "You're in — Mia's Quiz Tournament";
    const text = [
      `Hey ${displayName},`,
      "",
      "You've been added to Mia's Quiz Tournament — sign in below to see the bracket and play your round.",
      "",
      magicUrl,
      "",
      "(Link works once, within 24 hours.)",
      "",
      "— Sam · Mia's Quiz Tournament",
    ].join("\n");
    const html = `<!doctype html><html><body style="background:#B7E5FF;margin:0;padding:32px;font-family:Quicksand,sans-serif;color:#1B2A4E">
      <div style="max-width:560px;margin:0 auto;background:white;padding:36px;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 0 #1B2A4E">
        <p style="font-family:Fredoka,sans-serif;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#E94B7E;font-size:14px;margin:0 0 8px">Welcome to the tournament</p>
        <h1 style="font-family:Fredoka,sans-serif;font-weight:700;font-size:32px;line-height:1.15;margin:0 0 14px;color:#1B2A4E">You're in, ${displayName}! 🎉</h1>
        <p style="font-size:17px;line-height:1.55;margin:0 0 12px">A spot just opened up — tap below to sign in. Works once, within 24 hours.</p>
        <p style="margin:24px 0"><a href="${magicUrl}" style="display:inline-block;padding:14px 26px;background:#FF6B9D;color:white;text-decoration:none;font-family:Fredoka,sans-serif;font-weight:600;font-size:18px;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E">🔮 Sign in to play →</a></p>
        <p style="font-size:13px;color:#3B4A7E;margin:14px 0 0">— Sam · Site administrator · Mia's Quiz Tournament</p>
      </div>
    </body></html>`;
    const { error } = await resend.emails.send({
      from,
      to: cfg.inEmail,
      subject,
      text,
      html,
    });
    if (error) {
      console.error(`❌ Resend failed: ${error.message ?? error}`);
      process.exit(3);
    }
    console.log(`✓ magic-link email sent to ${cfg.inEmail}`);
  }

  console.log("\n✅ Done.");
}

main().catch((e) => {
  console.error("\n❌ Failed:", e);
  process.exit(1);
});
