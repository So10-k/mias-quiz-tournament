import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import {
  getActiveTournament,
  getLatestTournament,
  getRoundsForTournament,
  enroll,
  getEnrollment,
  getAttempt,
} from "@/lib/engine";

export const dynamic = "force-dynamic";

export default async function PlayHome() {
  const user = await currentUser();
  if (!user) redirect("/signin");

  const tournament =
    (await getActiveTournament()) ?? (await getLatestTournament());

  if (!tournament) {
    return (
      <Stage>
        <div className="h-[calc(100vh-128px)] flex items-center justify-center px-4">
          <div className="card px-7 py-7 text-center max-w-md">
            <div className="text-6xl">⏳</div>
            <h1 className="font-display text-3xl text-navy mt-3">
              No tournament yet!
            </h1>
            <p className="font-body text-lg text-navy-soft mt-3">
              The host hasn&rsquo;t started one. Come back soon.
            </p>
          </div>
        </div>
      </Stage>
    );
  }

  let enrollment = await getEnrollment(user.id, tournament.id);
  if (!enrollment && tournament.registrationOpen) {
    enrollment = await enroll(user.id, tournament.id);
  }

  const rounds = await getRoundsForTournament(tournament.id);
  const attempts = new Map<
    string,
    { passed: boolean | null; submittedAt: Date | null; score: string | null }
  >();
  for (const r of rounds) {
    const a = await getAttempt(user.id, r.id);
    if (a)
      attempts.set(r.id, {
        passed: a.passed,
        submittedAt: a.submittedAt,
        score: a.score,
      });
  }

  const activeRound = rounds.find((r) => r.status === "active");
  const closedRounds = rounds.filter((r) => r.status === "closed");
  const lives = Math.max(0, tournament.strikeLimit - (enrollment?.strikeCount ?? 0));
  const eliminated = !!enrollment?.eliminatedAt;
  const myActiveAttempt = activeRound ? attempts.get(activeRound.id) : null;
  const alreadyPlayed = !!myActiveAttempt?.submittedAt;

  return (
    <Stage>
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col items-center gap-5">
        {/* Status banner */}
        <div className="card-sm px-5 py-3 w-full flex flex-wrap items-center justify-between gap-3">
          <span className="font-display text-xl md:text-2xl text-navy">
            Hi {user.name ?? "player"}! 🌈
          </span>
          {eliminated ? (
            <span className="pop pop-coral text-base">💔 Out of the game</span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="font-display text-base text-navy">Lives</span>
              {Array.from({ length: tournament.strikeLimit }).map((_, i) => (
                <span key={i} className="text-3xl">
                  {i < lives ? "❤️" : "🤍"}
                </span>
              ))}
            </span>
          )}
        </div>

        {/* Big "this week" card */}
        {activeRound ? (
          <div className="card px-7 py-7 w-full text-center">
            <p className="font-display text-base text-navy-soft uppercase tracking-wider">
              This week&rsquo;s round
            </p>
            <h2 className="font-display text-4xl md:text-5xl text-navy mt-2">
              Round {activeRound.chapterNumber}
            </h2>
            <p className="font-display text-2xl text-coral-deep mt-1">
              {activeRound.title}
            </p>
            {activeRound.introProse ? (
              <p className="font-body text-base text-navy-soft mt-3 max-w-xl mx-auto line-clamp-3">
                {activeRound.introProse}
              </p>
            ) : null}

            <div className="mt-5">
              {eliminated ? (
                <Link href="/players" className="pop pop-yellow text-lg">
                  Cheer the others on →
                </Link>
              ) : alreadyPlayed ? (
                <Link
                  href={`/play/round/${activeRound.chapterNumber}`}
                  className="pop pop-grass text-lg"
                >
                  ✓ See your answers
                </Link>
              ) : (
                <Link
                  href={`/play/round/${activeRound.chapterNumber}`}
                  className="pop pop-coral text-2xl bob"
                >
                  🚀 Play this round!
                </Link>
              )}
            </div>
          </div>
        ) : tournament.status === "complete" ? (
          <div className="card px-7 py-7 w-full text-center">
            <div className="text-5xl">🏆</div>
            <h2 className="font-display text-3xl text-navy mt-3">
              The tournament is over!
            </h2>
            <Link href="/standings" className="pop pop-yellow mt-5 text-lg">
              See who won →
            </Link>
          </div>
        ) : (
          <div className="card px-7 py-7 w-full text-center">
            <div className="text-5xl bob">⏰</div>
            <h2 className="font-display text-3xl text-navy mt-3">
              Waiting for the next round!
            </h2>
            <p className="font-body text-lg text-navy-soft mt-2">
              The host is writing one. Check back soon.
            </p>
          </div>
        )}

        {/* Past rounds */}
        {closedRounds.length > 0 ? (
          <div className="card-sm px-5 py-5 w-full">
            <h3 className="font-display text-xl text-navy mb-3">
              Past rounds
            </h3>
            <ul className="flex flex-col gap-2">
              {closedRounds.map((r) => {
                const a = attempts.get(r.id);
                const pct = a?.score ? Math.round(Number(a.score) * 100) : null;
                return (
                  <li
                    key={r.id}
                    className="flex items-baseline gap-3 px-3 py-2 rounded-lg border-3 border-navy bg-white"
                  >
                    <span className="font-display text-base text-navy w-24">
                      Round {r.chapterNumber}
                    </span>
                    <span className="font-display text-base text-navy flex-1 truncate">
                      {r.title}
                    </span>
                    {a?.submittedAt ? (
                      <span className="font-display text-sm text-navy-soft">
                        {pct}%
                      </span>
                    ) : (
                      <span className="font-display text-sm text-coral-deep">
                        missed
                      </span>
                    )}
                    <Link
                      href={`/play/round/${r.chapterNumber}`}
                      className="font-display text-sm text-coral-deep hover:underline"
                    >
                      look →
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Stage>
  );
}
