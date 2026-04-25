"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

type Option = { id: string; label: string; isCorrect: boolean };
type Question = {
  id: string;
  prompt: string;
  options: Option[];
  myOptionId: string | null;
  myWasCorrect: boolean;
};
type Props = {
  chapterNumber: number;
  title: string;
  intro?: string | null;
  questions: Question[];
  score: number; // 0..1
  passed: boolean;
  reveal: "passed" | "struck" | "eliminated" | null;
  livesLeft: number;
  strikeLimit: number;
  isPractice?: boolean;
};

export function ChapterReview({
  chapterNumber,
  title,
  intro,
  questions,
  score,
  passed,
  reveal,
  livesLeft,
  strikeLimit,
  isPractice = false,
}: Props) {
  const [showReview, setShowReview] = useState(false);
  const correct = questions.filter((q) => q.myWasCorrect).length;

  return (
    <div className="max-w-3xl mx-auto pt-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="card px-7 py-7 text-center"
      >
        {isPractice ? (
          <PracticeBadge passed={passed} />
        ) : reveal === "eliminated" || (!passed && livesLeft <= 0) ? (
          <EliminatedBadge />
        ) : reveal === "struck" || !passed ? (
          <StrikeBadge livesLeft={livesLeft} strikeLimit={strikeLimit} />
        ) : (
          <PassBadge />
        )}

        <p className="font-display text-base text-navy-soft uppercase tracking-wider mt-5">
          {isPractice ? `Practice ${chapterNumber}` : `Round ${chapterNumber}`}
        </p>
        <h1 className="font-display text-3xl md:text-4xl text-navy mt-1">
          {title}
        </h1>
        <p className="font-display text-2xl text-navy mt-3">
          You got <span className="text-coral-deep">{correct} of {questions.length}</span>!
        </p>
        <p className="font-body text-lg text-navy-soft mt-2">
          That&rsquo;s {Math.round(score * 100)}%.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => setShowReview((v) => !v)}
            className="pop pop-white"
          >
            {showReview ? "Hide review" : "👀 Review my answers"}
          </button>
          <Link href="/play" className="pop pop-coral">
            ← Back
          </Link>
        </div>
      </motion.div>

      {showReview ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-5 flex flex-col gap-3"
        >
          {questions.map((q, i) => (
            <div key={q.id} className="card-sm px-5 py-5">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-xl text-navy-soft">
                  {i + 1}.
                </span>
                <h3 className="font-display text-xl text-navy">{q.prompt}</h3>
                <span className="ml-auto text-2xl">
                  {q.myWasCorrect ? "✅" : "❌"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {q.options.map((o, oi) => {
                  const mine = q.myOptionId === o.id;
                  const isCorrect = o.isCorrect;
                  return (
                    <div
                      key={o.id}
                      className={
                        "px-3 py-2 rounded-lg border-2 " +
                        (isCorrect && mine
                          ? "border-grass-deep bg-grass/30"
                          : mine && !isCorrect
                          ? "border-coral-deep bg-coral/20"
                          : isCorrect
                          ? "border-grass-deep bg-grass/10"
                          : "border-navy/30 bg-white")
                      }
                    >
                      <span className="font-display text-base text-navy mr-2">
                        {String.fromCharCode(65 + oi)}.
                      </span>
                      {o.label}
                      {mine ? (
                        <span className="ml-2 font-display text-sm text-navy-soft">
                          (your pick)
                        </span>
                      ) : null}
                      {!mine && isCorrect ? (
                        <span className="ml-2 font-display text-sm text-grass-deep">
                          ← correct
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </motion.div>
      ) : null}
    </div>
  );
}

function PassBadge() {
  return (
    <motion.div
      initial={{ scale: 0.8, rotate: -8 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 12 }}
      className="inline-flex items-center justify-center w-32 h-32 mx-auto rounded-full border-4 border-navy bg-grass shadow-pop-lg"
    >
      <span className="text-6xl">🎉</span>
    </motion.div>
  );
}

function StrikeBadge({
  livesLeft,
  strikeLimit,
}: {
  livesLeft: number;
  strikeLimit: number;
}) {
  return (
    <motion.div
      initial={{ scale: 0.8 }}
      animate={{ scale: 1, x: [0, -4, 4, -2, 2, 0] }}
      transition={{ duration: 0.32 }}
      className="inline-flex flex-col items-center justify-center w-40 h-40 mx-auto rounded-full border-4 border-navy bg-sun shadow-pop-lg"
    >
      <span className="text-5xl">🙈</span>
      <span className="font-display text-base text-navy mt-1">
        {livesLeft} of {strikeLimit} ❤️
      </span>
    </motion.div>
  );
}

function PracticeBadge({ passed }: { passed: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 14 }}
      className="inline-flex flex-col items-center justify-center w-40 h-40 mx-auto rounded-full border-4 border-navy bg-sky2 shadow-pop-lg text-white"
    >
      <span className="text-5xl">{passed ? "🎯" : "🙂"}</span>
      <span className="font-display text-base mt-1">Practice!</span>
      <span className="font-body text-xs px-2 mt-1 text-center">
        Doesn&rsquo;t count toward lives
      </span>
    </motion.div>
  );
}

function EliminatedBadge() {
  return (
    <motion.div
      initial={{ scale: 1.4, rotate: -10 }}
      animate={{ scale: 1, rotate: -4 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="inline-flex flex-col items-center justify-center w-44 h-44 mx-auto rounded-2xl border-4 border-navy bg-coral-deep text-white shadow-pop-lg"
    >
      <span className="text-5xl">💔</span>
      <span className="font-display text-3xl mt-1">OUT!</span>
      <span className="font-body text-xs px-2 mt-1 text-center">
        Don&rsquo;t worry — you can still cheer the others on.
      </span>
    </motion.div>
  );
}
