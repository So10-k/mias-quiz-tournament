// Compute Discourse identity for a quiz-site user — group membership
// + display title + primary group — used by the SSO flow so every
// sign-in auto-reconciles forum identity with bracket reality.
//
// Returns:
//   include — groups they belong to (sent as add_groups)
//   exclude — groups they DO NOT belong to but we manage (remove_groups)
//   primaryGroup — their highest-rank group (drives flair colour)
//   title — displayed under their username everywhere they post
//   stats — the underlying numbers, also shipped as custom_fields
//
// Group semantics:
//   players        — currently enrolled AND not eliminated
//   spectators     — eliminated OR never enrolled
//   semi_finalists — appeared in a semifinal matchup ever (lifelong)
//   finalists      — appeared in the final matchup ever (lifelong)
//   champions      — won a tournament outright (lifelong)
//   alumni         — has any enrollment record (lifelong)
//   predictors     — has made any predictions (engagement marker)
//
// Manual grants (authors / mod tiers / regulars) layer on top via
// listGrantsForUser — staff-managed in /host/forum-roles.

import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import {
  listGrantsForUser,
  MANUAL_FORUM_GROUPS,
} from "@/lib/forum-grants";
import {
  computeForumStatsForUser,
  type ForumUserStats,
} from "@/lib/forum-stats";

// Bracket-derived auto groups, split by lifecycle:
//
// • TRANSIENT — flip between two states based on current tournament.
//   Player ↔ spectator is the canonical pair. SSO is allowed to
//   remove these so the flip works correctly.
//
// • LIFELONG — once earned, never revoked. Achievement groups + the
//   "ever participated" tags. SSO will ADD these but NEVER include
//   them in remove_groups. If a future bug in the include
//   computation forgets to push one, the user keeps the group
//   anyway. (Manual revocation via Discourse admin still works.)
const TRANSIENT_BRACKET_GROUPS = ["players", "spectators"] as const;
const LIFELONG_BRACKET_GROUPS = [
  "alumni",
  "predictors",
  "semi_finalists",
  "finalists",
  "champions",
] as const;

// Holding-zone groups — added when a one-time gate hasn't been
// satisfied, removed once the agreement is recorded in the quiz DB.
// Transient by design.
const HOLDING_GROUPS = ["pending_finals_nda"] as const;

// All groups the SSO flow knows about (for include computation).
export const MANAGED_GROUPS = [
  ...TRANSIENT_BRACKET_GROUPS,
  ...LIFELONG_BRACKET_GROUPS,
  ...MANUAL_FORUM_GROUPS,
  ...HOLDING_GROUPS,
] as const;
export type ManagedGroup = (typeof MANAGED_GROUPS)[number];

// Subset SSO is allowed to put in `remove_groups`. Excludes lifelong
// achievement groups — once you've earned `finalists`, `champions`,
// etc., SSO will never strip them.
const REMOVABLE_GROUPS = [
  ...TRANSIENT_BRACKET_GROUPS,
  ...MANUAL_FORUM_GROUPS,
  ...HOLDING_GROUPS,
] as const;
const REMOVABLE_GROUP_SET = new Set<string>(REMOVABLE_GROUPS);

export type BracketGroupResult = {
  include: ManagedGroup[];
  exclude: ManagedGroup[];
  primaryGroup: ManagedGroup | null;
  title: string;
  stats: ForumUserStats;
};

export async function getBracketGroupsForUser(
  userId: string
): Promise<BracketGroupResult> {
  const stats = await computeForumStatsForUser(userId);

  const include: ManagedGroup[] = [];

  // Lifelong tags first.
  if (stats.championships > 0) include.push("champions");

  // Active-tournament status — exactly one of player/spectator.
  if (stats.currentStatus === "still_in") {
    include.push("players");
  } else {
    include.push("spectators");
  }

  // Lifelong "ever played in a tournament" tag. Anyone with a
  // current or past enrollment is alumni — including current
  // players. A current player is also alumni; that's intentional
  // (the alumni group lives on after they're eliminated).
  if (stats.currentStatus !== "not_enrolled") include.push("alumni");

  // Engagement.
  if (stats.predictionCount > 0) include.push("predictors");

  // Bracket-walk groups.
  const tFinalist = await userIsFinalist(userId);
  const tSemiFinalist = await userIsSemiFinalist(userId);

  // Finalist NDA gate: a user is only granted the `finalists` group
  // (which gives access to the Finals Room category) AFTER they've
  // agreed to the confidentiality terms. Until then, they're in
  // `pending_finals_nda` only. This is a server-side access check,
  // not just the client-side JS redirect — Marc et al. can't see
  // Finals Room before agreeing because they lack the actual
  // permission group.
  let ndaAgreed = false;
  if (tFinalist) {
    try {
      const [row] = await db
        .select({ agreedAt: schema.users.finalsNdaAgreedAt })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      ndaAgreed = !!row?.agreedAt;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("finals NDA lookup failed:", err);
    }
  }

  if (tFinalist && ndaAgreed) include.push("finalists");
  if (tFinalist && !ndaAgreed) include.push("pending_finals_nda");
  if (tSemiFinalist) include.push("semi_finalists");

  // Manual grants from /host/forum-roles.
  try {
    const grants = await listGrantsForUser(userId);
    for (const g of grants) {
      if (!include.includes(g as ManagedGroup)) {
        include.push(g as ManagedGroup);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("forum grants lookup failed:", err);
  }

  // Exclude = (REMOVABLE − include). Lifelong achievement groups
  // (finalists, champions, etc.) are never in the removable set, so
  // even if a future bug forgets to push them to include, SSO won't
  // strip them. The user keeps what they've earned, period.
  const exclude = REMOVABLE_GROUPS.filter(
    (g) => !include.includes(g as ManagedGroup) && REMOVABLE_GROUP_SET.has(g)
  ) as ManagedGroup[];

  // Primary group = highest-rank tournament group the user is in.
  // Walks groups in rank order (low → high) and picks the last
  // match. Manual groups never become primary; they layer on for
  // flair/perms but the title comes from tournament rank.
  const RANK_ORDER = [
    ...TRANSIENT_BRACKET_GROUPS,
    ...LIFELONG_BRACKET_GROUPS,
  ] as const;
  let primaryGroup: ManagedGroup | null = null;
  for (const g of RANK_ORDER) {
    if (include.includes(g)) primaryGroup = g;
  }

  return {
    include,
    exclude,
    primaryGroup,
    title: stats.rankTitle,
    stats,
  };
}

// "Finalist" = participating in the WINNERS' bracket final OR the
// LOSERS' bracket final. In a double-elim tournament both feed the
// championship match, so all four players are under finals
// confidentiality. The previous version of this check only walked the
// main bracket — that's how the losers'-bracket finalists (Grandpa et
// al.) silently missed `pending_finals_nda` and never got the
// Discourse NDA PM.
async function userIsFinalist(userId: string): Promise<boolean> {
  const tId = await pickTournamentId();
  if (!tId) return false;
  return (
    (await userIsInBracketFinal(userId, tId, "main")) ||
    (await userIsInBracketFinal(userId, tId, "losers"))
  );
}

// Semi-finalist still walks only the main bracket — the losers'
// bracket structure doesn't have a clean "semi" round (every match
// is elimination), and the existing forum group semantics tie to the
// classic main-bracket semi.
async function userIsSemiFinalist(userId: string): Promise<boolean> {
  const tId = await pickTournamentId();
  if (!tId) return false;
  return await userIsInRoundDelta(userId, 1, tId);
}

async function pickTournamentId(): Promise<string | null> {
  const tRows = await db
    .select({ id: schema.tournaments.id })
    .from(schema.tournaments)
    .orderBy(schema.tournaments.createdAt)
    .limit(1);
  return tRows[0]?.id ?? null;
}

async function userIsInBracketFinal(
  userId: string,
  tournamentId: string,
  bracket: "main" | "losers"
): Promise<boolean> {
  const matchups = await db
    .select()
    .from(schema.matchups)
    .where(
      and(
        eq(schema.matchups.tournamentId, tournamentId),
        eq(schema.matchups.bracket, bracket)
      )
    );
  const maxRound = matchups.reduce(
    (max, m) => Math.max(max, m.roundIndex),
    0
  );
  if (maxRound === 0) return false;
  return matchups.some(
    (m) =>
      m.roundIndex === maxRound &&
      (m.playerAUserId === userId || m.playerBUserId === userId)
  );
}

// Returns true iff the user appears in a matchup `delta` rounds
// before the main-bracket final (delta=1 → semi).
async function userIsInRoundDelta(
  userId: string,
  delta: number,
  tournamentId: string
): Promise<boolean> {
  const matchups = await db
    .select()
    .from(schema.matchups)
    .where(
      and(
        eq(schema.matchups.tournamentId, tournamentId),
        eq(schema.matchups.bracket, "main")
      )
    );
  const maxRound = matchups.reduce(
    (max, m) => Math.max(max, m.roundIndex),
    0
  );
  if (maxRound === 0) return false;
  const target = maxRound - delta;
  if (target <= 0) return false;
  return matchups.some(
    (m) =>
      m.roundIndex === target &&
      (m.playerAUserId === userId || m.playerBUserId === userId)
  );
}
