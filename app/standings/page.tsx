import Link from "next/link";
import { Stage } from "@/components/Stage";
import { Crown } from "@/components/ink/Crown";
import { PageLockedNotice } from "@/components/PageLockedNotice";
import { AUTHOR_NAME, PRIZE } from "@/lib/author";
import {
  getActiveTournament,
  getLatestTournament,
  getCast,
} from "@/lib/engine";
import { isPageLocked } from "@/lib/page-locks";
import { currentUser } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, asc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Standings: ranks players by score across all submitted attempts in the
// current/latest tournament. Highest cumulative score first; ties broken by
// fewest strikes, then earliest registration.
export default async function StandingsPage() {
  const me = await currentUser();
  if ((await isPageLocked("standings")) && me?.role !== "author") {
    return <PageLockedNotice title="The standings" emoji="📊" />;
  }
  const t =
    (await getActiveTournament()) ?? (await getLatestTournament());

  if (!t) {
    return (
      <Stage>
        <div className="h-[calc(100vh-128px)] flex items-center justify-center px-4">
          <div className="card px-7 py-7 text-center max-w-md">
            <div className="text-6xl">🏅</div>
            <h1 className="font-display text-3xl text-navy mt-3">
              No standings yet!
            </h1>
            <Link href="/" className="pop pop-coral mt-5">
              ← Home
            </Link>
          </div>
        </div>
      </Stage>
    );
  }

  const cast = await getCast(t.id);
  const rounds = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.tournamentId, t.id))
    .orderBy(asc(schema.rounds.chapterNumber));

  const attemptsByUser = new Map<string, number>();
  if (rounds.length > 0) {
    const all = await db
      .select()
      .from(schema.attempts)
      .where(
        inArray(
          schema.attempts.roundId,
          rounds.map((r) => r.id)
        )
      );
    for (const a of all) {
      const score = Number(a.score ?? "0");
      attemptsByUser.set(
        a.userId,
        (attemptsByUser.get(a.userId) ?? 0) + score
      );
    }
  }

  const ranked = cast
    .map((row) => ({
      enrollment: row.enrollment,
      user: row.user,
      total: attemptsByUser.get(row.user.id) ?? 0,
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (a.enrollment.strikeCount !== b.enrollment.strikeCount)
        return a.enrollment.strikeCount - b.enrollment.strikeCount;
      return (
        +new Date(a.enrollment.registeredAt) -
        +new Date(b.enrollment.registeredAt)
      );
    });

  let winnerName: string | null = null;
  if (t.status === "complete" && t.winnerUserId) {
    const w = ranked.find((r) => r.user.id === t.winnerUserId);
    winnerName = w?.user.name ?? w?.user.email ?? null;
  }

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col items-center gap-5">
        <div className="card-sm px-5 py-3 w-full text-center">
          <h1 className="font-display text-3xl md:text-4xl text-navy">
            🏅 Standings
          </h1>
          <p className="font-display text-base text-navy-soft mt-1">
            {t.status === "complete" ? "Final results" : "Live standings"}
          </p>
        </div>

        <div className="card-sm px-5 py-3 w-full text-center bg-coral text-white">
          <p className="font-display text-lg md:text-xl">
            🏆 Prize: {PRIZE}
          </p>
        </div>

        {t.status === "complete" && winnerName ? (
          <div className="card px-7 py-7 w-full text-center">
            <div className="flex justify-center text-gold mb-3">
              <Crown />
            </div>
            <p className="font-display text-2xl text-navy">Champion</p>
            <p
              className="font-display mt-2 leading-none"
              style={{
                fontSize: "clamp(40px, 8vw, 72px)",
                color: "var(--coral-deep)",
              }}
            >
              {winnerName}
            </p>
            <p className="font-body text-base text-navy mt-5">
              Thank you for playing! — {AUTHOR_NAME} ✍️
            </p>
          </div>
        ) : null}

        {ranked.length === 0 ? (
          <div className="card px-7 py-7 w-full text-center">
            <p className="font-display text-xl text-navy">
              No players yet!
            </p>
          </div>
        ) : (
          <ol className="w-full flex flex-col gap-3">
            {ranked.map((row, i) => {
              const place = i + 1;
              const elim = !!row.enrollment.eliminatedAt;
              const medal =
                place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : "";
              return (
                <li
                  key={row.enrollment.id}
                  className={
                    "card-sm px-5 py-4 flex items-center gap-4 " +
                    (elim ? "opacity-70" : "")
                  }
                >
                  <span className="font-display text-2xl text-navy w-10 text-right">
                    {place}.
                  </span>
                  {medal ? <span className="text-2xl">{medal}</span> : null}
                  <span className="font-display text-xl text-navy flex-1 truncate">
                    {row.user.name ?? row.user.email ?? "—"}
                  </span>
                  <span className="font-display text-base text-navy">
                    {row.total.toFixed(2)} pts
                  </span>
                  {elim ? (
                    <span className="px-2 py-1 rounded-md border-2 border-navy bg-coral-deep text-white text-xs font-display">
                      OUT
                    </span>
                  ) : (
                    <span className="font-display text-sm text-navy">
                      {Math.max(
                        0,
                        t.strikeLimit - row.enrollment.strikeCount
                      )}
                      ❤️
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex gap-3">
          <Link href="/" className="pop pop-white">
            ← Home
          </Link>
          <Link href="/players" className="pop pop-yellow">
            👥 Player cards
          </Link>
        </div>
      </div>
    </Stage>
  );
}
