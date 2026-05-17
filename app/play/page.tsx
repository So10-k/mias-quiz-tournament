import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { CountdownCard } from "@/components/CountdownCard";
import { currentUser } from "@/lib/session";
import { getCountdown } from "@/lib/countdown-settings";
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

  const allRounds = await getRoundsForTournament(tournament.id);
  const rounds = allRounds.filter((r) => !r.isPractice);
  const practiceRounds = allRounds.filter(
    (r) =>
      r.isPractice && r.status !== "closed" && !r.tiebreakerMatchupId
  );
  const attempts = new Map<
    string,
    { passed: boolean | null; submittedAt: Date | null; score: string | null }
  >();
  for (const r of allRounds) {
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
  // Surface any live-mode round the host has set up. Displayed regardless
  // of `status`/eliminated — even spectators get to watch a live round.
  const liveRound = allRounds.find((r) => r.isLive);
  const lives = Math.max(0, tournament.strikeLimit - (enrollment?.strikeCount ?? 0));
  const eliminated = !!enrollment?.eliminatedAt;
  const myActiveAttempt = activeRound ? attempts.get(activeRound.id) : null;
  const alreadyPlayed = !!myActiveAttempt?.submittedAt;
  const countdown = await getCountdown();

  return (
    <Stage>
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col items-center gap-5">
        {countdown.visible ? (
          <CountdownCard
            label={countdown.label}
            targetIso={countdown.targetIso}
          />
        ) : null}

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

        {/* Live-now banner. Host has flipped a round into live mode —
            everyone (eliminated or not) gets a CTA to join the synced
            view. Pulses with the same coral→gold treatment as the
            homepage hype banner so it grabs attention. */}
        {liveRound ? (
          <Link
            href={`/play/live/${liveRound.id}`}
            className="live-cta relative w-full px-6 py-5 text-center overflow-hidden"
            style={{ textDecoration: "none" }}
          >
            <span
              aria-hidden
              className="absolute -top-2 -right-2 bob font-display text-xs px-3 py-1 rounded-full border-3 border-navy bg-coral text-white shadow-pop-sm rotate-6"
            >
              🔴 LIVE
            </span>
            <p className="font-display text-xs uppercase tracking-[0.25em] text-white/90">
              Hosted live right now
            </p>
            <h2 className="font-display text-3xl md:text-4xl text-white mt-1 drop-shadow-[3px_3px_0_var(--navy)]">
              🎙️ {liveRound.title}
            </h2>
            <p className="font-display text-base text-white mt-2">
              Tap to join the synced room →
            </p>
            <style>{`
              .live-cta {
                background: linear-gradient(135deg,#FF6B9D 0%,#FF4D6D 35%,#FF8C42 70%,#FFB627 100%);
                background-size:220% 220%;
                border:4px solid var(--navy);
                border-radius:22px;
                box-shadow:8px 8px 0 0 var(--navy);
                animation: live-pan 6s ease-in-out infinite;
              }
              @keyframes live-pan {
                0%,100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
              }
            `}</style>
          </Link>
        ) : null}

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

        {/* Spectator mode banner — explicit cue for eliminated players that
            the chapter quizzes (and pure practice rounds) are off-limits.
            Tiebreaker / make-up rounds aren't shown here anyway since the
            practiceRounds filter excludes anything with tiebreakerMatchupId. */}
        {eliminated ? (
          <div className="card px-6 py-6 w-full text-center bg-sky1">
            <div className="text-5xl">👀</div>
            <h3 className="font-display text-2xl text-navy mt-3">
              You&rsquo;re in spectator mode
            </h3>
            <p className="font-body text-base text-navy-soft mt-2 max-w-md mx-auto">
              You&rsquo;re out of both brackets, so the chapter quizzes and
              practice rounds are locked. The bracket, standings, and
              predictions still work — settle in and watch the rest unfold.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
              <Link href="/bracket" className="pop pop-coral">
                🏆 Bracket
              </Link>
              <Link href="/standings" className="pop pop-yellow">
                📊 Standings
              </Link>
              <Link href="/predict" className="pop pop-sky">
                🔮 Predict
              </Link>
            </div>
          </div>
        ) : null}

        {/* Practice rounds — don't count, hidden when you're a spectator. */}
        {!eliminated && practiceRounds.length > 0 ? (
          <div className="card-sm px-5 py-5 w-full bg-sky1">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h3 className="font-display text-xl text-navy">
                🎯 Practice rounds
              </h3>
              <span className="font-body text-xs text-navy-soft">
                Just for fun — doesn&rsquo;t count
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {practiceRounds.map((r) => {
                const a = attempts.get(r.id);
                const pct = a?.score ? Math.round(Number(a.score) * 100) : null;
                const done = !!a?.submittedAt;
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border-3 border-navy bg-white"
                  >
                    <span className="font-display text-base text-navy flex-1 truncate">
                      {r.title}
                    </span>
                    {done ? (
                      <span className="font-display text-sm text-grass-deep">
                        ✓ {pct}%
                      </span>
                    ) : null}
                    <Link
                      href={`/play/practice/${r.id}`}
                      className="pop pop-yellow text-xs px-3 py-1"
                    >
                      {done ? "review" : "try it"}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

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
