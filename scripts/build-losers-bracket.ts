// Retrofit a running tournament to add a losers bracket. For an N-match
// main R1, builds a max-pair LB tree (LB R1 = ceil(N/2) matchups, halves
// each round, BYEs in odd rounds), points each main R1 matchup at its
// loser destination via loser_next_matchup_id, and (for main R1 matchups
// already resolved) seats the loser in their LB slot + brings them back
// from "eliminated" status.
//
//   npx tsx scripts/build-losers-bracket.ts          (dry run)
//   npx tsx scripts/build-losers-bracket.ts --apply

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, asc, desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import * as schema from "../db/schema.ts";

function loadEnvLocal() {
  try {
    const t = readFileSync(".env.local", "utf8");
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
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {}
}
loadEnvLocal();

function makeId(): string {
  const a = "0123456789abcdefghijklmnopqrstuvwxyz";
  const b = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += a[b[i] % 36];
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL not set");
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

  // Existing main R1 matchups (real matches only — BYEs have winnerUserId
  // set with playerB null, those don't produce LB entrants).
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

  const realMatches = r1.filter(
    (m) => !!m.playerAUserId && !!m.playerBUserId
  );
  console.log(
    `Tournament: ${tournament.title}\n  main R1 total: ${r1.length}, real matches feeding LB: ${realMatches.length}`
  );

  // Existing LB rows? (e.g. previous run of this script). Bail if so.
  const existingLb = await db
    .select()
    .from(schema.matchups)
    .where(
      and(
        eq(schema.matchups.tournamentId, tournament.id),
        eq(schema.matchups.bracket, "losers")
      )
    );
  if (existingLb.length > 0) {
    console.log(
      `\n⚠️  Losers bracket already has ${existingLb.length} matchup(s) — refusing to clobber. Drop them manually if you really want to rebuild.`
    );
    process.exit(0);
  }

  // ── Build LB skeleton: ceil(N/2), ceil/2, ... down to 1 ────────────────
  const lbRoundSizes: number[] = [];
  let cur = Math.max(1, Math.ceil(realMatches.length / 2));
  // Special-case: if only 1 LB entrant ever, we just need a 1-slot round.
  while (cur > 1) {
    lbRoundSizes.push(cur);
    cur = Math.ceil(cur / 2);
  }
  lbRoundSizes.push(1);
  console.log(`  planned LB rounds: ${lbRoundSizes.join(" → ")}`);

  type Plan = {
    lbInserts: Array<{
      id: string;
      tournamentId: string;
      bracket: "losers";
      roundIndex: number;
      slot: number;
      playerAUserId: string | null;
      playerBUserId: string | null;
    }>;
    mainR1Updates: Array<{
      id: string;
      loserNextMatchupId: string;
      loserNextSide: "a" | "b";
      seatLoserUserId: string | null;
    }>;
    lbSeatUpdates: Array<{
      lbId: string;
      side: "a" | "b";
      userId: string;
    }>;
    enrollmentUnEliminate: string[];
  };
  const plan: Plan = {
    lbInserts: [],
    mainR1Updates: [],
    lbSeatUpdates: [],
    enrollmentUnEliminate: [],
  };

  // ── Materialise LB matchup IDs upfront so we can wire main R1 → LB R1 ─
  const lbIds: string[][] = lbRoundSizes.map((n) => {
    const arr: string[] = [];
    for (let i = 0; i < n; i++) arr.push(makeId());
    return arr;
  });
  for (let r = 0; r < lbRoundSizes.length; r++) {
    for (let s = 0; s < lbRoundSizes[r]; s++) {
      plan.lbInserts.push({
        id: lbIds[r][s],
        tournamentId: tournament.id,
        bracket: "losers",
        roundIndex: r + 1,
        slot: s,
        playerAUserId: null,
        playerBUserId: null,
      });
    }
  }

  // ── Pair main R1 → LB R1 in match-index order ──────────────────────────
  // realMatches[i] (i=0..N-1) loser → LB R1 slot floor(i/2), side i%2 ? B : A
  for (let i = 0; i < realMatches.length; i++) {
    const m = realMatches[i];
    const lbSlot = Math.floor(i / 2);
    const sideIsA = i % 2 === 0;
    const lbId = lbIds[0][lbSlot];
    let seatLoserUserId: string | null = null;
    if (m.winnerUserId) {
      const loser =
        m.winnerUserId === m.playerAUserId
          ? m.playerBUserId
          : m.playerAUserId;
      if (loser) {
        seatLoserUserId = loser;
        plan.lbSeatUpdates.push({
          lbId,
          side: sideIsA ? "a" : "b",
          userId: loser,
        });
        plan.enrollmentUnEliminate.push(loser);
      }
    }
    plan.mainR1Updates.push({
      id: m.id,
      loserNextMatchupId: lbId,
      loserNextSide: sideIsA ? "a" : "b",
      seatLoserUserId,
    });
  }

  // ── Print plan ────────────────────────────────────────────────────────
  console.log(
    `\nPlan:\n  + create ${plan.lbInserts.length} LB matchup row(s)\n  + set loser_next_matchup_id on ${plan.mainR1Updates.length} main R1 matchup(s)\n  + seat ${plan.lbSeatUpdates.length} already-determined R1 loser(s) in LB slots\n  + un-eliminate ${plan.enrollmentUnEliminate.length} enrollment(s)`
  );
  if (plan.lbSeatUpdates.length > 0) {
    const userMap = new Map(
      (
        await db
          .select()
          .from(schema.users)
          .where(
            // eq with first user's id is just a placeholder; we'll re-fetch
            eq(schema.users.id, plan.enrollmentUnEliminate[0]!)
          )
      ).map((u) => [u.id, u])
    );
    // fetch all
    const allLosers = await db
      .select()
      .from(schema.users);
    const um = new Map(allLosers.map((u) => [u.id, u]));
    for (const u of plan.lbSeatUpdates) {
      const usr = um.get(u.userId);
      console.log(
        `    LB ${u.lbId.slice(0, 6)}… side ${u.side}: ${usr?.name ?? usr?.email ?? u.userId}`
      );
    }
    void userMap;
  }

  if (!apply) {
    console.log("\n(dry run — re-run with --apply to write)");
    return;
  }

  // ── Execute ───────────────────────────────────────────────────────────
  for (const ins of plan.lbInserts) {
    await db.insert(schema.matchups).values(ins);
  }
  for (const u of plan.mainR1Updates) {
    await db
      .update(schema.matchups)
      .set({
        loserNextMatchupId: u.loserNextMatchupId,
        loserNextSide: u.loserNextSide,
      })
      .where(eq(schema.matchups.id, u.id));
  }
  for (const seat of plan.lbSeatUpdates) {
    await db
      .update(schema.matchups)
      .set(
        seat.side === "a"
          ? { playerAUserId: seat.userId }
          : { playerBUserId: seat.userId }
      )
      .where(eq(schema.matchups.id, seat.lbId));
  }
  for (const userId of plan.enrollmentUnEliminate) {
    await db
      .update(schema.enrollments)
      .set({ eliminatedAt: null, eliminatedInRoundId: null })
      .where(
        and(
          eq(schema.enrollments.userId, userId),
          eq(schema.enrollments.tournamentId, tournament.id)
        )
      );
  }
  console.log("\n✅ Losers bracket retrofit applied.");
}

main().catch((e) => {
  console.error("\n❌ Failed:", e);
  process.exit(1);
});
