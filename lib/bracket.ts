// Bracket engine — single elimination with manual override.
//
// Model: a bracket is a set of `matchups` rows for one tournament.
// `roundIndex` 1 = the first/widest round; final = the round with one
// matchup. `slot` is the position within the round (0..N-1, top to bottom).
//
// A matchup's winner can be:
//   - null  (undecided)
//   - decided 'auto'   — by quiz score after the corresponding quiz round closes
//   - decided 'manual' — by host override (always wins over auto)
//
// The host can clear and regenerate the bracket at any time.
//
// We store empty matchups for every later round at generation time so the
// visual bracket has the right shape; we fill `playerAUserId`/`playerBUserId`
// as previous-round winners get resolved.

import { db, schema } from "@/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { id as makeId } from "./ids";

const { matchups, attempts, rounds, users, enrollments, tournaments } = schema;

export type Matchup = typeof matchups.$inferSelect;

// ─── helpers ────────────────────────────────────────────────────────────────

function nextPow2(n: number) {
  if (n < 1) return 1;
  return Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
}

// "Standard" seed pairing for round 1: 1v8, 4v5, 2v7, 3v6 etc.
// Returns an ordering of seed indexes (0..size-1) such that pairs (0,1), (2,3)
// etc. are correctly seeded.
function bracketSeedOrder(size: number): number[] {
  // Recursive doubling: start with [0,1], expand to [0, size-1, size/2-1, size/2, ...]
  let arr = [0, 1];
  let s = 2;
  while (s < size) {
    s *= 2;
    const next: number[] = [];
    for (const x of arr) {
      next.push(x);
      next.push(s - 1 - x);
    }
    arr = next;
  }
  return arr;
}

// ─── public API ─────────────────────────────────────────────────────────────

export type BracketRound = {
  roundIndex: number;
  matchups: Matchup[];
};

export async function getBracket(tournamentId: string): Promise<BracketRound[]> {
  const rows = await db
    .select()
    .from(matchups)
    .where(eq(matchups.tournamentId, tournamentId))
    .orderBy(asc(matchups.roundIndex), asc(matchups.slot));
  const rounds: BracketRound[] = [];
  for (const m of rows) {
    let r = rounds.find((x) => x.roundIndex === m.roundIndex);
    if (!r) {
      r = { roundIndex: m.roundIndex, matchups: [] };
      rounds.push(r);
    }
    r.matchups.push(m);
  }
  return rounds;
}

// Build (or rebuild) a single-elim bracket from the given seed order.
// `seedUserIds` is an array of userIds in seeding order (seed #1 first).
// All existing matchups are wiped first.
export async function generateBracket(
  tournamentId: string,
  seedUserIds: string[]
) {
  if (seedUserIds.length < 2) {
    throw new Error("Need at least 2 players to make a bracket.");
  }

  await db.delete(matchups).where(eq(matchups.tournamentId, tournamentId));

  const size = nextPow2(seedUserIds.length);
  const byes = size - seedUserIds.length;
  const order = bracketSeedOrder(size);
  // Build padded array indexed by seed (0 = top seed). null = bye.
  const seeds: (string | null)[] = [...seedUserIds, ...Array(byes).fill(null)];

  // Round 1 = size/2 matchups. Pairs come from `order`: (order[0], order[1]),
  // (order[2], order[3]), ...
  const round1Inserts: (typeof matchups.$inferInsert)[] = [];
  for (let i = 0; i < size / 2; i++) {
    const aIdx = order[i * 2];
    const bIdx = order[i * 2 + 1];
    const a = seeds[aIdx];
    const b = seeds[bIdx];
    let winner: string | null = null;
    let resolvedVia: "auto" | null = null;
    let resolvedAt: Date | null = null;
    if (a && !b) {
      winner = a;
      resolvedVia = "auto";
      resolvedAt = new Date();
    } else if (!a && b) {
      winner = b;
      resolvedVia = "auto";
      resolvedAt = new Date();
    }
    round1Inserts.push({
      id: makeId(),
      tournamentId,
      roundIndex: 1,
      slot: i,
      playerAUserId: a,
      playerBUserId: b,
      winnerUserId: winner,
      resolvedVia,
      resolvedAt,
    });
  }

  // Generate empty placeholder matchups for every subsequent round so the
  // bracket has a consistent shape from creation.
  const emptyInserts: (typeof matchups.$inferInsert)[] = [];
  let prev = size / 2;
  let r = 2;
  while (prev > 1) {
    prev = prev / 2;
    for (let i = 0; i < prev; i++) {
      emptyInserts.push({
        id: makeId(),
        tournamentId,
        roundIndex: r,
        slot: i,
        playerAUserId: null,
        playerBUserId: null,
        winnerUserId: null,
        resolvedVia: null,
        resolvedAt: null,
      });
    }
    r++;
  }

  await db.insert(matchups).values([...round1Inserts, ...emptyInserts]);

  // Propagate any byes forward immediately.
  await propagateWinners(tournamentId);
}

// Walk the bracket forward: for any matchup whose winner is set and whose
// next-round slot is empty/wrong, fill it.
export async function propagateWinners(tournamentId: string) {
  const all = await db
    .select()
    .from(matchups)
    .where(eq(matchups.tournamentId, tournamentId))
    .orderBy(asc(matchups.roundIndex), asc(matchups.slot));
  const byKey = new Map<string, Matchup>();
  for (const m of all) byKey.set(`${m.roundIndex}:${m.slot}`, m);

  for (const m of all) {
    if (!m.winnerUserId) continue;
    const nextRound = m.roundIndex + 1;
    const nextSlot = Math.floor(m.slot / 2);
    const next = byKey.get(`${nextRound}:${nextSlot}`);
    if (!next) continue;
    // The "A" position of the next matchup is filled by the lower-numbered
    // slot of this round (m.slot even -> A, odd -> B).
    const sideIsA = m.slot % 2 === 0;
    const want = m.winnerUserId;
    const have = sideIsA ? next.playerAUserId : next.playerBUserId;
    if (have === want) continue;
    await db
      .update(matchups)
      .set(
        sideIsA
          ? { playerAUserId: want }
          : { playerBUserId: want }
      )
      .where(eq(matchups.id, next.id));
    // Auto-resolve a single-side bye in the next round.
    const newA = sideIsA ? want : next.playerAUserId;
    const newB = sideIsA ? next.playerBUserId : want;
    if (
      next.roundIndex >= 2 &&
      ((newA && !newB) || (!newA && newB)) &&
      !next.winnerUserId
    ) {
      // Don't auto-resolve mid-round; only resolve a true bye if the OTHER
      // feeder slot is decided too.
      const otherFeeder = byKey.get(
        `${m.roundIndex}:${nextSlot * 2 + (sideIsA ? 1 : 0)}`
      );
      if (otherFeeder && otherFeeder.winnerUserId === null && (
        // sibling has no players at all → genuine bye
        !otherFeeder.playerAUserId && !otherFeeder.playerBUserId
      )) {
        await db
          .update(matchups)
          .set({
            winnerUserId: want,
            resolvedVia: "auto",
            resolvedAt: new Date(),
          })
          .where(eq(matchups.id, next.id));
      }
    }
  }
}

export async function clearBracket(tournamentId: string) {
  await db.delete(matchups).where(eq(matchups.tournamentId, tournamentId));
}

// Pick a winner for a matchup. Setting null clears the result.
// `via='manual'` is used by host overrides; auto-resolution from quiz scores
// will not overwrite a manual decision.
export async function resolveMatchup(
  matchupId: string,
  winnerUserId: string | null,
  via: "manual" | "auto"
) {
  const [m] = await db
    .select()
    .from(matchups)
    .where(eq(matchups.id, matchupId))
    .limit(1);
  if (!m) return;
  if (m.resolvedVia === "manual" && via === "auto") return;
  await db
    .update(matchups)
    .set({
      winnerUserId,
      resolvedVia: winnerUserId ? via : null,
      resolvedAt: winnerUserId ? new Date() : null,
    })
    .where(eq(matchups.id, matchupId));

  // If a winner is set, propagate; if cleared, also clear downstream entries
  // that came from this winner.
  if (winnerUserId) {
    await propagateWinners(m.tournamentId);
  } else {
    await unwindFrom(m);
  }
  await syncEliminationFromBracket(m.tournamentId);
}

async function unwindFrom(m: Matchup) {
  // Walk forward and remove anything seeded by the (now-cleared) winner.
  const all = await db
    .select()
    .from(matchups)
    .where(eq(matchups.tournamentId, m.tournamentId))
    .orderBy(asc(matchups.roundIndex), asc(matchups.slot));
  let cur = m;
  while (true) {
    const nextRound = cur.roundIndex + 1;
    const nextSlot = Math.floor(cur.slot / 2);
    const next = all.find(
      (x) => x.roundIndex === nextRound && x.slot === nextSlot
    );
    if (!next) break;
    const sideIsA = cur.slot % 2 === 0;
    const had = sideIsA ? next.playerAUserId : next.playerBUserId;
    if (had == null) break;
    await db
      .update(matchups)
      .set({
        ...(sideIsA ? { playerAUserId: null } : { playerBUserId: null }),
        winnerUserId: null,
        resolvedVia: null,
        resolvedAt: null,
      })
      .where(eq(matchups.id, next.id));
    cur = { ...next, playerAUserId: sideIsA ? null : next.playerAUserId,
            playerBUserId: sideIsA ? next.playerBUserId : null,
            winnerUserId: null, resolvedVia: null, resolvedAt: null } as Matchup;
  }
}

// Auto-resolve bracket matchups in `roundIndex` from quiz scores. Pulls the
// quiz round with chapterNumber=roundIndex; for each matchup with both
// players present and no winner (or a non-manual winner), sets the higher
// scorer as winner. Ties → leave undecided (host override decides).
export async function autoResolveByScore(
  tournamentId: string,
  roundIndex: number
) {
  const [quizRound] = await db
    .select()
    .from(rounds)
    .where(
      and(
        eq(rounds.tournamentId, tournamentId),
        eq(rounds.chapterNumber, roundIndex),
        eq(rounds.isPractice, false)
      )
    )
    .limit(1);
  if (!quizRound) return;

  const ms = await db
    .select()
    .from(matchups)
    .where(
      and(
        eq(matchups.tournamentId, tournamentId),
        eq(matchups.roundIndex, roundIndex)
      )
    );
  if (ms.length === 0) return;

  const userIds = new Set<string>();
  for (const m of ms) {
    if (m.playerAUserId) userIds.add(m.playerAUserId);
    if (m.playerBUserId) userIds.add(m.playerBUserId);
  }
  if (userIds.size === 0) return;

  const att = await db
    .select()
    .from(attempts)
    .where(
      and(
        eq(attempts.roundId, quizRound.id),
        inArray(attempts.userId, [...userIds])
      )
    );
  const scoreFor = new Map<string, number>();
  for (const a of att) {
    if (a.submittedAt) scoreFor.set(a.userId, Number(a.score ?? "0"));
  }

  for (const m of ms) {
    if (m.resolvedVia === "manual") continue;
    if (!m.playerAUserId || !m.playerBUserId) continue;
    const sa = scoreFor.get(m.playerAUserId) ?? 0;
    const sb = scoreFor.get(m.playerBUserId) ?? 0;
    let winner: string | null = null;
    if (sa > sb) winner = m.playerAUserId;
    else if (sb > sa) winner = m.playerBUserId;
    // tie → leave winner null
    await db
      .update(matchups)
      .set({
        winnerUserId: winner,
        resolvedVia: winner ? "auto" : null,
        resolvedAt: winner ? new Date() : null,
      })
      .where(eq(matchups.id, m.id));
  }

  await propagateWinners(tournamentId);
  await syncEliminationFromBracket(tournamentId);
}

// Mark enrollments as eliminated/restored based on bracket state. A player
// is "in" if any matchup with them as a player has them as the winner OR is
// undecided AND they're in a future-most-pending matchup. Simpler rule: a
// player is eliminated iff they appear as a non-winning player in any
// resolved matchup AND don't appear in a later round.
export async function syncEliminationFromBracket(tournamentId: string) {
  const ms = await db
    .select()
    .from(matchups)
    .where(eq(matchups.tournamentId, tournamentId))
    .orderBy(asc(matchups.roundIndex));
  const ens = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.tournamentId, tournamentId));

  const stillIn = new Set<string>();
  // A player is "still in" if they appear as A or B in a matchup that has
  // not yet been resolved against them.
  for (const m of ms) {
    if (m.playerAUserId && m.winnerUserId !== m.playerBUserId)
      stillIn.add(m.playerAUserId);
    if (m.playerBUserId && m.winnerUserId !== m.playerAUserId)
      stillIn.add(m.playerBUserId);
    // If matchup is fully resolved, the loser is removed from stillIn.
    if (m.winnerUserId) {
      const loser =
        m.winnerUserId === m.playerAUserId
          ? m.playerBUserId
          : m.winnerUserId === m.playerBUserId
          ? m.playerAUserId
          : null;
      if (loser) stillIn.delete(loser);
    }
  }

  for (const e of ens) {
    const isOut = !stillIn.has(e.userId);
    if (isOut && !e.eliminatedAt) {
      await db
        .update(enrollments)
        .set({ eliminatedAt: new Date(), eliminatedInRoundId: null })
        .where(eq(enrollments.id, e.id));
    } else if (!isOut && e.eliminatedAt) {
      await db
        .update(enrollments)
        .set({ eliminatedAt: null, eliminatedInRoundId: null })
        .where(eq(enrollments.id, e.id));
    }
  }
}

// Convenience: list cast (user info) keyed by id, for the bracket UI.
export async function getBracketUsers(tournamentId: string) {
  const ms = await db
    .select()
    .from(matchups)
    .where(eq(matchups.tournamentId, tournamentId));
  const ids = new Set<string>();
  for (const m of ms) {
    if (m.playerAUserId) ids.add(m.playerAUserId);
    if (m.playerBUserId) ids.add(m.playerBUserId);
    if (m.winnerUserId) ids.add(m.winnerUserId);
  }
  if (ids.size === 0) return new Map<string, { name: string | null; email: string | null }>();
  const rows = await db
    .select()
    .from(users)
    .where(inArray(users.id, [...ids]));
  return new Map(rows.map((u) => [u.id, { name: u.name, email: u.email }]));
}

// Tournament champion = winner of the final (highest roundIndex) matchup.
export async function getBracketChampionId(tournamentId: string) {
  const all = await db
    .select()
    .from(matchups)
    .where(eq(matchups.tournamentId, tournamentId))
    .orderBy(asc(matchups.roundIndex), asc(matchups.slot));
  if (all.length === 0) return null;
  const maxR = Math.max(...all.map((m) => m.roundIndex));
  const final = all.find((m) => m.roundIndex === maxR && m.slot === 0);
  return final?.winnerUserId ?? null;
}

// Find the matchup the given user is currently scheduled to play in
// `roundIndex` (or null).
export async function getUserMatchupForRound(
  tournamentId: string,
  userId: string,
  roundIndex: number
) {
  const [m] = await db
    .select()
    .from(matchups)
    .where(
      and(
        eq(matchups.tournamentId, tournamentId),
        eq(matchups.roundIndex, roundIndex)
      )
    );
  void m;
  const ms = await db
    .select()
    .from(matchups)
    .where(
      and(
        eq(matchups.tournamentId, tournamentId),
        eq(matchups.roundIndex, roundIndex)
      )
    );
  return (
    ms.find((x) => x.playerAUserId === userId || x.playerBUserId === userId) ??
    null
  );
}

// Swap a single round-1 player's seed slot. Used by the Maker UI.
export async function swapSeed(
  tournamentId: string,
  matchupId: string,
  side: "a" | "b",
  newUserId: string | null
) {
  const [m] = await db
    .select()
    .from(matchups)
    .where(eq(matchups.id, matchupId))
    .limit(1);
  if (!m || m.roundIndex !== 1) return;
  await db
    .update(matchups)
    .set({
      ...(side === "a"
        ? { playerAUserId: newUserId }
        : { playerBUserId: newUserId }),
      // Clear winner/propagation; the host should reconfirm.
      winnerUserId: null,
      resolvedVia: null,
      resolvedAt: null,
    })
    .where(eq(matchups.id, matchupId));
  // Wipe downstream slots that came from this matchup.
  await unwindFrom({ ...m, winnerUserId: null });
  await propagateWinners(tournamentId);
  await syncEliminationFromBracket(tournamentId);
}
