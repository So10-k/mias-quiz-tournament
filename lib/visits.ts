import { db, schema } from "@/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { id as makeId } from "./ids";

const { visitLogs, users } = schema;

export type LogVisitInput = {
  fingerprint: string;
  userId: string | null;
  path: string;
  referrer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  timezone?: string | null;
  language?: string | null;
  screen?: string | null;
};

export async function logVisit(input: LogVisitInput) {
  await db.insert(visitLogs).values({
    id: makeId(),
    fingerprint: input.fingerprint,
    userId: input.userId,
    path: input.path.slice(0, 400),
    referrer: input.referrer?.slice(0, 400) ?? null,
    userAgent: input.userAgent?.slice(0, 400) ?? null,
    ip: input.ip ?? null,
    country: input.country?.slice(0, 4) ?? null,
    region: input.region?.slice(0, 64) ?? null,
    city: input.city?.slice(0, 80) ?? null,
    timezone: input.timezone?.slice(0, 80) ?? null,
    language: input.language?.slice(0, 32) ?? null,
    screen: input.screen?.slice(0, 32) ?? null,
  });
}

// One row per fingerprint with summary info — used for the host panel list.
export type VisitorSummary = {
  fingerprint: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  visits: number;
  lastSeen: Date;
  firstSeen: Date;
  country: string | null;
  city: string | null;
  ip: string | null;
  userAgent: string | null;
};

export async function listVisitors(): Promise<VisitorSummary[]> {
  // Group by fingerprint, take latest user/geo info, count visits.
  const rows = await db.execute<{
    fingerprint: string;
    user_id: string | null;
    user_name: string | null;
    user_email: string | null;
    visits: number;
    last_seen: string;
    first_seen: string;
    country: string | null;
    city: string | null;
    ip: string | null;
    user_agent: string | null;
  }>(sql`
    select
      v.fingerprint,
      max(v.user_id::text) as user_id,
      max(u.name) as user_name,
      max(u.email) as user_email,
      count(*)::int as visits,
      max(v.created_at) as last_seen,
      min(v.created_at) as first_seen,
      (array_agg(v.country order by v.created_at desc))[1] as country,
      (array_agg(v.city    order by v.created_at desc))[1] as city,
      (array_agg(v.ip      order by v.created_at desc))[1] as ip,
      (array_agg(v.user_agent order by v.created_at desc))[1] as user_agent
    from visit_logs v
    left join users u on u.id = v.user_id
    group by v.fingerprint
    order by max(v.created_at) desc
    limit 200
  `);
  // Drizzle's `db.execute` returns a result with `.rows` on the neon-http
  // adapter; normalise.
  const data: any = (rows as any).rows ?? rows;
  return (data as any[]).map((r) => ({
    fingerprint: r.fingerprint,
    userId: r.user_id,
    userName: r.user_name,
    userEmail: r.user_email,
    visits: Number(r.visits ?? 0),
    lastSeen: new Date(r.last_seen),
    firstSeen: new Date(r.first_seen),
    country: r.country,
    city: r.city,
    ip: r.ip,
    userAgent: r.user_agent,
  }));
}

export async function getVisitorTimeline(fingerprint: string, limit = 200) {
  return db
    .select()
    .from(visitLogs)
    .where(eq(visitLogs.fingerprint, fingerprint))
    .orderBy(desc(visitLogs.createdAt))
    .limit(limit);
}

export async function getUserVisits(userId: string, limit = 200) {
  return db
    .select()
    .from(visitLogs)
    .where(eq(visitLogs.userId, userId))
    .orderBy(desc(visitLogs.createdAt))
    .limit(limit);
}

// Used by the host panel "by user" view — every signed-in user with their
// total visits, last-seen timestamp, and known fingerprints.
export async function listUserSummaries() {
  const rows = await db.execute<{
    user_id: string;
    name: string | null;
    email: string;
    visits: number;
    last_seen: string;
    first_seen: string;
    fingerprints: string[];
  }>(sql`
    select
      u.id as user_id,
      u.name,
      u.email,
      count(v.id)::int as visits,
      max(v.created_at) as last_seen,
      min(v.created_at) as first_seen,
      array_agg(distinct v.fingerprint) filter (where v.fingerprint is not null) as fingerprints
    from users u
    left join visit_logs v on v.user_id = u.id
    group by u.id, u.name, u.email
    having count(v.id) > 0
    order by max(v.created_at) desc nulls last
    limit 200
  `);
  void users;
  const data: any = (rows as any).rows ?? rows;
  return (data as any[]).map((r) => ({
    userId: r.user_id as string,
    name: r.name as string | null,
    email: r.email as string,
    visits: Number(r.visits ?? 0),
    lastSeen: r.last_seen ? new Date(r.last_seen) : null,
    firstSeen: r.first_seen ? new Date(r.first_seen) : null,
    fingerprints: (r.fingerprints ?? []) as string[],
  }));
}

void and;
