"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { submitChapter } from "@/app/play/round/[n]/actions";
import { submitPractice } from "@/app/play/practice/[id]/actions";

type Option = { id: string; label: string; isCorrect: boolean };
type Question = { id: string; prompt: string; options: Option[] };
type Props = {
  tournamentId: string;
  chapterNumber: number;
  title: string;
  intro?: string | null;
  questions: Question[];
  // For practice rounds: provide the round ID and switch the submit path.
  mode?: "real" | "practice";
  roundId?: string;
};

const palette = ["pop-coral", "pop-yellow", "pop-grass", "pop-sky"];

// Two free tab-leaves; the third triggers a forced restart.
const TAB_STRIKE_LIMIT = 3;
const FREE_STRIKES = TAB_STRIKE_LIMIT - 1;

// Hard cap on how long you can sit on a single question. Once the clock
// hits zero, whatever you've picked locks in (or nothing, if you didn't
// pick) and you auto-advance. The locked answer stays locked even if you
// navigate back via the dot row — no second chances. This is the main
// counter against second-device cheating: 15s is plenty to read and pick,
// nowhere near enough to pull out a phone, search, and re-confirm.
const SECONDS_PER_QUESTION = 15;

export function ChapterRunner({
  tournamentId,
  chapterNumber,
  title,
  intro,
  questions,
  mode = "real",
  roundId,
}: Props) {
  // -1 = intro page, 0..n-1 = questions, n = ready-to-submit confirmation
  const [page, setPage] = useState<number>(intro ? -1 : 0);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [tabStrikes, setTabStrikes] = useState(0);
  const [strikeToast, setStrikeToast] = useState<number>(0);
  const [forceRestart, setForceRestart] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Per-question 15s timer. Once a question's timer fires, its id goes in
  // `lockedQuestions` and stays there for the rest of the runner — we
  // don't reset on revisit, so the back button can't be used to buy time.
  const [secondsLeft, setSecondsLeft] = useState<number>(SECONDS_PER_QUESTION);
  const [lockedQuestions, setLockedQuestions] = useState<
    Record<string, true>
  >({});
  // We use a ref alongside state so the interval handler reads the latest
  // value without re-creating the interval on every tick.
  const lockedRef = useRef<Record<string, true>>({});
  lockedRef.current = lockedQuestions;
  const picksRef = useRef<Record<string, string>>({});
  picksRef.current = picks;

  const last = questions.length - 1;
  const allAnswered = questions.every((q) => picks[q.id]);
  const onQuestion = page >= 0 && page <= last;
  const currentQ = onQuestion ? questions[page] : null;
  const currentLocked = !!(currentQ && lockedQuestions[currentQ.id]);

  const restart = () => {
    setPicks({});
    setPage(intro ? -1 : 0);
    setSubmitting(false);
    setTabStrikes(0);
    setStrikeToast(0);
    setForceRestart(false);
    setLockedQuestions({});
    setSecondsLeft(SECONDS_PER_QUESTION);
  };

  // Tab-leave guard. Each visibilitychange→hidden bumps a counter; the third
  // hit wipes progress. Without this you could just flip to Google mid-round.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "hidden") return;
      setTabStrikes((s) => {
        const next = s + 1;
        if (next >= TAB_STRIKE_LIMIT) {
          queueMicrotask(() => setForceRestart(true));
        } else {
          queueMicrotask(() => setStrikeToast(next));
        }
        return next;
      });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!strikeToast || forceRestart) return;
    const t = setTimeout(() => setStrikeToast(0), 6000);
    return () => clearTimeout(t);
  }, [strikeToast, forceRestart]);

  // Per-question countdown. Resets to SECONDS_PER_QUESTION on landing on
  // a NEW (unlocked) question; ticks once per second; when it hits 0,
  // locks that question and auto-advances. Already-locked questions don't
  // run the timer (you're just reviewing your locked-in pick).
  useEffect(() => {
    if (!onQuestion || !currentQ || forceRestart) return;
    if (lockedQuestions[currentQ.id]) return; // already locked, no timer
    setSecondsLeft(SECONDS_PER_QUESTION);
    const qid = currentQ.id;
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, SECONDS_PER_QUESTION - elapsed);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        // Lock this question's pick (whatever's currently selected, if
        // anything) and advance to the next page. We use refs to read the
        // latest picks/locked state without making this effect re-run on
        // every keystroke.
        if (!lockedRef.current[qid]) {
          setLockedQuestions((prev) => ({ ...prev, [qid]: true }));
        }
        setPage((p) => p + 1);
      }
    }, 200);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, currentQ?.id, forceRestart]);

  // Block keyboard copy/select-all/save while in the runner. CSS already
  // handles selection, but Ctrl/Cmd+C will still copy a focused option label
  // unless we intercept.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "c" || k === "a" || k === "s" || k === "p" || k === "x") {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const onSubmit = async () => {
    if (!allAnswered || submitting || forceRestart) return;
    setSubmitting(true);
    setSubmitError(null);
    const fd = new FormData();
    for (const [qid, oid] of Object.entries(picks)) fd.set(`q:${qid}`, oid);
    try {
      if (mode === "practice") {
        if (!roundId) throw new Error("missing roundId");
        fd.set("roundId", roundId);
        await submitPractice(fd);
      } else {
        fd.set("chapter", String(chapterNumber));
        fd.set("tournamentId", tournamentId);
        await submitChapter(fd);
      }
      // The action resolved without throwing. In Next 15 this is the happy
      // path even on redirect — the framework processes the response and
      // navigates. If for some reason navigation doesn't happen, drop the
      // "Sending…" state so the user can try again instead of being stuck.
      setSubmitting(false);
    } catch (e: unknown) {
      // Some Next versions still surface redirect/notFound as thrown
      // signals — let those bubble so the framework can act on them.
      const digest = (e as { digest?: string } | null)?.digest;
      if (
        typeof digest === "string" &&
        (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
      ) {
        throw e;
      }
      // eslint-disable-next-line no-console
      console.error("submit failed:", e);
      const msg =
        e instanceof Error
          ? e.message
          : "Something went wrong sending your answers.";
      setSubmitError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="max-w-3xl mx-auto pt-4 select-none"
      style={{
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* tab-leave strike warning — full-screen so it actually covers the
          question and clears the nav bar */}
      <AnimatePresence>
        {strikeToast && !forceRestart ? (
          <motion.div
            key={`strike-${strikeToast}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
            style={{ background: "rgba(27,42,78,0.78)" }}
            onClick={() => setStrikeToast(0)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="card text-center w-full max-w-md px-5 py-6 sm:px-7 sm:py-7"
              style={{ background: "white" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-5xl sm:text-6xl">
                {strikeToast < FREE_STRIKES ? "⚠️" : "🛑"}
              </div>
              <p className="font-display text-xs sm:text-sm uppercase tracking-wider text-coral-deep mt-3">
                Tab-leave detected
              </p>
              <h2 className="font-display text-2xl sm:text-3xl text-navy mt-1 leading-tight">
                Strike {strikeToast} of {FREE_STRIKES}
              </h2>
              <p className="font-body text-base sm:text-lg text-navy-soft mt-3 leading-snug">
                {strikeToast < FREE_STRIKES
                  ? "Leaving the tab during a quiz counts as a strike. One more and you'll be on your last warning."
                  : "Last warning! One more tab-leave and your answers reset and you start over."}
              </p>
              <button
                onClick={() => setStrikeToast(0)}
                className="pop pop-coral mt-5 sm:mt-6 text-base sm:text-lg w-full sm:w-auto justify-center"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* forced-restart overlay (3rd tab-leave) */}
      {forceRestart ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
          style={{ background: "rgba(27,42,78,0.88)" }}
        >
          <div className="card text-center w-full max-w-md px-5 py-6 sm:px-7 sm:py-7">
            <div className="text-5xl sm:text-6xl">🚫</div>
            <h2 className="font-display text-2xl sm:text-3xl text-navy mt-3 leading-tight">
              Tab-leave limit reached
            </h2>
            <p className="font-body text-base sm:text-lg text-navy-soft mt-3 leading-snug">
              You left the tab too many times — your answers on this round
              have been wiped. Start over from the top.
            </p>
            <button
              onClick={restart}
              className="pop pop-coral mt-5 sm:mt-7 text-base sm:text-xl w-full sm:w-auto justify-center"
            >
              Start over
            </button>
          </div>
        </div>
      ) : null}

      {/* progress dots */}
      <div className="flex items-center justify-center gap-2 mb-5">
        {questions.map((_, i) => {
          const ans = !!picks[questions[i].id];
          const here = page === i;
          return (
            <button
              key={i}
              onClick={() => setPage(i)}
              aria-label={`Question ${i + 1}`}
              className={
                "w-4 h-4 rounded-full border-2 border-navy " +
                (here ? "bg-coral" : ans ? "bg-grass" : "bg-white")
              }
            />
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {page === -1 ? (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="card px-7 py-7"
          >
            <p className="font-display text-base text-navy-soft uppercase tracking-wider">
              Round {chapterNumber}
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-navy mt-2">
              {title}
            </h1>
            <p className="font-body text-xl text-navy mt-5 leading-relaxed">
              {intro}
            </p>
            <div className="mt-7 flex items-center gap-3">
              <button
                onClick={() => setPage(0)}
                className="pop pop-coral text-xl"
              >
                Let&rsquo;s go! →
              </button>
            </div>
          </motion.div>
        ) : page <= last ? (
          <motion.div
            key={`q-${page}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="card px-7 py-7"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-base text-navy-soft uppercase tracking-wider">
                Question {page + 1} of {questions.length}
              </p>
              {currentLocked ? (
                <span className="font-display text-xs px-3 py-1 rounded-full border-2 border-navy bg-navy/10 text-navy">
                  🔒 Locked
                </span>
              ) : (
                <span
                  className={
                    "font-display text-sm px-3 py-1 rounded-full border-2 border-navy " +
                    (secondsLeft <= 5
                      ? "bg-coral text-white"
                      : "bg-sun text-navy")
                  }
                  style={{
                    transition: "background-color 0.2s",
                  }}
                  aria-live="polite"
                >
                  ⏱ {secondsLeft}s
                </span>
              )}
            </div>
            <h2 className="font-display text-3xl md:text-4xl text-navy mt-2">
              {questions[page].prompt}
            </h2>

            <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-3">
              {questions[page].options.map((o, oi) => {
                const picked = picks[questions[page].id] === o.id;
                const disabled = currentLocked;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      if (currentLocked) return;
                      setPicks((p) => ({
                        ...p,
                        [questions[page].id]: o.id,
                      }));
                    }}
                    disabled={disabled}
                    className={
                      "pop text-left text-lg w-full justify-start " +
                      (picked
                        ? palette[oi % palette.length]
                        : "pop-white") +
                      (disabled ? " opacity-70 cursor-not-allowed" : "")
                    }
                  >
                    <span className="font-display text-2xl mr-2">
                      {String.fromCharCode(65 + oi)}.
                    </span>
                    <span>{o.label}</span>
                    {picked ? <span className="ml-auto">✓</span> : null}
                  </button>
                );
              })}
            </div>
            {currentLocked ? (
              <p className="font-body text-xs text-navy-soft mt-3 italic">
                Time&rsquo;s up on this one — your answer is locked in.
                {!picks[questions[page].id]
                  ? " (No pick made → counts as wrong.)"
                  : ""}
              </p>
            ) : null}

            <div className="mt-7 flex items-center justify-between gap-3">
              <button
                onClick={() => setPage(page - 1)}
                className="pop pop-white"
                disabled={page === 0 && !intro}
              >
                ← Back
              </button>
              {page < last ? (
                <button
                  onClick={() => {
                    // Manual advance also locks — moving forward means
                    // committing your answer, same as the timer running out.
                    const qid = questions[page].id;
                    if (!lockedQuestions[qid]) {
                      setLockedQuestions((prev) => ({ ...prev, [qid]: true }));
                    }
                    setPage(page + 1);
                  }}
                  className="pop pop-coral"
                  disabled={!picks[questions[page].id]}
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={() => {
                    const qid = questions[page].id;
                    if (!lockedQuestions[qid]) {
                      setLockedQuestions((prev) => ({ ...prev, [qid]: true }));
                    }
                    setPage(last + 1);
                  }}
                  className="pop pop-grass"
                  disabled={!picks[questions[page].id]}
                >
                  Done!
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="card px-7 py-7 text-center"
          >
            <div className="text-6xl bob">{allAnswered ? "🎯" : "🤔"}</div>
            <h2 className="font-display text-3xl md:text-4xl text-navy mt-3">
              {allAnswered ? "Ready to send your answers?" : "Hmm — one more!"}
            </h2>
            {!allAnswered ? (
              <p className="font-body text-lg text-navy-soft mt-3">
                You haven&rsquo;t answered every question yet.
              </p>
            ) : (
              <p className="font-body text-lg text-navy-soft mt-3">
                Once you send them, you can&rsquo;t change them.
              </p>
            )}
            <div className="mt-7 flex items-center justify-center gap-3">
              <button onClick={() => setPage(0)} className="pop pop-white">
                ← Look again
              </button>
              <button
                onClick={onSubmit}
                className="pop pop-coral text-xl"
                disabled={!allAnswered || submitting}
              >
                {submitting ? "Sending…" : "📨 Send it!"}
              </button>
            </div>
            {submitError ? (
              <div className="mt-5 card-sm bg-coral-deep text-white px-4 py-3 text-left">
                <p className="font-display text-base">⚠️ Submit failed</p>
                <p className="font-body text-sm mt-1 break-words">
                  {submitError}
                </p>
                <p className="font-body text-xs mt-2 opacity-90">
                  Try again. If it keeps failing, screenshot this and send to Sam.
                </p>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
