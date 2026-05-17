// Host control panel for a live round.
//
// Permission model: requires `currentUser().role === 'author'` (Sam). All
// mutating buttons are POST-only Server Actions (per the team's
// no-GET-state-mutations rule).
//
// The panel shows the current question + finalist picks live, with big
// "Start", "Next Question", "Lock Now", "Reveal", "Complete", "Reset"
// buttons. State refresh: server-rendered on page load + an inline
// AutoRefresh pulls a fresh render every 2s so the host sees finalist
// answers stream in without manually reloading.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { AutoRefresh } from "@/components/AutoRefresh";
import { LiveEffectOverlay } from "@/components/LiveEffectOverlay";
import { currentUser } from "@/lib/session";
import { getLiveRoundState, type LiveEffect } from "@/lib/live";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import {
  startAction,
  advanceAction,
  lockAction,
  completeAction,
  resetAction,
  effectAction,
  clearEffectAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function HostLivePage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  const user = await currentUser();
  if (!user) redirect(`/signin?next=/host/live/${roundId}`);
  if (user.role !== "author") redirect("/");

  const [round] = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.id, roundId))
    .limit(1);
  if (!round) notFound();

  if (!round.isLive) {
    return (
      <Stage>
        <div className="max-w-xl mx-auto pt-10 px-4">
          <div className="card px-6 py-6 text-center">
            <div className="text-5xl">🎙️</div>
            <h1 className="font-display text-3xl text-navy mt-3">
              Round isn&rsquo;t in live mode
            </h1>
            <p className="font-body text-base text-navy-soft mt-3">
              Toggle <code>isLive</code> on the round in the database (or
              from the round editor) before opening this control panel.
            </p>
            <p className="font-body text-sm text-navy-soft mt-3">
              Round: <strong>{round.title}</strong> ({round.id})
            </p>
            <Link href="/host" className="pop pop-coral mt-5 inline-block">
              ← Back to host
            </Link>
          </div>
        </div>
      </Stage>
    );
  }

  const state = await getLiveRoundState({
    roundId,
    viewerUserId: user.id,
  });
  if (!state) notFound();

  const optsById = new Map(
    state.currentQuestion?.options.map((o) => [o.id, o]) ?? []
  );

  return (
    <Stage scrollable>
      {/* Auto-poll every 2s so finalist picks stream in without a manual
          reload. The mutating buttons sit inside <form action={…}> so
          they don't cancel polling. */}
      <AutoRefresh seconds={2} />
      {/* Host sees their own effects too — useful for QA before going
          live. The overlay dedupes on `at` so AutoRefresh re-rendering
          the page doesn't re-play the effect. */}
      <LiveEffectOverlay
        effect={state.effect.effect}
        at={state.effect.at}
        message={state.effect.message}
      />
      <div className="max-w-3xl mx-auto pt-4 px-4 pb-12 flex flex-col gap-4">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-2xl text-navy">
            🎙️ Live · {round.title}
          </h1>
          <span
            className={
              "font-display text-xs px-3 py-1 rounded-full border-2 border-navy " +
              (state.liveStatus === "running"
                ? "bg-grass text-white"
                : state.liveStatus === "revealing"
                  ? "bg-sun text-navy"
                  : state.liveStatus === "complete"
                    ? "bg-coral-deep text-white"
                    : "bg-white text-navy")
            }
          >
            {state.liveStatus.replace("_", " ").toUpperCase()}
          </span>
        </div>

        {state.finalists.length === 0 && !state.isPracticeMode ? (
          <div className="card-sm bg-coral-deep text-white px-4 py-3">
            <p className="font-display text-sm">
              ⚠️ No finalists wired. Set this round&rsquo;s{" "}
              <code>tiebreakerMatchupId</code> to the final matchup so
              both players are eligible to answer.
            </p>
          </div>
        ) : null}

        {state.isPracticeMode ? (
          <div className="card-sm bg-sun text-navy px-4 py-3">
            <p className="font-display text-sm">
              🎯 Practice round — anyone signed in can answer. No bracket
              effects, no strikes. Use this to rehearse the live flow
              before the finals.
            </p>
          </div>
        ) : null}

        <div className="card px-6 py-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <p className="font-display text-sm text-navy-soft uppercase tracking-wider">
              Question{" "}
              {state.currentQuestionIndex != null
                ? state.currentQuestionIndex + 1
                : "—"}{" "}
              of {state.totalQuestions}
            </p>
            <span
              className={
                "font-display text-sm px-3 py-1 rounded-full border-2 border-navy " +
                (state.locked
                  ? "bg-navy/10 text-navy"
                  : state.secondsLeft <= 5
                    ? "bg-coral text-white"
                    : "bg-sun text-navy")
              }
            >
              {state.locked ? "🔒 Locked" : `⏱ ${state.secondsLeft}s`}
            </span>
          </div>
          {state.currentQuestion ? (
            <>
              <h2 className="font-display text-2xl md:text-3xl text-navy mt-2">
                {state.currentQuestion.prompt}
              </h2>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                {state.currentQuestion.options.map((o, i) => (
                  <div
                    key={o.id}
                    className={
                      "card-sm bg-white px-3 py-2 font-display text-base text-navy flex items-center gap-2 " +
                      (state.locked && o.isCorrect
                        ? "ring-4 ring-grass"
                        : "")
                    }
                  >
                    <span className="text-coral-deep">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <span className="flex-1">{o.label}</span>
                    {state.locked && o.isCorrect ? (
                      <span className="text-grass-deep font-bold">✓</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="font-body text-base text-navy-soft mt-2 italic">
              No question on screen yet. Click <strong>Start Round</strong> to
              begin.
            </p>
          )}
        </div>

        {/* Finalist picks for the current question — only revealed after
            the lock so neither finalist can copy mid-window. */}
        {state.finalists.length > 0 ? (
          <div className="card px-6 py-5">
            <h2 className="font-display text-lg text-navy">Finalist picks</h2>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {state.finalists.map((f) => {
                const pick = f.currentPickOptionId
                  ? optsById.get(f.currentPickOptionId)
                  : null;
                return (
                  <div
                    key={f.userId}
                    className="card-sm bg-white px-3 py-3 flex flex-col gap-1"
                  >
                    <p className="font-display text-base text-navy truncate">
                      {f.name ?? "(no name)"}
                    </p>
                    {state.locked ? (
                      pick ? (
                        <p className="font-body text-sm text-navy">
                          Picked:{" "}
                          <strong className="text-coral-deep">
                            {pick.label}
                          </strong>
                          {pick.isCorrect ? (
                            <span className="text-grass-deep ml-2">✓ correct</span>
                          ) : (
                            <span className="text-coral-deep ml-2">
                              ✗ wrong
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="font-body text-sm text-navy-soft italic">
                          No pick — counts as wrong
                        </p>
                      )
                    ) : (
                      <p className="font-body text-sm text-navy-soft italic">
                        {f.currentPickOptionId
                          ? "Has answered (hidden until lock)"
                          : "Waiting…"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Scoreboard during reveal/complete. */}
        {state.scoreboard ? (
          <div className="card px-6 py-5 bg-sun">
            <h2 className="font-display text-2xl text-navy">🏆 Scoreboard</h2>
            <div className="mt-3 flex flex-col gap-2">
              {state.scoreboard
                .slice()
                .sort((a, b) => (b.scoreSoFar ?? 0) - (a.scoreSoFar ?? 0))
                .map((f) => (
                  <div
                    key={f.userId}
                    className="card-sm bg-white px-3 py-2 flex items-center gap-3"
                  >
                    <span className="font-display text-2xl text-coral-deep">
                      {f.scoreSoFar}
                    </span>
                    <span className="font-display text-base text-navy">
                      {f.name ?? "(no name)"}
                    </span>
                    <span className="ml-auto font-body text-xs text-navy-soft">
                      / {state.totalQuestions}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        {/* Control buttons. Server Actions, POST-only. */}
        <div className="card px-6 py-5 flex flex-col gap-3">
          <h2 className="font-display text-lg text-navy">Controls</h2>
          <div className="flex flex-wrap gap-2">
            {state.liveStatus === "pre_start" ? (
              <form action={startAction}>
                <input type="hidden" name="roundId" value={roundId} />
                <button className="pop pop-grass text-base">
                  ▶ Start Round
                </button>
              </form>
            ) : null}
            {state.liveStatus === "running" ? (
              <>
                <form action={advanceAction}>
                  <input type="hidden" name="roundId" value={roundId} />
                  <button className="pop pop-coral text-base">
                    Next Question →
                  </button>
                </form>
                <form action={lockAction}>
                  <input type="hidden" name="roundId" value={roundId} />
                  <button
                    className="pop pop-yellow text-base"
                    disabled={state.locked}
                  >
                    🔒 Lock Now
                  </button>
                </form>
              </>
            ) : null}
            {state.liveStatus === "revealing" ? (
              <form action={completeAction}>
                <input type="hidden" name="roundId" value={roundId} />
                <button className="pop pop-grass text-base">
                  ✅ Mark Complete
                </button>
              </form>
            ) : null}
          </div>

          {/* Effects board — every button fires a synced overlay on
              every connected client. Spam them. The overlay component
              dedupes on timestamp, so each press triggers exactly one
              play. The two with text inputs (Fanfare/Banner) accept a
              custom message. Clear cancels any in-flight effect. */}
          <div className="mt-2">
            <h3 className="font-display text-base text-navy mb-2">
              ✨ Effects (everyone sees these)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {(
                [
                  ["confetti", "🎉", "Confetti", "pop-coral"],
                  ["fireworks", "🎆", "Fireworks", "pop-yellow"],
                  ["hearts", "❤️", "Hearts", "pop-coral"],
                  ["approve", "⭐", "Mia Approves", "pop-yellow"],
                  ["drumroll", "🥁", "Drumroll", "pop-sky"],
                  ["pressure", "⏰", "Pressure", "pop-coral"],
                  ["boom", "💥", "BOOM", "pop-coral"],
                  ["tomato", "🍅", "Tomato", "pop-white"],
                ] as const
              ).map(([id, icon, label, cls]) => (
                <form action={effectAction} key={id}>
                  <input type="hidden" name="roundId" value={roundId} />
                  <input type="hidden" name="effect" value={id} />
                  <button
                    className={`pop ${cls} text-sm w-full justify-start`}
                  >
                    <span className="text-xl mr-2">{icon}</span>
                    {label}
                  </button>
                </form>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <form action={effectAction} className="flex gap-2">
                <input type="hidden" name="roundId" value={roundId} />
                <input type="hidden" name="effect" value="fanfare" />
                <input
                  name="message"
                  placeholder="Fanfare text — e.g. NICE!"
                  maxLength={60}
                  className="card-sm bg-white px-3 py-1.5 flex-1 text-sm font-body border-2 border-navy"
                />
                <button className="pop pop-coral text-sm shrink-0">
                  🏆 Fanfare
                </button>
              </form>
              <form action={effectAction} className="flex gap-2">
                <input type="hidden" name="roundId" value={roundId} />
                <input type="hidden" name="effect" value="banner" />
                <input
                  name="message"
                  placeholder="Banner text — e.g. FINAL QUESTION!"
                  maxLength={120}
                  className="card-sm bg-white px-3 py-1.5 flex-1 text-sm font-body border-2 border-navy"
                />
                <button className="pop pop-sky text-sm shrink-0">
                  📣 Banner
                </button>
              </form>
            </div>
            <form action={clearEffectAction} className="mt-2">
              <input type="hidden" name="roundId" value={roundId} />
              <button className="pop pop-white text-xs">
                ❌ Clear effect
              </button>
            </form>
          </div>

          {/* Reset is destructive — separate, gated form requiring an
              explicit "RESET" string. */}
          <details className="mt-3">
            <summary className="font-body text-xs text-coral-deep cursor-pointer">
              ⚠️ Danger zone — reset round
            </summary>
            <form action={resetAction} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="roundId" value={roundId} />
              <p className="font-body text-xs text-navy-soft">
                Wipes all attempts + answers for this round and returns it
                to <code>pre_start</code>. Type <strong>RESET</strong> to
                confirm.
              </p>
              <input
                name="confirm"
                placeholder="Type RESET"
                className="card-sm bg-white px-3 py-1.5 font-body text-sm border-2 border-navy"
                required
              />
              <button className="pop pop-white text-sm self-start">
                Reset round
              </button>
            </form>
          </details>
        </div>

        <p className="font-body text-xs text-navy-soft text-center">
          Spectator URL:{" "}
          <code className="bg-white px-2 py-0.5 rounded">
            /play/live/{roundId}
          </code>
        </p>
      </div>
    </Stage>
  );
}
