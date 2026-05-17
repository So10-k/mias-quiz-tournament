// Who can enter /live during finals weekend.
//
// Allowed:
//   - The host (users.role === 'author' — Sam)
//   - The four bracket finalists (players in the deepest matchup of the
//     main and losers brackets of the active tournament)
//   - Any user IDs in app_settings.finals_cohost_user_ids (comma-separated
//     — used for the secret cohost reveal the user wants to announce
//     Wednesday via video; populate this when ready)
//
// Everyone else gets bounced to /watch.

import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { getActiveTournament, getLatestTournament } from "@/lib/engine";

const COHOST_KEY = "finals_cohost_user_ids";

export type FinalsAccess = {
  /** True = this user is allowed into /live (finalist, host, or cohost). */
  allowed: boolean;
  /** Why they're allowed in — drives the badge in the header. */
  role: "host" | "finalist" | "cohost" | "spectator";
  /** Userid list of the four bracket finalists. */
  finalistUserIds: string[];
  /** Userid list of secret cohosts (from app_settings). Empty until set. */
  cohostUserIds: string[];
};

// Deepest matchup of a given bracket = the highest roundIndex (= the final).
// We return both players regardless of whether the matchup is resolved —
// the people who showed up to the live event are whoever's in that matchup.
async function getDeepestMatchupPlayers(args: {
  tournamentId: string;
  bracket: "main" | "losers";
}): Promise<{ matchupId: string | null; userIds: string[] }> {
  const rows = await db
    .select()
    .from(schema.matchups)
    .where(
      and(
        eq(schema.matchups.tournamentId, args.tournamentId),
        eq(schema.matchups.bracket, args.bracket)
      )
    );
  if (rows.length === 0) return { matchupId: null, userIds: [] };
  // The "final" is the matchup at the highest roundIndex. There should be
  // exactly one in a single-elim bracket; if there are several, prefer the
  // one with both player slots filled.
  const maxRoundIndex = rows.reduce(
    (acc, r) => (r.roundIndex > acc ? r.roundIndex : acc),
    0
  );
  const candidates = rows.filter((r) => r.roundIndex === maxRoundIndex);
  const best =
    candidates.find((c) => c.playerAUserId && c.playerBUserId) ??
    candidates[0];
  return {
    matchupId: best.id,
    userIds: [best.playerAUserId, best.playerBUserId].filter(
      (x): x is string => !!x
    ),
  };
}

export async function getWinnersFinalMatchupId(): Promise<string | null> {
  const t = (await getActiveTournament()) ?? (await getLatestTournament());
  if (!t) return null;
  const { matchupId } = await getDeepestMatchupPlayers({
    tournamentId: t.id,
    bracket: "main",
  });
  return matchupId;
}

export async function getLosersFinalMatchupId(): Promise<string | null> {
  const t = (await getActiveTournament()) ?? (await getLatestTournament());
  if (!t) return null;
  const { matchupId } = await getDeepestMatchupPlayers({
    tournamentId: t.id,
    bracket: "losers",
  });
  return matchupId;
}

async function getCohostUserIds(): Promise<string[]> {
  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, COHOST_KEY))
    .limit(1);
  if (!row?.value) return [];
  return row.value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function setCohostUserIds(ids: string[]): Promise<void> {
  const value = ids
    .map((s) => s.trim())
    .filter(Boolean)
    .join(",");
  await db
    .insert(schema.appSettings)
    .values({ key: COHOST_KEY, value })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function getAllFinalistUserIds(): Promise<string[]> {
  const t = (await getActiveTournament()) ?? (await getLatestTournament());
  if (!t) return [];
  const [w, l] = await Promise.all([
    getDeepestMatchupPlayers({ tournamentId: t.id, bracket: "main" }),
    getDeepestMatchupPlayers({ tournamentId: t.id, bracket: "losers" }),
  ]);
  return Array.from(new Set([...w.userIds, ...l.userIds]));
}

export async function evaluateFinalsAccess(args: {
  userId: string | null;
  userRole: "author" | "reader" | null;
}): Promise<FinalsAccess> {
  if (!args.userId) {
    return {
      allowed: false,
      role: "spectator",
      finalistUserIds: [],
      cohostUserIds: [],
    };
  }
  const [finalistUserIds, cohostUserIds] = await Promise.all([
    getAllFinalistUserIds(),
    getCohostUserIds(),
  ]);
  if (args.userRole === "author") {
    return { allowed: true, role: "host", finalistUserIds, cohostUserIds };
  }
  if (cohostUserIds.includes(args.userId)) {
    return { allowed: true, role: "cohost", finalistUserIds, cohostUserIds };
  }
  if (finalistUserIds.includes(args.userId)) {
    return {
      allowed: true,
      role: "finalist",
      finalistUserIds,
      cohostUserIds,
    };
  }
  return {
    allowed: false,
    role: "spectator",
    finalistUserIds,
    cohostUserIds,
  };
}
