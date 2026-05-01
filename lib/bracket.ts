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

// ─── public API ─────────────────────────────────────────────────────────────

export type BracketRound = {
  roundIndex: number;
  matchups: Matchup[];
};

export type BracketKind = "main" | "losers";

export async function getBracket(
  tournamentId: string,
  bracket: BracketKind = "main"
): Promise<BracketRound[]> {
  const rows = await db
    .select()
    .from(matchups)
    .where(
      and(
        eq(matchups.tournamentId, tournamentId),
        eq(matchups.bracket, bracket)
      )
    )
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
//
// Pairing rule (max-pair): every round packs as many real matchups as it can
// before allowing a BYE. For odd player counts, exactly ONE bye is granted —
// to the top seed, which is the standard convention. Each subsequent round
// has ceil(prev / 2) slots; if the count entering a round is odd, the BYE
// naturally falls in that round's tail slot.
//
// Concretely for N=11:
//   R1 has 6 slots: slot 0 = top-seed bye, slots 1-5 = (1v10) (2v9) (3v8)
//                   (4v7) (5v6). One bye, five real matches.
//   R2 has 3 slots, all real once R1 finishes.
//   R3 has 2 slots: 1 real + 1 trailing bye for the winner of R2 slot 2.
//   R4 = final.
// Total byes: 2 (vs 5 under the previous power-of-2-padded approach).
export async function generateBracket(
  tournamentId: string,
  seedUserIds: string[]
) {
  if (seedUserIds.length < 2) {
    throw new Error("Need at least 2 players to make a bracket.");
  }

  await db.delete(matchups).where(eq(matchups.tournamentId, tournamentId));

  const N = seedUserIds.length;
  const isOdd = N % 2 === 1;

  const r1Inserts: (typeof matchups.$inferInsert)[] = [];

  // Top seed gets the only R1 bye when N is odd. Auto-resolved at insert
  // time so propagateWinners pushes them straight into R2.
  let cursor = 0;
  if (isOdd) {
    r1Inserts.push({
      id: makeId(),
      tournamentId,
      roundIndex: 1,
      slot: 0,
      playerAUserId: seedUserIds[0],
      playerBUserId: null,
      winnerUserId: seedUserIds[0],
      resolvedVia: "auto",
      resolvedAt: new Date(),
    });
    cursor = 1;
  }

  // Pair the remaining players "top vs bottom reversed" so seed gradient is
  // respected: 1v10, 2v9, 3v8, ... — same idea as the standard high-vs-low
  // bracket seeding, just without the binary-tree slot reordering.
  const playersToPair = isOdd ? seedUserIds.slice(1) : seedUserIds;
  const pairCount = playersToPair.length / 2;
  for (let i = 0; i < pairCount; i++) {
    r1Inserts.push({
      id: makeId(),
      tournamentId,
      roundIndex: 1,
      slot: cursor + i,
      playerAUserId: playersToPair[i],
      playerBUserId: playersToPair[playersToPair.length - 1 - i],
      winnerUserId: null,
      resolvedVia: null,
      resolvedAt: null,
    });
  }

  // Subsequent rounds: each one has ceil(prev/2) placeholder slots. The
  // existing floor(slot/2) propagation rule routes winners correctly; if a
  // round's entry count is odd, the trailing slot just ends up with one
  // player and propagateWinners auto-resolves it as a bye.
  const placeholderInserts: (typeof matchups.$inferInsert)[] = [];
  let prev = Math.ceil(N / 2);
  let r = 2;
  while (prev > 1) {
    const slots = Math.ceil(prev / 2);
    for (let s = 0; s < slots; s++) {
      placeholderInserts.push({
        id: makeId(),
        tournamentId,
        roundIndex: r,
        slot: s,
        playerAUserId: null,
        playerBUserId: null,
        winnerUserId: null,
        resolvedVia: null,
        resolvedAt: null,
      });
    }
    prev = slots;
    r++;
  }

  await db.insert(matchups).values([...r1Inserts, ...placeholderInserts]);

  // Walk byes forward immediately (the R1 top-seed bye, if any).
  await propagateWinners(tournamentId);
}

// Walk the bracket forward: for any matchup whose winner is set and whose
// next-round slot is empty/wrong, fill it. Repeats until no further changes
// are made — which matters now that byes can chain (e.g. a R3 trailing bye
// auto-resolves as soon as its R2 feeder finishes, and that result then
// needs to flow to R4).
export async function propagateWinners(tournamentId: string) {
  for (let pass = 0; pass < 50; pass++) {
    const all = await db
      .select()
      .from(matchups)
      .where(eq(matchups.tournamentId, tournamentId))
      .orderBy(asc(matchups.roundIndex), asc(matchups.slot));
    // Key includes the bracket so main + losers don't collide on slot.
    const byKey = new Map<string, Matchup>();
    for (const m of all) byKey.set(`${m.bracket}:${m.roundIndex}:${m.slot}`, m);
    const byId = new Map<string, Matchup>(all.map((m) => [m.id, m]));

    let changed = false;

    // Sweep LB R1 BYEs: if a losers-bracket round-1 matchup has exactly
    // one player and no winner, the lone player auto-advances. This is
    // the case when a late-added main R1 matchup routes its loser into
    // a freshly-created LB R1 slot with no opponent.
    for (const m of all) {
      if (m.bracket !== "losers" || m.roundIndex !== 1) continue;
      if (m.winnerUserId) continue;
      const onlyA = !!m.playerAUserId && !m.playerBUserId;
      const onlyB = !!m.playerBUserId && !m.playerAUserId;
      if (!onlyA && !onlyB) continue;
      const winner = m.playerAUserId ?? m.playerBUserId!;
      await db
        .update(matchups)
        .set({
          winnerUserId: winner,
          resolvedVia: "auto",
          resolvedAt: new Date(),
        })
        .where(eq(matchups.id, m.id));
      changed = true;
    }

    for (const m of all) {
      if (!m.winnerUserId) continue;

      // ── Loser routing: main R1 → losers bracket. Only on the first
      // bracket round (matches the user's "lose in R1 = drop to losers"
      // rule). R2+ losers are just out.
      if (
        m.bracket === "main" &&
        m.roundIndex === 1 &&
        m.loserNextMatchupId &&
        m.loserNextSide
      ) {
        const loser =
          m.winnerUserId === m.playerAUserId
            ? m.playerBUserId
            : m.winnerUserId === m.playerBUserId
            ? m.playerAUserId
            : null;
        if (loser) {
          const lb = byId.get(m.loserNextMatchupId);
          if (lb) {
            const sideIsA = m.loserNextSide === "a";
            const have = sideIsA ? lb.playerAUserId : lb.playerBUserId;
            if (have !== loser) {
              await db
                .update(matchups)
                .set(
                  sideIsA
                    ? { playerAUserId: loser }
                    : { playerBUserId: loser }
                )
                .where(eq(matchups.id, lb.id));
              changed = true;
            }
          }
        }
      }

      const nextRound = m.roundIndex + 1;
      const nextSlot = Math.floor(m.slot / 2);
      const next = byKey.get(`${m.bracket}:${nextRound}:${nextSlot}`);
      if (!next) continue;
      // The "A" position of the next matchup is filled by the lower-numbered
      // slot of this round (m.slot even -> A, odd -> B).
      const sideIsA = m.slot % 2 === 0;
      const want = m.winnerUserId;
      const have = sideIsA ? next.playerAUserId : next.playerBUserId;
      if (have !== want) {
        await db
          .update(matchups)
          .set(
            sideIsA
              ? { playerAUserId: want }
              : { playerBUserId: want }
          )
          .where(eq(matchups.id, next.id));
        changed = true;
      }

      // Auto-resolve `next` if it now has only one filled side AND the OTHER
      // feeder either doesn't exist (round has odd count → tail bye) or is a
      // genuine empty bye matchup itself.
      const newA = sideIsA ? want : next.playerAUserId;
      const newB = sideIsA ? next.playerBUserId : want;
      const onlyOneSide = (newA && !newB) || (!newA && newB);
      if (next.roundIndex >= 2 && onlyOneSide && !next.winnerUserId) {
        const otherFeederSlot = nextSlot * 2 + (sideIsA ? 1 : 0);
        const otherFeeder = byKey.get(
          `${m.bracket}:${m.roundIndex}:${otherFeederSlot}`
        );
        const otherFeederMissing = !otherFeeder;
        const otherFeederIsEmptyBye =
          !!otherFeeder &&
          otherFeeder.winnerUserId === null &&
          !otherFeeder.playerAUserId &&
          !otherFeeder.playerBUserId;
        if (otherFeederMissing || otherFeederIsEmptyBye) {
          await db
            .update(matchups)
            .set({
              winnerUserId: want,
              resolvedVia: "auto",
              resolvedAt: new Date(),
            })
            .where(eq(matchups.id, next.id));
          changed = true;
        }
      }
    }
    if (!changed) break;
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

  // A single chapter quiz resolves matchups across BOTH brackets that are
  // played simultaneously:
  //   • main bracket roundIndex = chapterNumber
  //   • losers bracket roundIndex = chapterNumber - 1
  // i.e. the chapter that runs main R2 also runs LB R1, chapter 3 runs
  // main R3 + LB R2, etc. There's no LB round during chapter 1 (LB R1
  // doesn't exist until main R1 has produced losers).
  const ms = await db
    .select()
    .from(matchups)
    .where(eq(matchups.tournamentId, tournamentId));
  const inThisChapter = ms.filter(
    (m) =>
      (m.bracket === "main" && m.roundIndex === roundIndex) ||
      (m.bracket === "losers" && m.roundIndex === roundIndex - 1)
  );
  if (inThisChapter.length === 0) return;

  const userIds = new Set<string>();
  for (const m of inThisChapter) {
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

  for (const m of inThisChapter) {
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
