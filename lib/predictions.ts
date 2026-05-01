// Bracket-prediction game (March-madness style).
//
// Per-matchup point values:
//   main R1: 1   (only matters for un-resolved late-entrants matches)
//   main R2: 1
//   main R3 (semi): 2
//   main R4+ (final): 4
//   losers any round: 1

import { db, schema } from "@/db";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { id as makeId } from "./ids";

const { matchups, predictions, appSettings, users, rounds, attempts, enrollments } = schema;

// Compute seeds from the original Round 1 quiz scores. Higher score = lower
// seed number (1 = top). Returns userId → seed (1..N). Players who didn't
// take R1 don't get a seed.
export async function getR1Seeds(
  tournamentId: string
): Promise<Map<string, number>> {
  const [r1] = await db
    .select()
    .from(rounds)
    .where(
      and(
        eq(rounds.tournamentId, tournamentId),
        eq(rounds.chapterNumber, 1),
        eq(rounds.isPractice, false)
      )
    )
    .limit(1);
  if (!r1) return new Map();
  const subs = await db
    .select()
    .from(attempts)
    .where(
      and(eq(attempts.roundId, r1.id), isNotNull(attempts.submittedAt))
    );
  const sorted = [...subs].sort(
    (a, b) => Number(b.score ?? 0) - Number(a.score ?? 0)
  );
  const seeds = new Map<string, number>();
  sorted.forEach((a, i) => seeds.set(a.userId, i + 1));
  return seeds;
}

const KEY_ENABLED = "predictions_enabled";
const KEY_PRIZE = "predictions_prize";

export type PredictionMatchup = typeof matchups.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;

export type PredictionsSettings = {
  enabled: boolean;
  prize: string;
};

type Cache = { v: PredictionsSettings; expiresAt: number };
let cache: Cache | null = null;

export async function getPredictionsSettings(): Promise<PredictionsSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.v;
  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, [KEY_ENABLED, KEY_PRIZE]));
  const m = new Map(rows.map((r) => [r.key, r.value ?? ""]));
  const v: PredictionsSettings = {
    enabled: (m.get(KEY_ENABLED) ?? "no") === "yes",
    prize: m.get(KEY_PRIZE) ?? "",
  };
  cache = { v, expiresAt: Date.now() + 30_000 };
  return v;
}

export async function setPredictionsSettings(
  next: Partial<PredictionsSettings>
): Promise<void> {
  const ops: Array<Promise<unknown>> = [];
  if (next.enabled !== undefined) {
    const value = next.enabled ? "yes" : "no";
    ops.push(
      db
        .insert(appSettings)
        .values({ key: KEY_ENABLED, value })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value, updatedAt: new Date() },
        })
    );
  }
  if (next.prize !== undefined) {
    ops.push(
      db
        .insert(appSettings)
        .values({ key: KEY_PRIZE, value: next.prize })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: next.prize, updatedAt: new Date() },
        })
    );
  }
  await Promise.all(ops);
  cache = null;
}

export function pointValueFor(m: PredictionMatchup): number {
  if (m.bracket === "losers") return 1;
  // main bracket
  if (m.roundIndex === 1) return 1;
  if (m.roundIndex === 2) return 1;
  if (m.roundIndex === 3) return 2;
  return 4; // R4 final and beyond
}

// A matchup is "predictable" iff it isn't yet resolved AND not host-locked
// AND has both players seated (you can't predict before seeding finishes).
// "Predictable" here is the SERVER-side check: the matchup has not been
// resolved and isn't manually locked. We deliberately do NOT require both
// raw DB sides to be seated — for R2+ matchups, the seated sides are
// derived per-user from cascading their own picks, and the DB row stays
// null until propagateWinners actually fires. Use isPredictableNow when
// you want the stricter "ready to bet on" semantics for read-only views.
export function isPredictable(m: PredictionMatchup): boolean {
  if (m.winnerUserId) return false;
  if (m.predictionsLockedAt) return false;
  return true;
}

// Stricter variant: ready-to-bet requires both DB sides seated. Used by
// counts on the public /predict page where we summarise "you can pick X
// of Y matchups right now".
export function isPredictableNow(m: PredictionMatchup): boolean {
  if (!isPredictable(m)) return false;
  if (!m.playerAUserId || !m.playerBUserId) return false;
  return true;
}

// True bye = a matchup whose missing side will *never* fill via cascade.
// Distinguishes from "pending" matchups (one side waiting for its R-1
// feeder's winner — those will fill, not a bye).
export function isByeMatchup(
  m: PredictionMatchup,
  allMatchups: PredictionMatchup[]
): boolean {
  if (m.winnerUserId) return false; // already resolved
  const aSeated = !!m.playerAUserId;
  const bSeated = !!m.playerBUserId;
  if (aSeated && bSeated) return false; // real match

  if (m.roundIndex === 1) {
    // R1 has no R0 feeders normally. Losers-bracket R1 might be filled by a
    // main-R1 loser via loserNextMatchupId — if no such routing exists for
    // the missing side, this LB matchup is a permanent bye.
    if (m.bracket === "losers") {
      if (!aSeated && !bSeated) {
        // Wait for routing on either side — if either is wired, it'll fill.
        const willFillEither = allMatchups.some(
          (x) =>
            x.bracket === "main" &&
            x.loserNextMatchupId === m.id
        );
        return !willFillEither;
      }
      const missingSide: "a" | "b" = aSeated ? "b" : "a";
      const willFillFromRouting = allMatchups.some(
        (x) =>
          x.bracket === "main" &&
          x.loserNextMatchupId === m.id &&
          x.loserNextSide === missingSide
      );
      return !willFillFromRouting;
    }
    // Main R1 single-side = always a bye. Both empty = no players ever
    // (shouldn't happen in practice but treat as bye/no-op).
    return true;
  }

  // R2+: structural bye iff at most one of the two feeder slots exists in
  // R-1. Covers two cases: one side already cascaded and the other never
  // will (existing path), AND both sides empty because one of two feeders
  // is missing entirely (the "tail bye" — e.g. odd R1 count produces a
  // straggler matchup whose partner slot doesn't exist).
  const slotA = m.slot * 2;
  const slotB = m.slot * 2 + 1;
  const fA = allMatchups.find(
    (x) =>
      x.bracket === m.bracket &&
      x.roundIndex === m.roundIndex - 1 &&
      x.slot === slotA
  );
  const fB = allMatchups.find(
    (x) =>
      x.bracket === m.bracket &&
      x.roundIndex === m.roundIndex - 1 &&
      x.slot === slotB
  );
  const feederCount = (fA ? 1 : 0) + (fB ? 1 : 0);
  if (feederCount <= 1) return true;
  // Two feeders exist; if a side is already seated and the other-side feeder
  // exists, this isn't a bye, just pending.
  if (aSeated || bSeated) return false;
  return false;
}

export async function getAllMatchupsForGame(tournamentId: string) {
  const rows = await db
    .select()
    .from(matchups)
    .where(eq(matchups.tournamentId, tournamentId))
    .orderBy(asc(matchups.bracket), asc(matchups.roundIndex), asc(matchups.slot));
  return rows;
}

export async function getMyPredictions(
  userId: string,
  tournamentId: string
): Promise<Map<string, Prediction>> {
  const all = await db.select().from(predictions).where(eq(predictions.userId, userId));
  // Filter to this tournament's matchups
  const tournamentMatchups = await db
    .select({ id: matchups.id })
    .from(matchups)
    .where(eq(matchups.tournamentId, tournamentId));
  const ids = new Set(tournamentMatchups.map((m) => m.id));
  return new Map(
    all.filter((p) => ids.has(p.matchupId)).map((p) => [p.matchupId, p])
  );
}

export async function upsertPrediction(args: {
  userId: string;
  matchupId: string;
  predictedWinnerUserId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const [m] = await db
    .select()
    .from(matchups)
    .where(eq(matchups.id, args.matchupId))
    .limit(1);
  if (!m) return { ok: false, reason: "matchup not found" };
  if (!isPredictable(m))
    return { ok: false, reason: "matchup is locked or already decided" };

  // Validate the predicted winner exists. We can't strictly check that the
  // picked user is "in this matchup" because R2+ matchups have null
  // playerA/B until propagateWinners fires — the effective players are
  // cascade-derived per-user (their earlier picks). The trust boundary
  // here is the tournament: the picked user must be enrolled.
  const [picked] = await db
    .select({ id: enrollments.userId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, args.predictedWinnerUserId),
        eq(enrollments.tournamentId, m.tournamentId)
      )
    )
    .limit(1);
  if (!picked) {
    return {
      ok: false,
      reason: "predicted user isn't in this tournament",
    };
  }
  // R1 matchups have both sides seated in the DB — keep the strict check
  // for those so we don't accept R1 picks for the wrong pair.
  if (
    m.roundIndex === 1 &&
    m.playerAUserId &&
    m.playerBUserId &&
    args.predictedWinnerUserId !== m.playerAUserId &&
    args.predictedWinnerUserId !== m.playerBUserId
  ) {
    return { ok: false, reason: "predicted user isn't in this matchup" };
  }
  // Upsert.
  const [existing] = await db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.userId, args.userId),
        eq(predictions.matchupId, args.matchupId)
      )
    )
    .limit(1);
  if (existing) {
    await db
      .update(predictions)
      .set({
        predictedWinnerUserId: args.predictedWinnerUserId,
        updatedAt: new Date(),
      })
      .where(eq(predictions.id, existing.id));
  } else {
    await db.insert(predictions).values({
      id: makeId(),
      userId: args.userId,
      matchupId: args.matchupId,
      predictedWinnerUserId: args.predictedWinnerUserId,
    });
  }
  return { ok: true };
}

export async function lockMatchup(matchupId: string, locked: boolean) {
  await db
    .update(matchups)
    .set({ predictionsLockedAt: locked ? new Date() : null })
    .where(eq(matchups.id, matchupId));
}

export async function lockAllMatchups(tournamentId: string, locked: boolean) {
  await db
    .update(matchups)
    .set({ predictionsLockedAt: locked ? new Date() : null })
    .where(eq(matchups.tournamentId, tournamentId));
}

// ─── leaderboard ───────────────────────────────────────────────────────

export type LeaderboardEntry = {
  userId: string;
  name: string | null;
  email: string | null;
  totalPoints: number;
  correctCount: number;
  resolvedCount: number;
  predictionsMade: number;
};

export async function getLeaderboard(
  tournamentId: string
): Promise<LeaderboardEntry[]> {
  const ms = await db
    .select()
    .from(matchups)
    .where(eq(matchups.tournamentId, tournamentId));
  const matchupIds = ms.map((m) => m.id);
  if (matchupIds.length === 0) return [];

  const allPreds =
    matchupIds.length === 0
      ? []
      : await db
          .select()
          .from(predictions)
          .where(inArray(predictions.matchupId, matchupIds));

  const byMatchup = new Map(ms.map((m) => [m.id, m]));
  const userIds = [...new Set(allPreds.map((p) => p.userId))];
  const userRows =
    userIds.length === 0
      ? []
      : await db.select().from(users).where(inArray(users.id, userIds));
  const userById = new Map(userRows.map((u) => [u.id, u]));

  const entries = new Map<string, LeaderboardEntry>();
  for (const p of allPreds) {
    const u = userById.get(p.userId);
    if (!u) continue;
    if (!entries.has(p.userId)) {
      entries.set(p.userId, {
        userId: p.userId,
        name: u.name,
        email: u.email,
        totalPoints: 0,
        correctCount: 0,
        resolvedCount: 0,
        predictionsMade: 0,
      });
    }
    const e = entries.get(p.userId)!;
    e.predictionsMade += 1;
    const m = byMatchup.get(p.matchupId);
    if (!m) continue;
    if (m.winnerUserId) {
      e.resolvedCount += 1;
      if (p.predictedWinnerUserId === m.winnerUserId) {
        e.correctCount += 1;
        e.totalPoints += pointValueFor(m);
      }
    }
  }

  return [...entries.values()].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    return b.predictionsMade - a.predictionsMade;
  });
}
