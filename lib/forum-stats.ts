// Per-user tournament stats fed into Discourse on every SSO login as
// `custom_fields[*]`. Lets the forum render game-state-aware UI (stats
// card on profile, title, post-byline tournament badge) without making
// extra API calls back to the quiz site at request time.
//
// Why custom_fields and not user_fields: user_fields require admin
// pre-creation in Discourse and don't auto-update from SSO add_groups
// payloads. custom_fields are arbitrary key/value pairs Discourse
// stores on the User model; the bridge plugin reads them in
// /u/<name>.json and our profile-card outlet renders them.

import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";

export type ForumUserStats = {
  // Lifetime: number of bracket matches the user has won across all
  // tournaments. Counts both main + losers bracket wins.
  totalWins: number;
  // Lifetime: number of bracket matches they appeared in (regardless
  // of outcome). totalWins / totalMatches = win rate, but we leave
  // the division to the renderer.
  totalMatches: number;
  // Lifetime: number of tournaments the user won outright (their
  // userId on tournaments.winnerUserId).
  championships: number;
  // Active-tournament status — `still_in`, `eliminated`, `not_enrolled`.
  // Drives the byline badge ("⚔️ Still in" / "💀 Eliminated R2").
  currentStatus: "still_in" | "eliminated" | "not_enrolled";
  // Round number they were eliminated in (1-indexed). Null = still in
  // OR never enrolled. Distinguished by currentStatus.
  eliminatedInRound: number | null;
  // Best round they've reached this tournament. Null if never enrolled.
  furthestRound: number | null;
  // Number of predictions they've ever made (signal of engagement).
  predictionCount: number;
  // QOTD answers they've submitted. Mostly for fun.
  qotdAnswers: number;
  // The display title surfaced everywhere the user posts. Picked
  // from highest achievement (champion > finalist > … > spectator).
  rankTitle: string;
  // Group name corresponding to rankTitle — used as primary_group on
  // Discourse so flair lines up with title.
  rankGroup:
    | "champions"
    | "finalists"
    | "semi_finalists"
    | "players"
    | "alumni"
    | "spectators";
};

export async function computeForumStatsForUser(
  userId: string
): Promise<ForumUserStats> {
  const t =
    (await getActiveTournament()) ?? (await getLatestTournament());

  // ── Lifetime: bracket-match wins + total appearances ─────────
  // Cheap to compute — single scan of `matchups` filtered by user.
  // No tournament-id filter so we count across history.
  const allMatchups = await db
    .select()
    .from(schema.matchups)
    .where(eq(schema.matchups.tournamentId, t?.id ?? "__none__"));
  // For multi-tournament history we'd want a separate query, but
  // currently we only ever have one tournament loaded, so this
  // collapses to "current tournament's matchups". Once history
  // accumulates we can drop the WHERE clause and aggregate.
  let totalMatches = 0;
  let totalWins = 0;
  let furthestRound: number | null = null;
  for (const m of allMatchups) {
    if (m.playerAUserId === userId || m.playerBUserId === userId) {
      totalMatches += 1;
      furthestRound = Math.max(furthestRound ?? 0, m.roundIndex);
      if (m.winnerUserId === userId) totalWins += 1;
    }
  }
  if (furthestRound === 0) furthestRound = null;

  // ── Lifetime: championships ─────────────────────────────────
  const champRows = await db
    .select({ id: schema.tournaments.id })
    .from(schema.tournaments)
    .where(eq(schema.tournaments.winnerUserId, userId));
  const championships = champRows.length;

  // ── Active-tournament status + elimination round ────────────
  let currentStatus: ForumUserStats["currentStatus"] = "not_enrolled";
  let eliminatedInRound: number | null = null;
  let isFinalist = false;
  let isSemiFinalist = false;
  if (t) {
    const [enr] = await db
      .select({
        eliminatedAt: schema.enrollments.eliminatedAt,
        eliminatedInRoundId: schema.enrollments.eliminatedInRoundId,
      })
      .from(schema.enrollments)
      .where(
        and(
          eq(schema.enrollments.tournamentId, t.id),
          eq(schema.enrollments.userId, userId)
        )
      )
      .limit(1);
    if (enr) {
      currentStatus = enr.eliminatedAt ? "eliminated" : "still_in";
      // Resolve roundId → chapterNumber to surface a number not a UUID.
      if (enr.eliminatedInRoundId) {
        const [r] = await db
          .select({ chapterNumber: schema.rounds.chapterNumber })
          .from(schema.rounds)
          .where(eq(schema.rounds.id, enr.eliminatedInRoundId))
          .limit(1);
        eliminatedInRound = r?.chapterNumber ?? null;
      }
    }

    // Compute finalist/semifinalist for title selection.
    const mainMatchups = allMatchups.filter((m) => m.bracket === "main");
    const maxRound = mainMatchups.reduce(
      (max, m) => Math.max(max, m.roundIndex),
      0
    );
    const semiRound = Math.max(maxRound - 1, 0);
    for (const m of mainMatchups) {
      const inThis =
        m.playerAUserId === userId || m.playerBUserId === userId;
      if (!inThis) continue;
      if (m.roundIndex === maxRound && maxRound > 0) isFinalist = true;
      if (m.roundIndex === semiRound && semiRound > 0)
        isSemiFinalist = true;
    }
  }

  // ── Engagement counters ─────────────────────────────────────
  const predictionRows = await db
    .select({ id: schema.predictions.id })
    .from(schema.predictions)
    .where(eq(schema.predictions.userId, userId));
  const qotdRows = await db
    .select({ id: schema.qotdResponses.id })
    .from(schema.qotdResponses)
    .where(eq(schema.qotdResponses.userId, userId));

  // ── Title / primary group derivation ─────────────────────────
  // Highest-priority achievement wins. Champions persists across
  // seasons so a past winner keeps their crown even when the active
  // tournament has them as a spectator.
  let rankTitle: string;
  let rankGroup: ForumUserStats["rankGroup"];
  if (championships > 0) {
    rankTitle =
      championships > 1
        ? `🏆 ${championships}× Champion`
        : "🏆 Tournament Champion";
    rankGroup = "champions";
  } else if (isFinalist) {
    rankTitle = "🥈 Finalist";
    rankGroup = "finalists";
  } else if (isSemiFinalist) {
    rankTitle = "🥉 Semifinalist";
    rankGroup = "semi_finalists";
  } else if (currentStatus === "still_in") {
    rankTitle = "⚔️ Active Player";
    rankGroup = "players";
  } else if (currentStatus === "eliminated") {
    rankTitle = "📚 Alumnus";
    rankGroup = "alumni";
  } else {
    rankTitle = "👀 Spectator";
    rankGroup = "spectators";
  }

  return {
    totalWins,
    totalMatches,
    championships,
    currentStatus,
    eliminatedInRound,
    furthestRound,
    predictionCount: predictionRows.length,
    qotdAnswers: qotdRows.length,
    rankTitle,
    rankGroup,
  };
}
