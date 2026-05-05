"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { submitFormAction } from "@/app/forms/[slug]/actions";
import type { PublicQuestion } from "@/app/forms/[slug]/page";

// Typeform-style runner: one question per page, smooth slide between
// questions, Enter advances. Picture-book themed (sky bg comes from
// Stage/SkyBackground; this just supplies the card + interaction).

type Props = {
  formId: string;
  formTitle: string;
  intro: string | null;
  questions: PublicQuestion[];
  slug: string;
  respondentName: string | null;
};

export function FormRunner({
  formTitle,
  intro,
  questions,
  slug,
  respondentName,
}: Props) {
  // page = -1 (intro, when present), 0..n-1 (questions), n (review)
  const [page, setPage] = useState<number>(intro ? -1 : 0);
  const [answers, setAnswers] = useState<
    Record<string, string | string[] | number | boolean | null>
  >({});
  const [direction, setDirection] = useState<1 | -1>(1);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);

  const last = questions.length - 1;
  const current = page >= 0 && page <= last ? questions[page] : null;

  const isAnswered = useMemo(() => {
    if (!current) return false;
    if (!current.required) return true;
    if (current.type === "statement") return true;
    const v = answers[current.id];
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim().length > 0;
    return true;
  }, [answers, current]);

  function setAnswer(
    qid: string,
    v: string | string[] | number | boolean | null
  ) {
    setAnswers((p) => ({ ...p, [qid]: v }));
  }

  function go(delta: 1 | -1) {
    setDirection(delta);
    setPage((p) => {
      const next = p + delta;
      if (next > last + 1) return last + 1;
      if (next < (intro ? -1 : 0)) return intro ? -1 : 0;
      return next;
    });
  }

  // Enter advances on text-y questions; Shift+Enter adds a newline in
  // long_text. Choice questions advance on selection (handled inline).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      if (e.shiftKey) return;
      if (!current) return;
      if (current.type === "long_text") return; // Enter inserts newline
      if (!isAnswered) return;
      e.preventDefault();
      if (page < last) go(1);
      else if (page === last) go(1); // → review
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, isAnswered, page, last]);

  // Build hidden inputs for the final submit so a server action can read
  // every answer. Multi-selects emit one input per chosen value.
  function hiddenInputs() {
    const els: React.ReactElement[] = [];
    for (const q of questions) {
      const v = answers[q.id];
      if (q.type === "multi_select") {
        const arr = Array.isArray(v) ? v : [];
        for (const item of arr) {
          els.push(
            <input
              key={`${q.id}-${item}`}
              type="hidden"
              name={`q:${q.id}`}
              value={item}
            />
          );
        }
      } else if (v == null) {
        // Skip — server treats absent key as null/empty.
      } else if (typeof v === "boolean") {
        els.push(
          <input
            key={q.id}
            type="hidden"
            name={`q:${q.id}`}
            value={v ? "yes" : "no"}
          />
        );
      } else {
        els.push(
          <input
            key={q.id}
            type="hidden"
            name={`q:${q.id}`}
            value={String(v)}
          />
        );
      }
    }
    return els;
  }

  function reallySubmit() {
    if (submitting || !formRef.current) return;
    setSubmitting(true);
    startTransition(() => {
      formRef.current!.requestSubmit();
    });
  }

  return (
    <div className="max-w-2xl mx-auto pt-4 px-4 select-none">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-5">
        {questions.map((q, i) => {
          const here = page === i;
          const ans = !!answers[q.id];
          return (
            <span
              key={q.id}
              aria-label={`Question ${i + 1}${here ? " (current)" : ans ? " (answered)" : ""}`}
              className={
                "w-3 h-3 rounded-full border-2 border-navy " +
                (here ? "bg-coral" : ans ? "bg-grass" : "bg-white")
              }
            />
          );
        })}
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        {page === -1 && intro ? (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="card px-7 py-9 text-center"
          >
            <p className="font-display text-base text-navy-soft uppercase tracking-wider">
              📝 Form
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-navy mt-2">
              {formTitle}
            </h1>
            <p className="font-body text-lg text-navy mt-5 leading-relaxed whitespace-pre-line">
              {intro}
            </p>
            {respondentName ? (
              <p className="font-body text-xs text-navy-soft mt-5">
                Signed in as <strong>{respondentName}</strong>
              </p>
            ) : null}
            <button
              onClick={() => go(1)}
              className="pop pop-coral text-xl mt-7"
            >
              Let&rsquo;s go →
            </button>
          </motion.div>
        ) : current ? (
          <motion.div
            key={`q-${page}`}
            initial={{
              opacity: 0,
              x: direction > 0 ? 60 : -60,
            }}
            animate={{ opacity: 1, x: 0 }}
            exit={{
              opacity: 0,
              x: direction > 0 ? -60 : 60,
            }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.3, 1] }}
            className="card px-7 py-9"
          >
            <p className="font-display text-sm text-coral-deep uppercase tracking-widest">
              {current.type === "statement"
                ? "Note"
                : `Question ${page + 1} of ${questions.length}`}
              {current.required && current.type !== "statement" ? " · *" : ""}
            </p>
            <h2 className="font-display text-3xl md:text-4xl text-navy mt-2 leading-tight">
              {current.prompt}
            </h2>
            {current.helperText ? (
              <p className="font-body text-base text-navy-soft mt-2">
                {current.helperText}
              </p>
            ) : null}

            <div className="mt-6">
              <QuestionInput
                question={current}
                value={answers[current.id]}
                onChange={(v) => setAnswer(current.id, v)}
                onAdvance={() => go(1)}
              />
            </div>

            <div className="mt-7 flex items-center justify-between gap-3">
              <button
                onClick={() => go(-1)}
                className="pop pop-white"
                disabled={page === 0 && !intro}
              >
                ← Back
              </button>
              {page < last ? (
                <button
                  onClick={() => go(1)}
                  className="pop pop-coral"
                  disabled={!isAnswered}
                >
                  {current.type === "statement" ? "Continue →" : "Next →"}
                </button>
              ) : (
                <button
                  onClick={() => go(1)}
                  className="pop pop-grass"
                  disabled={!isAnswered}
                >
                  Review →
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="card px-7 py-9 text-center"
          >
            <p className="text-6xl">🎯</p>
            <h2 className="font-display text-3xl md:text-4xl text-navy mt-3">
              Ready to send?
            </h2>
            <p className="font-body text-base text-navy-soft mt-3">
              Once you submit, you can&rsquo;t change your answers.
            </p>
            <div className="mt-7 flex items-center justify-center gap-3">
              <button onClick={() => go(-1)} className="pop pop-white">
                ← Look again
              </button>
              <button
                onClick={reallySubmit}
                className="pop pop-coral text-xl"
                disabled={submitting}
              >
                {submitting ? "Sending…" : "📨 Send it!"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden form for the submit action. Lives outside the AnimatePresence
          so it persists across question swaps. */}
      <form
        ref={formRef}
        action={submitFormAction}
        className="hidden"
        aria-hidden
      >
        <input type="hidden" name="slug" value={slug} />
        {hiddenInputs()}
      </form>
    </div>
  );
}

/* ─── per-question input ──────────────────────────────────────────── */

function QuestionInput({
  question: q,
  value,
  onChange,
  onAdvance,
}: {
  question: PublicQuestion;
  value: string | string[] | number | boolean | null | undefined;
  onChange: (v: string | string[] | number | boolean | null) => void;
  onAdvance: () => void;
}) {
  const baseInput =
    "card-sm bg-white px-4 py-3 w-full text-lg font-body";

  if (q.type === "statement") {
    // Statements have no input — the prompt already conveys the message.
    return null;
  }

  if (q.type === "short_text" || q.type === "email") {
    return (
      <input
        type={q.type === "email" ? "email" : "text"}
        autoFocus
        className={baseInput}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          q.type === "email" ? "you@email.com" : "Your answer…"
        }
        maxLength={q.config?.maxLength ?? 400}
      />
    );
  }

  if (q.type === "long_text") {
    return (
      <textarea
        autoFocus
        rows={5}
        className={baseInput}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your answer…"
        maxLength={q.config?.maxLength ?? 4000}
      />
    );
  }

  if (q.type === "yes_no") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {(["yes", "no"] as const).map((v) => {
          const selected = value === (v === "yes");
          return (
            <button
              key={v}
              type="button"
              onClick={() => {
                onChange(v === "yes");
                // Auto-advance after a beat — feels typeform-y.
                setTimeout(onAdvance, 220);
              }}
              className={
                "pop text-xl py-4 " +
                (selected ? "pop-coral" : "pop-white")
              }
            >
              {v === "yes" ? "👍 Yes" : "👎 No"}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === "single_select" && q.options) {
    return (
      <div className="grid grid-cols-1 gap-2">
        {q.options.map((opt, i) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setTimeout(onAdvance, 220);
              }}
              className={
                "pop text-left text-lg py-3 px-4 " +
                (selected ? "pop-coral" : "pop-white")
              }
            >
              <span className="font-display text-base mr-2">
                {String.fromCharCode(65 + i)}.
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === "multi_select" && q.options) {
    const arr = Array.isArray(value) ? value : [];
    function toggle(v: string) {
      if (arr.includes(v)) onChange(arr.filter((x) => x !== v));
      else onChange([...arr, v]);
    }
    return (
      <div className="grid grid-cols-1 gap-2">
        {q.options.map((opt, i) => {
          const selected = arr.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={
                "pop text-left text-lg py-3 px-4 " +
                (selected ? "pop-coral" : "pop-white")
              }
            >
              <span className="font-display text-base mr-2">
                {selected ? "☑" : "☐"}
              </span>
              <span className="font-display text-base mr-2">
                {String.fromCharCode(65 + i)}.
              </span>
              {opt.label}
            </button>
          );
        })}
        <p className="font-body text-xs text-navy-soft mt-1 text-center">
          Pick any number — press <strong>Next</strong> when done.
        </p>
      </div>
    );
  }

  if (q.type === "scale") {
    const min = q.config?.scaleMin ?? 1;
    const max = q.config?.scaleMax ?? 5;
    const minLabel = q.config?.scaleMinLabel;
    const maxLabel = q.config?.scaleMaxLabel;
    const nums = Array.from(
      { length: Math.max(1, max - min + 1) },
      (_, i) => min + i
    );
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {nums.map((n) => {
            const selected = value === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  onChange(n);
                  setTimeout(onAdvance, 220);
                }}
                className={
                  "pop w-12 h-12 text-xl " +
                  (selected ? "pop-coral" : "pop-white")
                }
              >
                {n}
              </button>
            );
          })}
        </div>
        {minLabel || maxLabel ? (
          <div className="flex items-center justify-between text-xs font-body text-navy-soft">
            <span>{minLabel ?? ""}</span>
            <span>{maxLabel ?? ""}</span>
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
