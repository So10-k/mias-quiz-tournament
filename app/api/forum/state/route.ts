// Public, GET-only JSON snapshot of tournament state for the
// Discourse forum HUD strip. No auth — anyone can fetch it. Cached
// at the edge for 30s so we don't hammer the DB when 100 forum
// readers refresh at once.
//
// Shape:
//   {
//     ok: true,
//     tournament: { slug, title, status, currentRoundChapter, currentRoundTitle } | null,
//     activePlayers: number,
//     totalEnrolled: number,
//     nextRoundOpensAt: ISO8601 | null,
//     nextRoundClosesAt: ISO8601 | null,
//     champion: { username, name } | null
//   }
//
// Used by the Discourse theme initializer to render
//   "📚 Chapter 4 · 12 players in · closes in 2h 14m"
// in the forum header. If the fetch fails the HUD just doesn't
// render — never blocks the forum.

import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq, asc, isNull, gt } from "drizzle-orm";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const t =
      (await getActiveTournament()) ?? (await getLatestTournament());

    if (!t) {
      return jsonHeaders({
        ok: true,
        tournament: null,
        activePlayers: 0,
        totalEnrolled: 0,
        nextRoundOpensAt: null,
        nextRoundClosesAt: null,
        champion: null,
      });
    }

    const enrollments = await db
      .select({
        id: schema.enrollments.id,
        eliminatedAt: schema.enrollments.eliminatedAt,
      })
      .from(schema.enrollments)
      .where(eq(schema.enrollments.tournamentId, t.id));

    const totalEnrolled = enrollments.length;
    const activePlayers = enrollments.filter(
      (e) => e.eliminatedAt === null
    ).length;

    // Currently active round (status='active' and not a practice
    // round). If none, surface the next upcoming round.
    const [activeRound] = await db
      .select()
      .from(schema.rounds)
      .where(
        and(
          eq(schema.rounds.tournamentId, t.id),
          eq(schema.rounds.status, "active"),
          eq(schema.rounds.isPractice, false),
          isNull(schema.rounds.tiebreakerMatchupId),
          isNull(schema.rounds.losersMatchupId)
        )
      )
      .orderBy(asc(schema.rounds.chapterNumber))
      .limit(1);

    let upcomingRound = activeRound;
    if (!upcomingRound) {
      // Pick the next round whose opensAt is in the future. Rounds
      // with no opensAt set are skipped — they're drafts the host
      // hasn't scheduled yet.
      const [next] = await db
        .select()
        .from(schema.rounds)
        .where(
          and(
            eq(schema.rounds.tournamentId, t.id),
            eq(schema.rounds.isPractice, false),
            isNull(schema.rounds.tiebreakerMatchupId),
            isNull(schema.rounds.losersMatchupId),
            gt(schema.rounds.opensAt, new Date())
          )
        )
        .orderBy(asc(schema.rounds.chapterNumber))
        .limit(1);
      upcomingRound = next;
    }

    let champion: { username: string | null; name: string | null } | null =
      null;
    if (t.winnerUserId) {
      const [winner] = await db
        .select({
          name: schema.users.name,
          email: schema.users.email,
        })
        .from(schema.users)
        .where(eq(schema.users.id, t.winnerUserId))
        .limit(1);
      if (winner) {
        champion = {
          username: winner.email.split("@")[0],
          name: winner.name,
        };
      }
    }

    return jsonHeaders({
      ok: true,
      tournament: {
        slug: t.slug,
        title: t.title,
        status: t.status,
        currentRoundChapter: upcomingRound?.chapterNumber ?? null,
        currentRoundTitle: upcomingRound?.title ?? null,
      },
      activePlayers,
      totalEnrolled,
      nextRoundOpensAt: upcomingRound?.opensAt
        ? upcomingRound.opensAt.toISOString()
        : null,
      nextRoundClosesAt: upcomingRound?.closesAt
        ? upcomingRound.closesAt.toISOString()
        : null,
      champion,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "error" },
      { status: 500 }
    );
  }
}

// CORS-permissive + 30s edge cache. The forum lives on a different
// origin (discuss.miaswebsites.art) so the browser will preflight
// before fetching from theme JS.
function jsonHeaders(body: unknown): NextResponse {
  return NextResponse.json(body, {
    headers: {
      "cache-control": "public, max-age=30, s-maxage=30",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-max-age": "86400",
    },
  });
}
