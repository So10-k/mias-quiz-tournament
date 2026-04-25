"use client";

import { useState } from "react";
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

  const last = questions.length - 1;
  const allAnswered = questions.every((q) => picks[q.id]);

  const onSubmit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
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
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pt-4">
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
            <p className="font-display text-base text-navy-soft uppercase tracking-wider">
              Question {page + 1} of {questions.length}
            </p>
            <h2 className="font-display text-3xl md:text-4xl text-navy mt-2">
              {questions[page].prompt}
            </h2>

            <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-3">
              {questions[page].options.map((o, oi) => {
                const picked = picks[questions[page].id] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() =>
                      setPicks((p) => ({ ...p, [questions[page].id]: o.id }))
                    }
                    className={
                      "pop text-left text-lg w-full justify-start " +
                      (picked
                        ? palette[oi % palette.length]
                        : "pop-white")
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
                  onClick={() => setPage(page + 1)}
                  className="pop pop-coral"
                  disabled={!picks[questions[page].id]}
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={() => setPage(last + 1)}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
