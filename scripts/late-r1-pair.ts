// Late-add two players who missed Round 1, drop them into a brand-new
// R1 matchup against each other, give them gated access to a copy of the
// R1 quiz (closed for everyone else), and email each one a sign-in link
// to play it. The clone is linked to the new matchup so only those two
// can load the URL — same gating mechanism as the tiebreaker rounds.
//
//   npx tsx scripts/late-r1-pair.ts \
//     --p1 adrooks@gmail.com --p2 erin.symons25@gmail.com \
//     [--name1 "Adrooks"] [--name2 "Erin"] \
//     [--deadline "2026-05-01T23:59"]   (defaults to tomorrow midnight)

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, asc, desc, eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import * as schema from "../db/schema.ts";

const TARGET_ORIGIN =
  process.env.SITE_ORIGIN ?? "https://quiz.miaswebsites.art";

function loadEnvFile(path: string, override: boolean) {
  try {
    const t = readFileSync(path, "utf8");
    for (const line of t.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const i = s.indexOf("=");
      if (i === -1) continue;
      const k = s.slice(0, i).trim();
      let v = s.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      )
        v = v.slice(1, -1);
      if (override || !(k in process.env)) process.env[k] = v;
    }
  } catch {}
}
// Prod values (from `vercel env pull .env.production.local`) take priority,
// then local fills in anything missing. This avoids the AUTH_SECRET-mismatch
// bug where a script-minted token won't validate against the live site.
loadEnvFile(".env.production.local", true);
loadEnvFile(".env.local", false);

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

function makeId(): string {
  const a = "0123456789abcdefghijklmnopqrstuvwxyz";
  const b = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += a[b[i] % 36];
  return out;
}

function hashToken(rawToken: string, secret: string): string {
  return createHash("sha256").update(`${rawToken}${secret}`).digest("hex");
}

function tomorrowMidnightLocalIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

// Use whichever email provider has a key set, prefer Brevo if both are
// (matches the live site's current toggle).
async function sendInvite(args: {
  to: string;
  name: string;
  magicUrl: string;
  quizUrl: string;
  deadlineHuman: string;
  opponentName: string;
}): Promise<void> {
  const fromHeader =
    process.env.EMAIL_FROM ||
    "Mia's Quiz Tournament <quiz@miaswebsites.art>";
  const fromMatch = fromHeader.match(/^(.+?)\s*<\s*(.+?)\s*>\s*$/);
  const senderName = fromMatch ? fromMatch[1].trim() : "Mia's Quiz Tournament";
  const senderEmail = fromMatch ? fromMatch[2].trim() : fromHeader;

  const subject = "You're in — late entry to Round 1 of Mia's Quiz Tournament";
  const text = [
    `Hey ${args.name},`,
    "",
    "Late entry — you've been added to Mia's Quiz Tournament. Round 1 is technically closed for everyone else, but it's open just for you and one other late entrant. Whoever scores higher takes the bracket slot.",
    "",
    `Your opponent: ${args.opponentName}`,
    `Deadline:      ${args.deadlineHuman}`,
    "",
    "Step 1 — sign in (link works once, within 24 hours):",
    args.magicUrl,
    "",
    "Step 2 — once signed in, take the round:",
    args.quizUrl,
    "",
    "Same format as everyone else got: 10 multiple-choice questions on Spanish. No timer, no looking things up. Tab-leave strikes are on, so don't pop another tab.",
    "",
    "— Sam · Mia's Quiz Tournament",
  ].join("\n");

  const html = `<!doctype html><html><body style="background:#B7E5FF;margin:0;padding:32px;font-family:Quicksand,sans-serif;color:#1B2A4E">
    <div style="max-width:560px;margin:0 auto;background:white;padding:36px;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 0 #1B2A4E">
      <p style="font-family:Fredoka,sans-serif;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#E94B7E;font-size:13px;margin:0 0 6px">⚡ Late entry — Round 1</p>
      <h1 style="font-family:Fredoka,sans-serif;font-weight:700;font-size:32px;line-height:1.15;margin:0 0 14px;color:#1B2A4E">You're in, ${args.name}!</h1>
      <p style="font-size:16px;line-height:1.55;margin:0 0 12px">Round 1 is technically closed, but it's been opened just for you and one other late entrant. Whoever scores higher takes the bracket slot.</p>
      <table style="margin:18px 0;border-collapse:separate;border:3px solid #1B2A4E;border-radius:14px;background:#FFF7E6;width:100%;box-shadow:4px 4px 0 0 #1B2A4E">
        <tr><td style="padding:14px 18px"><div style="font-family:Fredoka,sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#E94B7E">Your opponent</div><div style="font-family:Fredoka,sans-serif;font-size:22px;font-weight:700;color:#1B2A4E;margin-top:2px">${esc(args.opponentName)}</div></td></tr>
        <tr><td style="padding:0 18px 14px"><div style="font-family:Fredoka,sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#E94B7E">Deadline</div><div style="font-family:Fredoka,sans-serif;font-size:22px;font-weight:700;color:#1B2A4E;margin-top:2px">${esc(args.deadlineHuman)}</div></td></tr>
      </table>
      <p style="margin:16px 0 8px;font-family:Fredoka,sans-serif;font-weight:700;color:#1B2A4E;font-size:13px;letter-spacing:.04em;text-transform:uppercase">Step 1 — sign in</p>
      <p style="margin:0 0 16px"><a href="${esc(args.magicUrl)}" style="display:inline-block;padding:14px 26px;background:#FF6B9D;color:white;text-decoration:none;font-family:Fredoka,sans-serif;font-weight:600;font-size:18px;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E">🔮 Sign in →</a></p>
      <p style="margin:16px 0 8px;font-family:Fredoka,sans-serif;font-weight:700;color:#1B2A4E;font-size:13px;letter-spacing:.04em;text-transform:uppercase">Step 2 — take the round</p>
      <p style="margin:0 0 16px"><a href="${esc(args.quizUrl)}" style="display:inline-block;padding:12px 22px;background:#7DD87D;color:white;text-decoration:none;font-family:Fredoka,sans-serif;font-weight:600;font-size:16px;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E">▶ Play your Round 1</a></p>
      <p style="font-size:13px;color:#3B4A7E;margin:18px 0 0;line-height:1.55">Same format as everyone else: 10 multiple-choice questions on Spanish. No timer, no looking things up. Tab-leave strikes are on, so don't pop another tab.</p>
      <p style="font-size:13px;color:#3B4A7E;margin:18px 0 0">— Sam · Mia's Quiz Tournament</p>
    </div>
  </body></html>`;

  const brevoKey = process.env.BREVO_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (brevoKey) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: args.to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Brevo ${res.status}: ${t.slice(0, 200)}`);
    }
    return;
  }
  if (resendKey) {
    const { Resend } = await import("resend");
    const r = new Resend(resendKey);
    const out = await r.emails.send({
      from: fromHeader,
      to: args.to,
      subject,
      text,
      html,
    });
    if (out.error) throw new Error(out.error.message ?? String(out.error));
    return;
  }
  console.log(
    `\n[no email key set — copy this magic link manually]\n  ${args.to}: ${args.magicUrl}`
  );
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  const e1 = (arg("--p1") ?? "").trim().toLowerCase();
  const e2 = (arg("--p2") ?? "").trim().toLowerCase();
  const n1 = arg("--name1");
  const n2 = arg("--name2");
  const deadlineRaw = arg("--deadline") ?? tomorrowMidnightLocalIso();
  if (!e1 || !e2 || !e1.includes("@") || !e2.includes("@")) {
    console.error("❌ Need --p1 and --p2 emails.");
    process.exit(2);
  }
  const dbUrl = process.env.DATABASE_URL;
  const authSecret = process.env.AUTH_SECRET;
  if (!dbUrl || !authSecret) {
    console.error("❌ DATABASE_URL and AUTH_SECRET must be set.");
    process.exit(2);
  }

  const sql = neon(dbUrl, { fetchOptions: { cache: "no-store" } });
  const db = drizzle(sql, { schema });

  const [tournament] = await db
    .select()
    .from(schema.tournaments)
    .orderBy(desc(schema.tournaments.createdAt))
    .limit(1);
  if (!tournament) {
    console.error("❌ No tournament.");
    process.exit(1);
  }

  // Find the existing live R1 round so we can clone its questions.
  const [r1Round] = await db
    .select()
    .from(schema.rounds)
    .where(
      and(
        eq(schema.rounds.tournamentId, tournament.id),
        eq(schema.rounds.chapterNumber, 1),
        eq(schema.rounds.isPractice, false)
      )
    )
    .limit(1);
  if (!r1Round) {
    console.error("❌ Couldn't find the original Round 1 round.");
    process.exit(1);
  }
  console.log(
    `Tournament: ${tournament.title}\n  R1 source: ${r1Round.title} (${r1Round.id})`
  );

  // ── Find or create both users + enrollments ───────────────────────────
  type Pair = { email: string; name: string; userId: string; isNew: boolean };
  const players: Pair[] = [];
  for (const [email, hint] of [
    [e1, n1] as const,
    [e2, n2] as const,
  ]) {
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    const isNew = !existing;
    const userId = existing?.id ?? makeId();
    const name = hint ?? existing?.name ?? email.split("@")[0] ?? "Player";
    if (isNew) {
      await db.insert(schema.users).values({
        id: userId,
        email,
        name,
        role: "reader",
      });
      console.log(`  ✓ created user ${email}`);
    } else {
      console.log(`  · existing user ${email}`);
    }
    const [enrolled] = await db
      .select()
      .from(schema.enrollments)
      .where(
        and(
          eq(schema.enrollments.userId, userId),
          eq(schema.enrollments.tournamentId, tournament.id)
        )
      )
      .limit(1);
    if (!enrolled) {
      await db.insert(schema.enrollments).values({
        id: makeId(),
        userId,
        tournamentId: tournament.id,
        strikeCount: 0,
      });
      console.log(`    + enrolled in tournament`);
    } else if (enrolled.eliminatedAt) {
      await db
        .update(schema.enrollments)
        .set({ eliminatedAt: null, eliminatedInRoundId: null })
        .where(eq(schema.enrollments.id, enrolled.id));
      console.log(`    + un-eliminated existing enrollment`);
    }
    players.push({ email, name, userId, isNew });
  }

  // ── Create the new R1 matchup with both players ───────────────────────
  const r1 = await db
    .select()
    .from(schema.matchups)
    .where(
      and(
        eq(schema.matchups.tournamentId, tournament.id),
        eq(schema.matchups.bracket, "main"),
        eq(schema.matchups.roundIndex, 1)
      )
    )
    .orderBy(asc(schema.matchups.slot));
  const newSlot = (r1[r1.length - 1]?.slot ?? -1) + 1;
  const newMatchupId = makeId();
  await db.insert(schema.matchups).values({
    id: newMatchupId,
    tournamentId: tournament.id,
    bracket: "main",
    roundIndex: 1,
    slot: newSlot,
    playerAUserId: players[0].userId,
    playerBUserId: players[1].userId,
    winnerUserId: null,
    resolvedVia: null,
    resolvedAt: null,
    // Late entrants don't get a losers-bracket fallback — both are
    // single-elim from here. The user explicitly said "they can just play
    // each other".
    loserNextMatchupId: null,
    loserNextSide: null,
  });
  console.log(
    `  ✓ created R1 slot ${newSlot}: ${players[0].name} vs ${players[1].name} (${newMatchupId})`
  );
  // Walk up the bracket and add R2/R3/... placeholders if the new slot
  // would otherwise have nowhere to advance to.
  let curRound = 1;
  let curSlot = newSlot;
  for (let i = 0; i < 12; i++) {
    const nextRound = curRound + 1;
    const nextSlot = Math.floor(curSlot / 2);
    const [exists] = await db
      .select()
      .from(schema.matchups)
      .where(
        and(
          eq(schema.matchups.tournamentId, tournament.id),
          eq(schema.matchups.bracket, "main"),
          eq(schema.matchups.roundIndex, nextRound),
          eq(schema.matchups.slot, nextSlot)
        )
      )
      .limit(1);
    if (exists) break;
    await db.insert(schema.matchups).values({
      id: makeId(),
      tournamentId: tournament.id,
      bracket: "main",
      roundIndex: nextRound,
      slot: nextSlot,
      playerAUserId: null,
      playerBUserId: null,
    });
    console.log(`    + extended bracket: R${nextRound} slot ${nextSlot} placeholder`);
    curRound = nextRound;
    curSlot = nextSlot;
  }

  // ── Clone R1 questions into a gated round just for these two ──────────
  const sourceQuestions = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.roundId, r1Round.id))
    .orderBy(asc(schema.questions.order));
  const sourceOptionRows = sourceQuestions.length
    ? await db
        .select()
        .from(schema.options)
        .where(
          // inArray; manual OR-chain to avoid extra import noise
          (await import("drizzle-orm")).inArray(
            schema.options.questionId,
            sourceQuestions.map((q) => q.id)
          )
        )
    : [];
  const optsBySource = new Map<string, typeof sourceOptionRows>();
  for (const o of sourceOptionRows) {
    if (!optsBySource.has(o.questionId)) optsBySource.set(o.questionId, []);
    optsBySource.get(o.questionId)!.push(o);
  }

  const clonedRoundId = makeId();
  const deadline = new Date(deadlineRaw);
  if (isNaN(deadline.getTime())) {
    console.error(`❌ Bad --deadline: ${deadlineRaw}`);
    process.exit(2);
  }
  // Pick a chapter number that's free, similar to create-tiebreaker.
  const sameTournamentRounds = await db
    .select({ chapterNumber: schema.rounds.chapterNumber })
    .from(schema.rounds)
    .where(eq(schema.rounds.tournamentId, tournament.id))
    .orderBy(asc(schema.rounds.chapterNumber));
  const nextChapter =
    (sameTournamentRounds[sameTournamentRounds.length - 1]?.chapterNumber ?? 0) +
    1;
  await db.insert(schema.rounds).values({
    id: clonedRoundId,
    tournamentId: tournament.id,
    chapterNumber: nextChapter,
    title: `Round 1 (late entry) · ${players[0].name} vs ${players[1].name}`,
    introProse:
      r1Round.introProse ??
      "Round 1 — same questions, same rules. Higher score takes the bracket slot.",
    passThreshold: r1Round.passThreshold,
    status: "active",
    isPractice: true,
    tiebreakerMatchupId: newMatchupId,
    closesAt: deadline,
  });
  for (let i = 0; i < sourceQuestions.length; i++) {
    const sq = sourceQuestions[i];
    const newQId = makeId();
    await db.insert(schema.questions).values({
      id: newQId,
      roundId: clonedRoundId,
      order: i,
      prompt: sq.prompt,
      questionType: sq.questionType,
      points: sq.points,
    });
    const opts = optsBySource.get(sq.id) ?? [];
    opts.sort((a, b) => a.order - b.order);
    for (let j = 0; j < opts.length; j++) {
      const so = opts[j];
      await db.insert(schema.options).values({
        id: makeId(),
        questionId: newQId,
        order: j,
        label: so.label,
        isCorrect: so.isCorrect,
      });
    }
  }
  console.log(
    `  ✓ cloned ${sourceQuestions.length} questions into round ${clonedRoundId} (closes ${deadline.toISOString()})`
  );

  // ── Generate per-user magic-link tokens + send invitation emails ──────
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const opponent = players[1 - i];
    const rawToken = randomBytes(24).toString("hex");
    const hashed = hashToken(rawToken, authSecret);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db
      .insert(schema.verificationTokens)
      .values({ identifier: p.email, token: hashed, expires })
      .onConflictDoNothing();
    const callbackUrl = `${TARGET_ORIGIN}/play/practice/${clonedRoundId}`;
    const magicUrl =
      `${TARGET_ORIGIN}/api/auth/callback/email` +
      `?token=${encodeURIComponent(rawToken)}` +
      `&email=${encodeURIComponent(p.email)}` +
      `&callbackUrl=${encodeURIComponent(callbackUrl)}`;
    const quizUrl = `${TARGET_ORIGIN}/play/practice/${clonedRoundId}`;
    try {
      await sendInvite({
        to: p.email,
        name: p.name,
        magicUrl,
        quizUrl,
        deadlineHuman: deadline.toLocaleString(),
        opponentName: opponent.name,
      });
      console.log(`  ✓ sent invite to ${p.email}`);
    } catch (e) {
      console.error(
        `  ✗ failed to send invite to ${p.email}: ${e instanceof Error ? e.message : e}`
      );
    }
  }

  console.log(
    `\n✅ Done.\n   matchupId: ${newMatchupId}\n   gated roundId: ${clonedRoundId}\n   gated quiz URL: ${TARGET_ORIGIN}/play/practice/${clonedRoundId}\n   resolves automatically when both submit (winner = higher score → bracket via the existing tiebreaker resolver):\n     npx tsx scripts/resolve-tiebreaker.ts --round ${clonedRoundId}\n`
  );
}

main().catch((e) => {
  console.error("\n❌ Failed:", e);
  process.exit(1);
});
