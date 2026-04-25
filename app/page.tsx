import Link from "next/link";
import { Stage } from "@/components/Stage";
import { AUTHOR_NAME, AUTHOR_AGE } from "@/lib/author";
import { getActiveTournament, getLatestTournament, getCast } from "@/lib/engine";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const active = await getActiveTournament();
  const latest = active ?? (await getLatestTournament());

  let winnerName: string | null = null;
  if (latest?.status === "complete" && latest.winnerUserId) {
    const [w] = await db
      .select({ name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, latest.winnerUserId))
      .limit(1);
    winnerName = w?.name ?? null;
  }

  let activeRoundNumber: number | null = null;
  if (latest?.status === "in_progress") {
    const [r] = await db
      .select({ n: schema.rounds.chapterNumber })
      .from(schema.rounds)
      .where(
        and(
          eq(schema.rounds.tournamentId, latest.id),
          eq(schema.rounds.status, "active")
        )
      )
      .limit(1);
    if (r) activeRoundNumber = r.n;
  }

  const cast = latest ? await getCast(latest.id) : [];
  const playersIn = cast.filter((c) => !c.enrollment.eliminatedAt).length;

  const subtitle = latest?.subtitle ?? "Quizzes! Friends! Adventure!";

  const cta =
    !latest || (latest.status === "registration" && latest.registrationOpen)
      ? { text: "Join the tournament! 🎈", href: "/join", color: "pop-coral" }
      : latest.status === "registration"
      ? { text: "Sign-ups closed", href: null, color: "" }
      : latest.status === "in_progress"
      ? { text: `Play Round ${activeRoundNumber ?? "—"} 🎯`, href: "/play", color: "pop-grass" }
      : { text: "See the standings →", href: "/standings", color: "pop-yellow" };

  return (
    <Stage scrollable>
      <div className="min-h-[calc(100vh-128px)] flex items-center justify-center py-7">
        <div className="w-full max-w-4xl flex flex-col items-center text-center px-4 gap-5">
          <span className="font-display text-base md:text-lg text-navy bg-sun px-4 py-1 rounded-full border-3 border-navy shadow-pop-sm">
            🏆 HOSTED BY {AUTHOR_NAME.toUpperCase()}, AGE {AUTHOR_AGE}
          </span>

          <h1
            className="font-display text-navy mt-5 leading-none drop-shadow-[4px_4px_0_var(--navy)]"
            style={{ fontSize: "clamp(48px, 11vw, 110px)", color: "white" }}
          >
            {AUTHOR_NAME}&rsquo;s Quiz Tournament
          </h1>

          <p className="font-display text-2xl md:text-3xl text-navy mt-3 max-w-2xl">
            {subtitle}
          </p>

          <div className="mt-7 card px-7 py-5 max-w-2xl">
            {winnerName ? (
              <div className="flex flex-col items-center gap-2">
                <span className="text-5xl bob">🏆</span>
                <p className="font-display text-3xl md:text-4xl text-navy">
                  Champion:{" "}
                  <span className="text-coral-deep">{winnerName}</span>
                </p>
              </div>
            ) : latest?.status === "in_progress" ? (
              <div className="flex flex-col items-center gap-2">
                <span className="text-4xl">🎯</span>
                <p className="font-display text-2xl md:text-3xl text-navy">
                  Round {activeRoundNumber ?? "—"} is on!
                </p>
                <p className="font-body text-base text-navy-soft">
                  {playersIn} player{playersIn === 1 ? "" : "s"} still in.
                </p>
              </div>
            ) : !latest?.registrationOpen && latest?.status === "registration" ? (
              <p className="font-display text-2xl md:text-3xl text-navy">
                Sign-ups closed.
                <br />
                <span className="text-coral-deep">First round drops soon!</span>
              </p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="text-4xl bob">🎈</span>
                <p className="font-display text-2xl md:text-3xl text-navy">
                  Sign-ups are open!
                </p>
              </div>
            )}

            {cta.href ? (
              <div className="mt-5">
                <Link
                  href={cta.href}
                  className={`pop ${cta.color} text-2xl px-7 py-3 rounded-2xl bob`}
                >
                  {cta.text}
                </Link>
              </div>
            ) : null}
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/players" className="pop pop-sky">
              👥 Players
            </Link>
            <Link href="/standings" className="pop pop-yellow">
              🏅 Standings
            </Link>
          </div>
        </div>
      </div>
    </Stage>
  );
}
