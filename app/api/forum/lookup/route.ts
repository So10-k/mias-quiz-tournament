// Quiz-side data for the @lookup forum command.
// Discourse plugin POSTs an HMAC-signed JSON body of the form:
//   { "identifier": "<email|external_id>" }
// We resolve to a quiz-site user (by email OR id) and return a
// structured payload of everything an admin would want at-a-glance:
//   • core profile (name, role, created_at)
//   • current tournament status (still in / eliminated / spectator)
//   • lifetime stats (matches, wins, championships, predictions)
//   • blocklist status (is their last-seen IP blocked?)
//   • recent staff actions taken on them
//
// If the identifier is an email that doesn't match any user, we
// return ok:true with `found:false` so the plugin can still post a
// useful "no quiz-site account found" line.

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { computeForumStatsForUser } from "@/lib/forum-stats";
import { listGrantsForUser } from "@/lib/forum-grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyHmac(rawBody: string, signature: string): boolean {
  const secret = process.env.DISCOURSE_SSO_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-quizbook-signature") ?? "";
  if (!verifyHmac(raw, sig)) {
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 }
    );
  }

  let body: { identifier?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json" },
      { status: 400 }
    );
  }
  const identifier = (body.identifier ?? "").trim();
  if (!identifier) {
    return NextResponse.json(
      { ok: false, error: "identifier required" },
      { status: 400 }
    );
  }

  // Resolve user. Try id first (UUIDs + short ids), then email.
  let user = await findUserByIdOrEmail(identifier);
  if (!user) {
    return NextResponse.json({ ok: true, found: false, identifier });
  }

  // Tournament + bracket stats — same path the SSO uses.
  let stats: Awaited<ReturnType<typeof computeForumStatsForUser>> | null =
    null;
  try {
    stats = await computeForumStatsForUser(user.id);
  } catch {
    // Non-fatal — caller still gets the basics.
  }

  // Manual forum-role grants from /host/forum-roles.
  let grants: string[] = [];
  try {
    grants = await listGrantsForUser(user.id);
  } catch {}

  // Recent support tickets they've submitted.
  const tickets = await db
    .select({
      id: schema.supportTickets.discourseTopicId,
      subject: schema.supportTickets.subject,
      status: schema.supportTickets.status,
      createdAt: schema.supportTickets.createdAt,
    })
    .from(schema.supportTickets)
    .where(eq(schema.supportTickets.submitterUserId, user.id))
    .orderBy(desc(schema.supportTickets.createdAt))
    .limit(5);

  // Latest visit IP — useful to spot blocked users.
  const [latestVisit] = await db
    .select({
      ip: schema.visitLogs.ip,
      country: schema.visitLogs.country,
      region: schema.visitLogs.region,
      city: schema.visitLogs.city,
      createdAt: schema.visitLogs.createdAt,
    })
    .from(schema.visitLogs)
    .where(eq(schema.visitLogs.userId, user.id))
    .orderBy(desc(schema.visitLogs.createdAt))
    .limit(1);

  let ipBlocked = false;
  if (latestVisit?.ip) {
    const [blk] = await db
      .select({ id: schema.blockedIps.id })
      .from(schema.blockedIps)
      .where(eq(schema.blockedIps.ip, latestVisit.ip))
      .limit(1);
    ipBlocked = !!blk;
  }

  return NextResponse.json({
    ok: true,
    found: true,
    profile: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.createdAt.toISOString(),
    },
    forum: {
      manual_grants: grants,
    },
    tournament: stats
      ? {
          rank_title: stats.rankTitle,
          rank_group: stats.rankGroup,
          status: stats.currentStatus,
          championships: stats.championships,
          total_wins: stats.totalWins,
          total_matches: stats.totalMatches,
          furthest_round: stats.furthestRound,
          eliminated_in_round: stats.eliminatedInRound,
          prediction_count: stats.predictionCount,
          qotd_answers: stats.qotdAnswers,
        }
      : null,
    last_visit: latestVisit
      ? {
          at: latestVisit.createdAt.toISOString(),
          ip: latestVisit.ip,
          city: latestVisit.city,
          region: latestVisit.region,
          country: latestVisit.country,
          ip_blocked: ipBlocked,
        }
      : null,
    recent_tickets: tickets.map((t) => ({
      topic_id: t.id,
      subject: t.subject,
      status: t.status,
      created_at: t.createdAt.toISOString(),
    })),
  });
}

async function findUserByIdOrEmail(
  identifier: string
): Promise<typeof schema.users.$inferSelect | null> {
  // Try id match first.
  const [byId] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, identifier))
    .limit(1);
  if (byId) return byId;
  // Then case-insensitive email.
  const [byEmail] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, identifier.toLowerCase()))
    .limit(1);
  return byEmail ?? null;
}
