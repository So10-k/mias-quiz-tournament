// "Answer Capsule" — a 40-60 word definitional summary that AI
// crawlers can extract verbatim. Picture-book themed (sun-yellow
// card with a "📌 Answer" microbadge) so it doubles as a useful UI
// element rather than just SEO ballast.
//
// Always renders inside a `<section data-aeo="answer-capsule">` with
// the question as a `<h2>` and the answer as a `<p>` — clean
// answer-first hierarchy that pairs well with FAQPage JSON-LD on
// the same page.

import type { ReactNode } from "react";

type Props = {
  question: string;
  // Render-prop or string. Plain string preferred for the cleanest
  // crawlable text; ReactNode is allowed for inline formatting.
  answer: ReactNode;
  // Optional secondary copy — extra context shown below the answer.
  // Crawlers can still extract just the `answer` capsule above.
  detail?: ReactNode;
  // The data-aeo-topic attribute is exposed for crawlers + analytics
  // to bucket capsules by subject.
  topic?: string;
};

export function AnswerCapsule({ question, answer, detail, topic }: Props) {
  return (
    <section
      data-aeo="answer-capsule"
      data-aeo-topic={topic}
      className="card relative px-5 py-4 md:px-6 md:py-5"
      style={{
        background:
          "linear-gradient(135deg,#FFE873 0%,#FFD93D 60%,#FFC100 100%)",
        border: "3px solid var(--navy)",
        boxShadow: "5px 5px 0 0 var(--navy)",
      }}
    >
      <span
        aria-hidden
        className="absolute -top-2 -left-2 font-display text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border-2 border-navy bg-coral text-white shadow-pop-sm"
      >
        📌 Answer
      </span>
      <h2 className="font-display text-lg md:text-xl text-navy leading-tight">
        {question}
      </h2>
      <p
        // The capsule answer itself. Keep this 40-60 words for AEO best
        // results — long enough to be genuinely informative, short
        // enough to read as a snippet card.
        data-aeo="answer-text"
        className="font-body text-base md:text-lg text-navy mt-2 leading-relaxed"
      >
        {answer}
      </p>
      {detail ? (
        <div className="font-body text-sm text-navy-soft mt-3 leading-relaxed">
          {detail}
        </div>
      ) : null}
    </section>
  );
}
