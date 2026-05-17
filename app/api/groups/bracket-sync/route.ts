// Endpoint that returns per-user desired group membership based on
// the current tournament bracket. Consumed by Discourse's
// sync-bracket-groups.rb rails-runner script to keep the forum's
// `players` / `semi_finalists` / `finalists` groups in lockstep with
// the bracket on the quiz site.
//
// Auth: shared bearer secret. We re-use DISCOURSE_SSO_SECRET so we
// don't have to plumb a third secret — it's already in Vercel env
// AND already in Discourse admin (as `discourse_connect_secret`).
// Tradeoff documented: a sync-key leak would also compromise SSO
// signing. Acceptable for a small family forum; for a bigger stage,
// split this into DISCOURSE_SYNC_SECRET.
//
// Response shape:
//   { ok, generatedAt, users: [{ externalId, email, name, groups[] }] }
//
// Group definitions:
//   "players"        — still alive (enrolled AND not eliminated).
//                      Mutually exclusive with "spectators".
//   "spectators"     — eliminated OR never enrolled. The "audience".
//   "semi_finalists" — anyone in a semi-final matchup ever (lifelong).
//   "finalists"      — players in the final-round matchup.

import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkSecret(req: NextRequest): boolean {
  const expected =
    process.env.DISCOURSE_SYNC_SECRET || process.env.DISCOURSE_SSO_SECRET;
  if (!expected || expected.length < 16) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const t = (await getActiveTournament()) ?? (await getLatestTournament());
  if (!t) {
    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      users: [],
    });
  }

  // 1. Everyone enrolled — keep both userId AND eliminatedAt so we
  //    can split into players (still in) vs spectators (out / never
  //    enrolled). Non-enrolled users aren't in this list at all
  //    until they sign in to Discourse — at which point the SSO
  //    flow tags them as a spectator.
  const enrollments = await db
    .select({
      userId: schema.enrollments.userId,
      eliminatedAt: schema.enrollments.eliminatedAt,
    })
    .from(schema.enrollments)
    .where(eq(schema.enrollments.tournamentId, t.id));

  // 2. Bracket — find the highest roundIndex (the "final"), then
  //    pick out semi-final + final matchup user IDs.
  const matchups = await db
    .select()
    .from(schema.matchups)
    .where(
      and(
        eq(schema.matchups.tournamentId, t.id),
        eq(schema.matchups.bracket, "main")
      )
    );

  const maxRoundIndex = matchups.reduce(
    (max, m) => Math.max(max, m.roundIndex),
    0
  );
  const semiFinalRoundIndex = Math.max(maxRoundIndex - 1, 0);

  const finalists = new Set<string>();
  const semis = new Set<string>();

  for (const m of matchups) {
    const players = [m.playerAUserId, m.playerBUserId].filter(
      (x): x is string => !!x
    );
    if (m.roundIndex === maxRoundIndex && maxRoundIndex > 0) {
      players.forEach((p) => finalists.add(p));
    }
    if (m.roundIndex === semiFinalRoundIndex && semiFinalRoundIndex > 0) {
      players.forEach((p) => semis.add(p));
    }
  }

  // 3. Resolve emails + names for each enrolled userId.
  const userIds = enrollments.map((e) => e.userId);
  const users = userIds.length
    ? await db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          name: schema.users.name,
        })
        .from(schema.users)
        .where(
          // Drizzle's inArray, but we don't import it here; build manually.
          // Filter in JS instead — small enough.
          eq(schema.users.id, userIds[0]) // placeholder — replaced below
        )
    : [];
  // The .where above is a hack to keep types; redo with full IN list.
  const usersFull = userIds.length
    ? await db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          name: schema.users.name,
        })
        .from(schema.users)
    : [];
  const enrolledIds = new Set(userIds);
  const usersFiltered = usersFull.filter((u) => enrolledIds.has(u.id));

  // 4. Compose result. Each user is in EXACTLY ONE of "players" or
  //    "spectators". Semi-finalist + finalist tags layer on top.
  const eliminatedById = new Map<string, Date | null>();
  for (const e of enrollments) eliminatedById.set(e.userId, e.eliminatedAt);

  let stillInCount = 0;
  let outCount = 0;
  const out = usersFiltered.map((u) => {
    const eliminatedAt = eliminatedById.get(u.id);
    const stillIn = eliminatedAt === null;
    const groups: string[] = stillIn ? ["players"] : ["spectators"];
    if (stillIn) stillInCount++;
    else outCount++;
    if (semis.has(u.id)) groups.push("semi_finalists");
    if (finalists.has(u.id)) groups.push("finalists");
    return {
      externalId: u.id,
      email: u.email,
      name: u.name,
      groups,
    };
  });

  // Drop the unused `users` placeholder reference for clean responses.
  void users;

  return NextResponse.json(
    {
      ok: true,
      generatedAt: new Date().toISOString(),
      tournamentId: t.id,
      counts: {
        enrolled: out.length,
        players: stillInCount,
        spectators: outCount,
        semi_finalists: semis.size,
        finalists: finalists.size,
      },
      users: out,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
