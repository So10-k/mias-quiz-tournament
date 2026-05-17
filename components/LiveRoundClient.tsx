"use client";

// Synced live-round view for finalists + spectators.
//
// Polls /api/live/[roundId]/state every 1s for the host's pace, ticks
// the countdown locally between polls, and exposes 4 answer buttons to
// finalists only. Server is the source of truth for both the lock and
// the validity of each answer write — the client just reflects state.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TTSButton } from "@/components/TTSButton";
import {
  LiveEffectOverlay,
  type LiveEffectId,
} from "@/components/LiveEffectOverlay";
import {
  StartSplash,
  QuestionTransition,
  FinalCountdown,
  RevealFlash,
  ChampionCeremony,
  FinalistPodiums,
  SoundToggle,
} from "@/components/GameshowExtras";
import {
  ensureAudio,
  isSoundEnabled,
  setSoundEnabled,
  playTick,
  playDing,
  playBuzzer,
  playFanfare,
  playApplause,
  playWhoosh,
  playBoom,
  playDrumroll,
} from "@/lib/game-sounds";
import { submitLiveAnswerAction } from "@/app/play/live/[roundId]/actions";

type Option = {
  id: string;
  order: number;
  label: string;
  isCorrect?: boolean;
};
type Question = {
  id: string;
  order: number;
  prompt: string;
  options: Option[];
};
type Finalist = {
  userId: string;
  name: string | null;
  currentPickOptionId: string | null;
  scoreSoFar?: number;
};
type State = {
  roundId: string;
  title: string;
  liveStatus: "pre_start" | "running" | "revealing" | "complete";
  isPracticeMode: boolean;
  totalQuestions: number;
  currentQuestionIndex: number | null;
  currentQuestion: Question | null;
  secondsLeft: number;
  locked: boolean;
  finalists: Finalist[];
  isFinalist: boolean;
  mySubmittedOptionId: string | null;
  scoreboard: Finalist[] | null;
  effect: {
    effect: LiveEffectId | null;
    at: string | null;
    message: string | null;
  };
};

const PALETTE = ["pop-coral", "pop-yellow", "pop-grass", "pop-sky"];

export function LiveRoundClient({
  roundId,
  viewerUserId,
  initialState,
}: {
  roundId: string;
  viewerUserId: string;
  initialState: State;
}) {
  const [state, setState] = useState<State>(initialState);
  // Local tick of the timer between polls — keeps the UI smooth even
  // though the server is only checked every second. Reset to the
  // server's authoritative value on each poll.
  const [localSeconds, setLocalSeconds] = useState<number>(
    initialState.secondsLeft
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const lastQuestionIdRef = useRef<string | null>(
    initialState.currentQuestion?.id ?? null
  );
  // Gameshow chrome state — driven by transitions, not by raw polling.
  const [showStartSplash, setShowStartSplash] = useState<boolean>(
    initialState.liveStatus === "running" &&
      initialState.currentQuestionIndex === 0 &&
      initialState.secondsLeft >=
        // first 3s of the round → still show the intro
        // (server-computed seconds means we skip on a refresh mid-Q1)
        Math.max(1, 27)
  );
  const [showTransition, setShowTransition] = useState<{
    index: number;
    total: number;
  } | null>(null);
  const [showReveal, setShowReveal] = useState<
    "correct" | "wrong" | "neutral" | null
  >(null);
  const [showChampion, setShowChampion] = useState<boolean>(
    initialState.liveStatus === "complete"
  );
  // Sound toggle — defaults to on, but actual playback is gated by the
  // user-gesture audio context priming on first click.
  const [soundOn, setSoundOnState] = useState<boolean>(true);
  const setSoundOn = (next: boolean) => {
    setSoundOnState(next);
    setSoundEnabled(next);
    if (next) ensureAudio(); // prime context on user gesture
  };

  // Refs for transition detection (don't re-trigger on every poll).
  const prevStatusRef = useRef<State["liveStatus"]>(initialState.liveStatus);
  const prevQuestionIdRef = useRef<string | null>(
    initialState.currentQuestion?.id ?? null
  );
  const prevLockedRef = useRef<boolean>(initialState.locked);
  const lastTickSecondRef = useRef<number>(0);

  // Poll loop. Pauses when tab is hidden (Vercel mitigation friendliness).
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/live/${roundId}/state`, {
          cache: "no-store",
        });
        if (res.ok) {
          const j = (await res.json()) as { state: State };
          if (!cancelled) {
            setState(j.state);
            setLocalSeconds(j.state.secondsLeft);
            // Reset error/submitting when the question changes.
            const newQid = j.state.currentQuestion?.id ?? null;
            if (newQid !== lastQuestionIdRef.current) {
              lastQuestionIdRef.current = newQid;
              setSubmitError(null);
            }
          }
        }
      } catch {
        // network blip — try again on next tick
      }
      timer = setTimeout(poll, 1000);
    };
    const onVis = () => {
      if (document.visibilityState === "visible" && !timer) {
        poll();
      } else if (document.visibilityState === "hidden" && timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    poll();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [roundId]);

  // Local tick — decrement once per second between polls.
  useEffect(() => {
    if (state.liveStatus !== "running" || state.locked) return;
    const t = setInterval(() => {
      setLocalSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [state.liveStatus, state.locked, state.currentQuestion?.id]);

  // ─── Gameshow transition detection ───────────────────────────────
  // Round start: pre_start → running fires the splash. Detected once
  // per poll cycle by ref comparison.
  useEffect(() => {
    if (
      state.liveStatus === "running" &&
      prevStatusRef.current === "pre_start"
    ) {
      setShowStartSplash(true);
      playFanfare();
    }
    prevStatusRef.current = state.liveStatus;
  }, [state.liveStatus]);

  // Question change: fire the transition splash + whoosh sound. Don't
  // fire on the very first question (the start splash already covers
  // it).
  useEffect(() => {
    const id = state.currentQuestion?.id ?? null;
    if (
      id &&
      prevQuestionIdRef.current &&
      id !== prevQuestionIdRef.current &&
      state.currentQuestionIndex != null &&
      state.currentQuestionIndex > 0
    ) {
      setShowTransition({
        index: state.currentQuestionIndex + 1,
        total: state.totalQuestions,
      });
      playWhoosh();
    }
    prevQuestionIdRef.current = id;
  }, [
    state.currentQuestion?.id,
    state.currentQuestionIndex,
    state.totalQuestions,
  ]);

  // Lock transition: false → true triggers reveal flash. Variant
  // depends on whether the viewer is a finalist + whether their pick
  // matched the correct option.
  useEffect(() => {
    if (state.locked && !prevLockedRef.current && state.currentQuestion) {
      const correct = state.currentQuestion.options.find((o) => o.isCorrect);
      let variant: "correct" | "wrong" | "neutral" = "neutral";
      if (state.isFinalist && state.mySubmittedOptionId && correct) {
        variant =
          state.mySubmittedOptionId === correct.id ? "correct" : "wrong";
      } else if (correct) {
        variant = "correct"; // spectators always see the green reveal
      }
      setShowReveal(variant);
      if (variant === "correct") playDing();
      else if (variant === "wrong") playBuzzer();
    }
    prevLockedRef.current = state.locked;
  }, [
    state.locked,
    state.currentQuestion,
    state.isFinalist,
    state.mySubmittedOptionId,
  ]);

  // Champion ceremony when round completes.
  useEffect(() => {
    if (state.liveStatus === "complete" && !showChampion) {
      setShowChampion(true);
      playApplause();
      // double tap of fanfare for extra hype
      setTimeout(() => playFanfare(), 400);
    }
  }, [state.liveStatus, showChampion]);

  // Last-5-second ticks. Use a ref so we only play once per integer
  // second (the localSeconds value can re-render at the same value when
  // the server poll lands).
  useEffect(() => {
    if (
      state.liveStatus === "running" &&
      !state.locked &&
      localSeconds > 0 &&
      localSeconds <= 5 &&
      lastTickSecondRef.current !== localSeconds
    ) {
      lastTickSecondRef.current = localSeconds;
      playTick();
    }
    if (localSeconds > 5) {
      lastTickSecondRef.current = 0;
    }
  }, [localSeconds, state.liveStatus, state.locked]);

  // Wire the host-triggered effects to their sounds. The overlay
  // dedupes on `at`, so we mirror that here — only play sound if the
  // effect timestamp is new.
  const lastEffectAtRef = useRef<string | null>(null);
  useEffect(() => {
    const at = state.effect.at;
    const eff = state.effect.effect;
    if (!at || !eff) return;
    if (lastEffectAtRef.current === at) return;
    lastEffectAtRef.current = at;
    switch (eff) {
      case "confetti":
      case "fireworks":
      case "hearts":
        playApplause();
        break;
      case "fanfare":
        playFanfare();
        break;
      case "drumroll":
        playDrumroll();
        break;
      case "approve":
        playDing();
        break;
      case "tomato":
      case "boom":
        playBoom();
        break;
      case "pressure":
        playDrumroll();
        break;
      // banner has no default sound — host can pair with another effect
    }
  }, [state.effect.at, state.effect.effect]);

  const submit = async (optionId: string) => {
    if (
      !state.currentQuestion ||
      submitting ||
      state.locked ||
      !state.isFinalist
    )
      return;
    setSubmitting(true);
    setSubmitError(null);
    const fd = new FormData();
    fd.set("roundId", roundId);
    fd.set("questionId", state.currentQuestion.id);
    fd.set("optionId", optionId);
    try {
      const result = await submitLiveAnswerAction(fd);
      if (!result.ok) {
        setSubmitError(result.reason);
      } else {
        // Optimistic — show our pick immediately while next poll
        // confirms.
        setState((s) => ({ ...s, mySubmittedOptionId: optionId }));
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const ttsText = state.currentQuestion
    ? `${state.currentQuestion.prompt}. ${state.currentQuestion.options
        .map((o, i) => `${String.fromCharCode(65 + i)}. ${o.label}`)
        .join(". ")}`
    : "";

  const optsById = new Map(
    state.currentQuestion?.options.map((o) => [o.id, o]) ?? []
  );

  return (
    <div className="max-w-3xl mx-auto pt-4 px-4 pb-12 flex flex-col gap-4">
      {/* Host-triggered overlay — fires once per state.effect.at change. */}
      <LiveEffectOverlay
        effect={state.effect.effect}
        at={state.effect.at}
        message={state.effect.message}
      />
      <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
        <h1 className="font-display text-2xl text-navy">
          {state.isPracticeMode ? "🎯 Practice · " : "🎙️ Live · "}
          {state.title}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <SoundToggle on={soundOn} onChange={setSoundOn} />
          <span
            className={
              "font-display text-xs px-3 py-1 rounded-full border-2 border-navy " +
              (state.isPracticeMode
                ? "bg-sun text-navy"
                : state.isFinalist
                  ? "bg-coral text-white"
                  : "bg-sky1 text-navy")
            }
          >
            {state.isPracticeMode
              ? "PRACTICE"
              : state.isFinalist
                ? "FINALIST"
                : "SPECTATOR"}
          </span>
        </div>
      </div>

      {/* Gameshow overlays (auto-fire on state transitions). Each
          AnimatePresence here is single-effect — they layer above the
          page content but don't conflict with the host-triggered
          LiveEffectOverlay above. */}
      <AnimatePresence>
        {showStartSplash ? (
          <StartSplash
            key="start-splash"
            finalists={state.finalists}
            isPracticeMode={state.isPracticeMode}
            onDone={() => setShowStartSplash(false)}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {showTransition ? (
          <QuestionTransition
            key={`transition-${showTransition.index}`}
            index={showTransition.index}
            total={showTransition.total}
            scores={state.finalists.map((f) => ({
              name: f.name,
              score: f.scoreSoFar ?? 0,
            }))}
            onDone={() => setShowTransition(null)}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {showReveal ? (
          <RevealFlash
            key="reveal-flash"
            variant={showReveal}
            onDone={() => setShowReveal(null)}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {state.liveStatus === "running" &&
        !state.locked &&
        localSeconds <= 5 &&
        localSeconds > 0 ? (
          <FinalCountdown key="final-countdown" seconds={localSeconds} />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {showChampion && state.scoreboard ? (
          <ChampionCeremony
            key="champion"
            scoreboard={state.scoreboard.map((f) => ({
              userId: f.userId,
              name: f.name,
              score: f.scoreSoFar ?? 0,
            }))}
            total={state.totalQuestions}
          />
        ) : null}
      </AnimatePresence>

      {state.liveStatus === "pre_start" ? (
        <div className="card px-7 py-7 text-center">
          <div className="text-6xl bob">⏳</div>
          <h2 className="font-display text-3xl text-navy mt-3">
            Waiting for the host to start…
          </h2>
          <p className="font-body text-base text-navy-soft mt-3">
            Sit tight — the round will appear here the second it goes live.
          </p>
        </div>
      ) : state.liveStatus === "complete" && state.scoreboard ? (
        <Scoreboard scoreboard={state.scoreboard} total={state.totalQuestions} />
      ) : state.currentQuestion ? (
        <>
          <AnimatePresence mode="wait">
            <motion.div
              key={state.currentQuestion.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="card px-7 py-7"
            >
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
                      : localSeconds <= 5
                        ? "bg-coral text-white"
                        : "bg-sun text-navy")
                  }
                  aria-live="polite"
                >
                  {state.locked ? "🔒 Locked" : `⏱ ${localSeconds}s`}
                </span>
              </div>

              <div className="mt-2 flex items-start justify-between gap-3">
                <h2 className="font-display text-3xl md:text-4xl text-navy flex-1">
                  {state.currentQuestion.prompt}
                </h2>
                <TTSButton
                  key={state.currentQuestion.id}
                  text={ttsText}
                  compact
                  className="pop pop-sky text-sm px-3 py-1.5 shrink-0"
                  // Auto-play for spectators so the audio narration
                  // matches the host's pacing.
                  autoPlay={!state.isFinalist}
                />
              </div>

              <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-3">
                {state.currentQuestion.options.map((o, i) => {
                  const picked = state.mySubmittedOptionId === o.id;
                  const showCorrect = state.locked && o.isCorrect;
                  const showWrongPick =
                    state.locked && picked && !o.isCorrect;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => state.isFinalist && submit(o.id)}
                      disabled={
                        !state.isFinalist || state.locked || submitting
                      }
                      className={
                        "pop text-left text-lg w-full justify-start " +
                        (picked
                          ? PALETTE[i % PALETTE.length]
                          : "pop-white") +
                        (showCorrect
                          ? " ring-4 ring-grass"
                          : showWrongPick
                            ? " ring-4 ring-coral-deep"
                            : "") +
                        (!state.isFinalist
                          ? " opacity-90 cursor-default"
                          : "")
                      }
                    >
                      <span className="font-display text-2xl mr-2">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <span>{o.label}</span>
                      {picked ? <span className="ml-auto">✓</span> : null}
                    </button>
                  );
                })}
              </div>

              {!state.isFinalist ? (
                <p className="font-body text-sm text-navy-soft mt-4 italic">
                  You&rsquo;re spectating — the finalists are answering
                  live.
                </p>
              ) : state.isPracticeMode &&
                !state.mySubmittedOptionId &&
                !state.locked ? (
                <p className="font-body text-sm text-navy-soft mt-4 italic">
                  Pick an answer — it&rsquo;s practice, no pressure.
                </p>
              ) : state.locked ? (
                <p className="font-body text-sm text-navy-soft mt-4 italic">
                  🔒 Time&rsquo;s up — answer locked.{" "}
                  {state.mySubmittedOptionId
                    ? ""
                    : "(No pick = wrong.)"}
                </p>
              ) : null}

              {submitError ? (
                <p className="font-body text-sm text-coral-deep mt-3">
                  ⚠️ {submitError}
                </p>
              ) : null}
            </motion.div>
          </AnimatePresence>

          {/* Live finalist picks panel — visible to everyone after lock. */}
          {state.locked && state.finalists.length > 0 ? (
            <div className="card px-6 py-5">
              <h2 className="font-display text-lg text-navy">
                What the finalists picked
              </h2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {state.finalists.map((f) => {
                  const pick = f.currentPickOptionId
                    ? optsById.get(f.currentPickOptionId)
                    : null;
                  return (
                    <div
                      key={f.userId}
                      className="card-sm bg-white px-3 py-3"
                    >
                      <p className="font-display text-base text-navy truncate">
                        {f.name ?? "(no name)"}
                      </p>
                      {pick ? (
                        <p className="font-body text-sm text-navy mt-1">
                          {pick.label}{" "}
                          {pick.isCorrect ? (
                            <span className="text-grass-deep ml-1">
                              ✓ correct
                            </span>
                          ) : (
                            <span className="text-coral-deep ml-1">
                              ✗ wrong
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="font-body text-sm text-navy-soft italic mt-1">
                          No pick
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {state.scoreboard ? (
            <Scoreboard
              scoreboard={state.scoreboard}
              total={state.totalQuestions}
            />
          ) : null}
        </>
      ) : (
        <div className="card px-6 py-5 text-center">
          <p className="font-body text-base text-navy-soft italic">
            Round in progress — waiting for the next question.
          </p>
        </div>
      )}

      {/* Always-visible finalist podiums — bottom strip with names +
          lock indicator. Score isn't shown here mid-round (cheat
          vector); it lives on the question-transition splash and the
          final scoreboard. */}
      {state.finalists.length > 0 &&
      state.liveStatus !== "complete" &&
      !state.isPracticeMode ? (
        <FinalistPodiums
          finalists={state.finalists}
          myUserId={viewerUserId}
          showAnswered={state.liveStatus === "running"}
        />
      ) : null}
    </div>
  );
}

function Scoreboard({
  scoreboard,
  total,
}: {
  scoreboard: Finalist[];
  total: number;
}) {
  const sorted = scoreboard
    .slice()
    .sort((a, b) => (b.scoreSoFar ?? 0) - (a.scoreSoFar ?? 0));
  const top = sorted[0];
  const tied =
    sorted.length > 1 && sorted[0].scoreSoFar === sorted[1].scoreSoFar;
  return (
    <div className="card px-6 py-5 bg-sun">
      <h2 className="font-display text-2xl text-navy">🏆 Scoreboard</h2>
      <div className="mt-3 flex flex-col gap-2">
        {sorted.map((f, i) => (
          <div
            key={f.userId}
            className={
              "card-sm px-3 py-2 flex items-center gap-3 " +
              (i === 0 && !tied ? "bg-grass text-white" : "bg-white")
            }
          >
            <span className="font-display text-2xl">{f.scoreSoFar}</span>
            <span className="font-display text-base">
              {f.name ?? "(no name)"}
            </span>
            <span className="ml-auto font-body text-xs opacity-80">
              / {total}
            </span>
          </div>
        ))}
      </div>
      {top && !tied ? (
        <p className="font-display text-lg text-navy mt-3 text-center">
          👑 Champion:{" "}
          <span className="text-coral-deep">{top.name ?? "(no name)"}</span>
        </p>
      ) : tied ? (
        <p className="font-display text-base text-navy mt-3 text-center">
          🤝 Tied — host&rsquo;s call.
        </p>
      ) : null}
    </div>
  );
}
