// Intercom Messenger boot + JWT-based identity verification.
//
// Intercom deprecated the old HMAC identity-secret in 2024 — secure
// mode now requires a JWT signed with the Messenger API secret. We
// sign one per request (HS256) carrying the user_id + a short exp,
// pass it as `intercom_user_jwt` on intercomSettings, and Intercom
// verifies it server-side before letting the user into the inbox.
//
// Env required (set in Vercel):
//   INTERCOM_APP_ID            — workspace id (visible to the browser)
//   INTERCOM_JWT_SECRET        — Messenger API secret key. Intercom
//                                dashboard → Settings → Security →
//                                Identity Verification (Web) →
//                                "Generate JWT secret".
//                                Server-only — never bundled.
//   INTERCOM_IDENTITY_SECRET   — DEPRECATED legacy HMAC secret. If
//                                only this is set we still emit a
//                                `user_hash` for backwards-compat
//                                workspaces.
//
// When the app id is missing the helper returns null and IntercomBoot
// renders nothing — site keeps working with no Messenger.

import { createHmac } from "node:crypto";
import { SignJWT } from "jose";
import { db, schema } from "@/db";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { SessionUser } from "@/lib/session";
import { computeForumStatsForUser } from "@/lib/forum-stats";
import { getAllFinalistUserIds } from "@/lib/finals-access";

export type IntercomBoot = {
  appId: string;
  /** Settings the client merges into window.intercomSettings before
      loading the widget. Includes user_id, user_hash (HMAC), name,
      email, plus the tournament-derived custom attributes. */
  settings: Record<string, unknown>;
};

// True iff the workspace is configured. Use this from page components
// that want to short-circuit when Intercom isn't on.
export function intercomEnabled(): boolean {
  return !!process.env.INTERCOM_APP_ID;
}

// Anonymous boot — used for logged-out visitors. No user_hash because
// there's nobody to identify. We still pass `app_id` so the visitor
// stream shows up in Intercom (and Sam can chat with anonymous folks).
export function computeAnonymousIntercomBoot(): IntercomBoot | null {
  const appId = process.env.INTERCOM_APP_ID;
  if (!appId) return null;
  return {
    appId,
    settings: { app_id: appId },
  };
}

// Signed-in boot. Pulls fresh tournament status + role flags so the
// custom attributes match the user's CURRENT state on every page load.
export async function computeIntercomBootForUser(
  user: SessionUser
): Promise<IntercomBoot | null> {
  const appId = process.env.INTERCOM_APP_ID;
  if (!appId) return null;

  // Sign a JWT (Intercom's current "secure mode") OR fall back to
  // the legacy HMAC identity hash if the workspace hasn't migrated.
  let identity: { intercom_user_jwt?: string; user_hash?: string } = {};
  const jwtSecret = process.env.INTERCOM_JWT_SECRET;
  const hmacSecret = process.env.INTERCOM_IDENTITY_SECRET;
  if (jwtSecret) {
    try {
      identity.intercom_user_jwt = await signIntercomJwt({
        userId: user.id,
        email: user.email ?? undefined,
        secret: jwtSecret,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("intercom: JWT sign failed:", err);
    }
  } else if (hmacSecret) {
    identity.user_hash = createHmac("sha256", hmacSecret)
      .update(user.id)
      .digest("hex");
  }

  // Pull the bits we want as custom attributes. Failures here are
  // non-fatal — Intercom boots fine without the extras, so swallow
  // and log rather than break the page.
  let attrs: Record<string, unknown> = {};
  try {
    attrs = await assembleAttributes(user.id);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("intercom: attribute computation failed:", err);
  }

  return {
    appId,
    settings: {
      app_id: appId,
      user_id: user.id,
      ...identity,
      name: user.name ?? undefined,
      email: user.email ?? undefined,
      // Site role flag — Intercom segments can target authors vs
      // readers separately.
      role: user.role,
      ...attrs,
    },
  };
}

// Sign an Intercom JWT per their secure-mode docs. HS256, claims
// include user_id (and email if available), valid for 1 hour. Tokens
// are minted per-request so a stolen one expires fast.
async function signIntercomJwt(args: {
  userId: string;
  email?: string;
  secret: string;
}): Promise<string> {
  const key = new TextEncoder().encode(args.secret);
  const builder = new SignJWT({
    user_id: args.userId,
    ...(args.email ? { email: args.email } : {}),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h");
  return builder.sign(key);
}

// ────────────────────────────────────────────────────────────────────
// Tournament-state + engagement custom attributes. Surface in the
// Intercom inbox as filterable columns + audience segments. Every
// query runs in parallel via Promise.allSettled so a single slow / bad
// query never tanks the boot.
// ────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

async function assembleAttributes(
  userId: string
): Promise<Record<string, unknown>> {
  // Fan out every read at once. Order corresponds to the destructuring
  // below; keep them aligned.
  const results = await Promise.allSettled([
    computeForumStatsForUser(userId),
    getAllFinalistUserIds(),
    predictionStats(userId),
    strikeAndEnrollment(userId),
    nextRoundOpens(userId),
    lastAttempt(userId),
    forumActivity(userId),
    newsletterFor(userId),
    emailEngagement30d(userId),
    supportTicketCounts(userId),
    visitorGeo(userId),
    ndaStatus(userId),
    visitTotals(userId),
    currentMatchupContext(userId),
  ]);
  const value = <T>(i: number, fallback: T): T =>
    results[i].status === "fulfilled"
      ? ((results[i] as PromiseFulfilledResult<T>).value as T)
      : fallback;

  const stats = value(0, null as ReturnType<
    typeof computeForumStatsForUser
  > extends Promise<infer R>
    ? R | null
    : never);
  const finalistIds = value<string[]>(1, []);
  const preds = value(2, { made: 0, correct: 0 });
  const strikes = value(3, {
    strike_count: 0,
    strike_limit: 0,
    on_brink: false,
  });
  const nextRound = value<{
    next_round_opens_at?: string;
    days_until_next_round?: number;
    next_round_chapter?: number;
  }>(4, {});
  const lastA = value<{
    last_attempt_at?: string;
    days_since_last_attempt?: number;
    last_attempt_passed?: boolean;
    last_attempt_score?: number;
  }>(5, {});
  const forum = value(6, { forum_posts_in_app: 0 });
  const news = value<{
    newsletter_subscribed?: boolean;
    newsletter_frequency?: string;
  }>(7, {});
  const email = value(8, {
    email_sends_30d: 0,
    email_opens_30d: 0,
    email_clicks_30d: 0,
  });
  const support = value(9, {
    support_tickets_open: 0,
    support_tickets_total: 0,
  });
  const geo = value<{
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
  }>(10, {});
  const nda = value<{ finals_nda_agreed?: boolean; finals_nda_agreed_at?: string }>(
    11,
    {}
  );
  const visits = value<{ visit_count?: number; first_seen_at?: string }>(
    12,
    {}
  );
  const matchup = value<{
    current_bracket?: string;
    current_matchup_id?: string;
    current_matchup_opponent?: string;
  }>(13, {});

  const isFinalist = stats ? finalistIds.includes(userId) : false;
  const predAccuracy =
    preds.made > 0 ? Math.round((preds.correct / preds.made) * 100) : 0;

  return {
    // ─── strings/enums (faceted filters) ────────────────────────
    site_role: stats?.rankTitle ?? "Visitor",
    rank_group: stats?.rankGroup ?? "spectators",
    tournament_status: stats?.currentStatus ?? "not_enrolled",
    ...(matchup.current_bracket
      ? { current_bracket: matchup.current_bracket }
      : {}),
    ...(matchup.current_matchup_opponent
      ? { current_matchup_opponent: matchup.current_matchup_opponent }
      : {}),
    ...(matchup.current_matchup_id
      ? { current_matchup_id: matchup.current_matchup_id }
      : {}),
    ...(geo.country ? { country: geo.country } : {}),
    ...(geo.region ? { region: geo.region } : {}),
    ...(geo.city ? { city: geo.city } : {}),
    ...(geo.timezone ? { timezone: geo.timezone } : {}),
    ...(news.newsletter_frequency
      ? { newsletter_frequency: news.newsletter_frequency }
      : {}),

    // ─── booleans (great for inbox filters + outbound audiences) ─
    is_finalist: isFinalist,
    is_eliminated: stats?.currentStatus === "eliminated",
    is_active_player: stats?.currentStatus === "still_in",
    is_champion: (stats?.championships ?? 0) > 0,
    on_brink_of_elimination: strikes.on_brink,
    is_in_active_match: !!matchup.current_matchup_id,
    finals_nda_agreed: !!nda.finals_nda_agreed,
    newsletter_subscribed: !!news.newsletter_subscribed,
    has_open_support_ticket: support.support_tickets_open > 0,

    // ─── counts ─────────────────────────────────────────────────
    total_wins: stats?.totalWins ?? 0,
    total_matches: stats?.totalMatches ?? 0,
    furthest_round: stats?.furthestRound ?? 0,
    eliminated_in_round: stats?.eliminatedInRound ?? 0,
    predictions_made: preds.made,
    predictions_correct: preds.correct,
    prediction_accuracy_pct: predAccuracy,
    qotd_answers: stats?.qotdAnswers ?? 0,
    strike_count: strikes.strike_count,
    strikes_remaining: Math.max(
      0,
      (strikes.strike_limit ?? 0) - (strikes.strike_count ?? 0)
    ),
    forum_posts_in_app: forum.forum_posts_in_app,
    email_sends_30d: email.email_sends_30d,
    email_opens_30d: email.email_opens_30d,
    email_clicks_30d: email.email_clicks_30d,
    support_tickets_open: support.support_tickets_open,
    support_tickets_total: support.support_tickets_total,
    visit_count: visits.visit_count ?? 0,
    ...(nextRound.next_round_chapter !== undefined
      ? { next_round_chapter: nextRound.next_round_chapter }
      : {}),
    ...(nextRound.days_until_next_round !== undefined
      ? { days_until_next_round: nextRound.days_until_next_round }
      : {}),
    ...(lastA.days_since_last_attempt !== undefined
      ? { days_since_last_attempt: lastA.days_since_last_attempt }
      : {}),
    ...(lastA.last_attempt_score !== undefined
      ? { last_attempt_score: lastA.last_attempt_score }
      : {}),
    ...(lastA.last_attempt_passed !== undefined
      ? { last_attempt_passed: lastA.last_attempt_passed }
      : {}),

    // ─── timestamps (ISO strings — Intercom auto-parses) ────────
    ...(nextRound.next_round_opens_at
      ? { next_round_opens_at: nextRound.next_round_opens_at }
      : {}),
    ...(lastA.last_attempt_at ? { last_attempt_at: lastA.last_attempt_at } : {}),
    ...(visits.first_seen_at ? { first_seen_at: visits.first_seen_at } : {}),
    ...(nda.finals_nda_agreed_at
      ? { finals_nda_agreed_at: nda.finals_nda_agreed_at }
      : {}),
  };
}

// ─── Individual attribute fetchers (each owns one query path) ──────

async function predictionStats(
  userId: string
): Promise<{ made: number; correct: number }> {
  const [row] = await db
    .select({
      made: sql<number>`count(*)::int`,
      correct: sql<number>`count(*) filter (where ${schema.predictions.predictedWinnerUserId} = ${schema.matchups.winnerUserId})::int`,
    })
    .from(schema.predictions)
    .leftJoin(
      schema.matchups,
      eq(schema.matchups.id, schema.predictions.matchupId)
    )
    .where(eq(schema.predictions.userId, userId));
  return { made: row?.made ?? 0, correct: row?.correct ?? 0 };
}

async function strikeAndEnrollment(userId: string): Promise<{
  strike_count: number;
  strike_limit: number;
  on_brink: boolean;
}> {
  const [row] = await db
    .select({
      strikeCount: schema.enrollments.strikeCount,
      strikeLimit: schema.tournaments.strikeLimit,
      eliminatedAt: schema.enrollments.eliminatedAt,
    })
    .from(schema.enrollments)
    .innerJoin(
      schema.tournaments,
      eq(schema.tournaments.id, schema.enrollments.tournamentId)
    )
    .where(eq(schema.enrollments.userId, userId))
    .orderBy(desc(schema.enrollments.registeredAt))
    .limit(1);
  if (!row) return { strike_count: 0, strike_limit: 0, on_brink: false };
  const eliminated = !!row.eliminatedAt;
  return {
    strike_count: row.strikeCount ?? 0,
    strike_limit: row.strikeLimit ?? 0,
    on_brink:
      !eliminated &&
      (row.strikeCount ?? 0) >= Math.max(0, (row.strikeLimit ?? 1) - 1),
  };
}

async function nextRoundOpens(userId: string): Promise<{
  next_round_opens_at?: string;
  days_until_next_round?: number;
  next_round_chapter?: number;
}> {
  // The next draft/active round in the user's tournament that hasn't
  // opened yet (or has just opened).
  const [enrollment] = await db
    .select({ tournamentId: schema.enrollments.tournamentId })
    .from(schema.enrollments)
    .where(eq(schema.enrollments.userId, userId))
    .orderBy(desc(schema.enrollments.registeredAt))
    .limit(1);
  if (!enrollment) return {};
  const now = new Date();
  const [r] = await db
    .select({
      chapter: schema.rounds.chapterNumber,
      opensAt: schema.rounds.opensAt,
    })
    .from(schema.rounds)
    .where(
      and(
        eq(schema.rounds.tournamentId, enrollment.tournamentId),
        eq(schema.rounds.isPractice, false),
        gt(schema.rounds.opensAt, now)
      )
    )
    .orderBy(schema.rounds.opensAt)
    .limit(1);
  if (!r?.opensAt) return {};
  const days = Math.max(
    0,
    Math.round((r.opensAt.getTime() - now.getTime()) / DAY_MS)
  );
  return {
    next_round_opens_at: r.opensAt.toISOString(),
    days_until_next_round: days,
    next_round_chapter: r.chapter,
  };
}

async function lastAttempt(userId: string): Promise<{
  last_attempt_at?: string;
  days_since_last_attempt?: number;
  last_attempt_passed?: boolean;
  last_attempt_score?: number;
}> {
  const [row] = await db
    .select({
      submittedAt: schema.attempts.submittedAt,
      score: schema.attempts.score,
      passed: schema.attempts.passed,
    })
    .from(schema.attempts)
    .where(eq(schema.attempts.userId, userId))
    .orderBy(desc(schema.attempts.submittedAt))
    .limit(1);
  if (!row?.submittedAt) return {};
  const days = Math.round(
    (Date.now() - row.submittedAt.getTime()) / DAY_MS
  );
  return {
    last_attempt_at: row.submittedAt.toISOString(),
    days_since_last_attempt: days,
    last_attempt_passed: !!row.passed,
    last_attempt_score:
      row.score != null ? Math.round(Number(row.score) * 100) / 100 : undefined,
  };
}

async function forumActivity(
  userId: string
): Promise<{ forum_posts_in_app: number }> {
  // Manual forum group grants are a proxy for "actively earning a
  // mod-tier role" — better signal than nothing while we don't have
  // a direct post-count mirror from Discourse.
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.forumGroupGrants)
    .where(eq(schema.forumGroupGrants.userId, userId));
  return { forum_posts_in_app: row?.c ?? 0 };
}

async function newsletterFor(userId: string): Promise<{
  newsletter_subscribed?: boolean;
  newsletter_frequency?: string;
}> {
  const [row] = await db
    .select({
      frequency: schema.newsletterSubscriptions.frequency,
      confirmedAt: schema.newsletterSubscriptions.confirmedAt,
      unsubscribedAt: schema.newsletterSubscriptions.unsubscribedAt,
    })
    .from(schema.newsletterSubscriptions)
    .where(eq(schema.newsletterSubscriptions.userId, userId))
    .limit(1);
  if (!row) return { newsletter_subscribed: false };
  const subscribed = !!row.confirmedAt && !row.unsubscribedAt;
  return {
    newsletter_subscribed: subscribed,
    newsletter_frequency: subscribed ? row.frequency : undefined,
  };
}

async function emailEngagement30d(userId: string): Promise<{
  email_sends_30d: number;
  email_opens_30d: number;
  email_clicks_30d: number;
}> {
  const cutoff = new Date(Date.now() - 30 * DAY_MS);
  const [send] = await db
    .select({
      sends: sql<number>`count(*)::int`,
      opens: sql<number>`count(*) filter (where ${schema.emailSends.openedAt} is not null)::int`,
    })
    .from(schema.emailSends)
    .where(
      and(
        eq(schema.emailSends.recipientUserId, userId),
        gt(schema.emailSends.sentAt, cutoff)
      )
    );
  const [click] = await db
    .select({ c: sql<number>`count(distinct ${schema.emailClicks.sendId})::int` })
    .from(schema.emailClicks)
    .innerJoin(
      schema.emailSends,
      eq(schema.emailSends.id, schema.emailClicks.sendId)
    )
    .where(
      and(
        eq(schema.emailSends.recipientUserId, userId),
        gt(schema.emailClicks.clickedAt, cutoff)
      )
    );
  return {
    email_sends_30d: send?.sends ?? 0,
    email_opens_30d: send?.opens ?? 0,
    email_clicks_30d: click?.c ?? 0,
  };
}

async function supportTicketCounts(userId: string): Promise<{
  support_tickets_open: number;
  support_tickets_total: number;
}> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where ${schema.supportTickets.status} in ('open','pending'))::int`,
    })
    .from(schema.supportTickets)
    .where(eq(schema.supportTickets.submitterUserId, userId));
  return {
    support_tickets_open: row?.open ?? 0,
    support_tickets_total: row?.total ?? 0,
  };
}

async function visitorGeo(userId: string): Promise<{
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
}> {
  // Most recent geo we have for this user — drives timezone-aware
  // outbound + geo segments in Intercom.
  const [row] = await db
    .select({
      country: schema.visitLogs.country,
      region: schema.visitLogs.region,
      city: schema.visitLogs.city,
      timezone: schema.visitLogs.timezone,
    })
    .from(schema.visitLogs)
    .where(eq(schema.visitLogs.userId, userId))
    .orderBy(desc(schema.visitLogs.createdAt))
    .limit(1);
  return {
    country: row?.country ?? undefined,
    region: row?.region ?? undefined,
    city: row?.city ?? undefined,
    timezone: row?.timezone ?? undefined,
  };
}

async function ndaStatus(userId: string): Promise<{
  finals_nda_agreed?: boolean;
  finals_nda_agreed_at?: string;
}> {
  const [row] = await db
    .select({ at: schema.users.finalsNdaAgreedAt })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!row?.at) return { finals_nda_agreed: false };
  return {
    finals_nda_agreed: true,
    finals_nda_agreed_at: row.at.toISOString(),
  };
}

async function visitTotals(
  userId: string
): Promise<{ visit_count?: number; first_seen_at?: string }> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      first: sql<Date>`min(${schema.visitLogs.createdAt})`,
    })
    .from(schema.visitLogs)
    .where(eq(schema.visitLogs.userId, userId));
  return {
    visit_count: row?.count ?? 0,
    first_seen_at: row?.first
      ? new Date(row.first).toISOString()
      : undefined,
  };
}

async function currentMatchupContext(userId: string): Promise<{
  current_bracket?: string;
  current_matchup_id?: string;
  current_matchup_opponent?: string;
}> {
  // The deepest unresolved matchup in either bracket where the user
  // is one of the two seated players. Drives the "your next match is
  // X" outbound trigger.
  const rows = await db
    .select({
      id: schema.matchups.id,
      bracket: schema.matchups.bracket,
      a: schema.matchups.playerAUserId,
      b: schema.matchups.playerBUserId,
      winner: schema.matchups.winnerUserId,
      round: schema.matchups.roundIndex,
    })
    .from(schema.matchups)
    .where(isNull(schema.matchups.winnerUserId));
  const mine = rows.filter(
    (r) => r.a === userId || r.b === userId
  );
  if (mine.length === 0) return {};
  // Pick the deepest (highest roundIndex) — that's the user's "next"
  // match to worry about.
  mine.sort((a, b) => b.round - a.round);
  const m = mine[0];
  const opponentId = m.a === userId ? m.b : m.a;
  let opponentName: string | undefined;
  if (opponentId) {
    const [u] = await db
      .select({ name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, opponentId))
      .limit(1);
    opponentName = u?.name ?? u?.email ?? undefined;
  }
  return {
    current_bracket: m.bracket,
    current_matchup_id: m.id,
    current_matchup_opponent: opponentName,
  };
}
