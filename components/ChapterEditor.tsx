"use client";

import { useState } from "react";
import { addRound } from "@/app/host/actions";
import { addLibraryAction } from "@/app/host/library-actions";
import { LibraryPicker } from "@/components/LibraryPicker";

type Q = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

const blankQuestion = (): Q => ({
  prompt: "",
  options: ["", ""],
  correctIndex: 0,
});

type LibraryOption = { label: string; isCorrect: boolean };
function fromLibrary(q: { prompt: string; options: LibraryOption[] }): Q {
  return {
    prompt: q.prompt,
    options: q.options.map((o) => o.label),
    correctIndex: Math.max(
      0,
      q.options.findIndex((o) => o.isCorrect)
    ),
  };
}

export function ChapterEditor() {
  const [title, setTitle] = useState("");
  const [intro, setIntro] = useState("");
  const [threshold, setThreshold] = useState(60);
  const [closesAt, setClosesAt] = useState("");
  const [questions, setQuestions] = useState<Q[]>([blankQuestion()]);

  const updateQ = (i: number, patch: Partial<Q>) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q))
    );
  };

  return (
    <form action={addRound} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="font-display text-xl text-navy">Round title</span>
        <input
          name="title"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="The Animal Round"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-display text-xl text-navy">A little intro (optional)</span>
        <textarea
          name="intro"
          rows={3}
          maxLength={800}
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder="In this round we'll learn about animals!"
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <label className="flex flex-col gap-2">
          <span className="font-display text-xl text-navy">Pass score: {threshold}%</span>
          <input
            type="range"
            name="threshold"
            min={0}
            max={100}
            step={5}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full"
          />
          <span className="font-body text-sm text-navy-soft">
            Players below this lose a heart.
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="font-display text-xl text-navy">Closes at (optional)</span>
          <input
            type="datetime-local"
            name="closesAt"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
          />
        </label>
      </div>

      <input type="hidden" name="questionCount" value={questions.length} />

      <div className="flex flex-col gap-5 mt-2">
        {questions.map((q, qi) => (
          <fieldset
            key={qi}
            className="card-sm px-5 py-5 flex flex-col gap-3"
            style={{ background: "white" }}
          >
            <legend className="px-2 font-display text-base text-navy bg-sun rounded-md border-3 border-navy">
              Question {qi + 1}
            </legend>

            <label className="flex flex-col gap-2">
              <span className="font-display text-lg text-navy">Question</span>
              <input
                name={`q${qi}.prompt`}
                required
                maxLength={400}
                value={q.prompt}
                onChange={(e) => updateQ(qi, { prompt: e.target.value })}
                placeholder="What sound does a cow make?"
              />
            </label>

            <div className="flex flex-col gap-2">
              <span className="font-display text-lg text-navy">
                Answers — tap the right one!
              </span>
              <input
                type="hidden"
                name={`q${qi}.correct`}
                value={q.correctIndex}
              />
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => updateQ(qi, { correctIndex: oi })}
                    aria-label={`Mark option ${oi + 1} correct`}
                    className={
                      "shrink-0 w-10 h-10 rounded-full border-3 border-navy flex items-center justify-center text-xl " +
                      (q.correctIndex === oi
                        ? "bg-grass text-white"
                        : "bg-white text-navy/40")
                    }
                  >
                    {q.correctIndex === oi ? "✓" : String.fromCharCode(65 + oi)}
                  </button>
                  <input
                    name={`q${qi}.opt${oi}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...q.options];
                      next[oi] = e.target.value;
                      updateQ(qi, { options: next });
                    }}
                    className="flex-1"
                    placeholder={`Answer ${String.fromCharCode(65 + oi)}`}
                  />
                  {q.options.length > 2 ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateQ(qi, {
                          options: q.options.filter((_, idx) => idx !== oi),
                          correctIndex:
                            q.correctIndex >= oi
                              ? Math.max(0, q.correctIndex - 1)
                              : q.correctIndex,
                        })
                      }
                      className="font-display text-sm text-coral-deep hover:underline px-2"
                    >
                      remove
                    </button>
                  ) : null}
                </div>
              ))}
              {q.options.length < 6 ? (
                <button
                  type="button"
                  onClick={() =>
                    updateQ(qi, { options: [...q.options, ""] })
                  }
                  className="pop pop-white text-sm self-start"
                >
                  + add another answer
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {questions.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setQuestions((prev) => prev.filter((_, idx) => idx !== qi))
                  }
                  className="font-display text-base text-coral-deep hover:underline"
                >
                  Remove question
                </button>
              ) : null}
              <SaveToLibraryButton question={q} />
            </div>
          </fieldset>
        ))}

        <button
          type="button"
          onClick={() =>
            setQuestions((prev) => [...prev, blankQuestion()])
          }
          className="pop pop-white self-start"
        >
          + Add another question
        </button>

        <LibraryPicker
          onPick={(lq) =>
            setQuestions((prev) => [...prev, fromLibrary(lq)])
          }
        />
      </div>

      <div className="mt-3">
        <button type="submit" className="pop pop-coral text-xl">
          💾 Save round
        </button>
      </div>
    </form>
  );
}

function SaveToLibraryButton({ question }: { question: Q }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("general");
  const [ageMin, setAgeMin] = useState(5);
  const [ageMax, setAgeMax] = useState(99);
  const [difficulty, setDifficulty] = useState(2);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const canSave =
    question.prompt.trim().length > 0 &&
    question.options.length >= 2 &&
    question.options.every((o) => o.trim().length > 0);

  const save = async () => {
    if (!canSave) return;
    setStatus("saving");
    setError(null);
    try {
      await addLibraryAction({
        prompt: question.prompt.trim(),
        options: question.options.map((label, i) => ({
          label: label.trim(),
          isCorrect: i === question.correctIndex,
        })),
        subject,
        ageMin,
        ageMax,
        difficulty,
      } as any);
      setStatus("saved");
      setTimeout(() => setOpen(false), 800);
    } catch (e: any) {
      setStatus("error");
      setError(e?.message ?? "Could not save");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-display text-sm text-grass-deep hover:underline disabled:opacity-50"
        disabled={!canSave}
        title={canSave ? "" : "Fill in the question and answers first"}
      >
        💾 {open ? "Cancel" : "Save to library"}
      </button>

      {open ? (
        <div className="card-sm px-3 py-3 bg-white flex flex-wrap items-center gap-2">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="px-2 py-1 border-2 border-navy rounded-md text-sm"
          >
            {[
              "general", "math", "reading", "science", "history",
              "geography", "animals", "words", "riddles", "logic",
              "art", "music", "sports",
            ].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label className="font-body text-xs text-navy flex items-center gap-1">
            ages
            <input
              type="number"
              min={3}
              max={99}
              value={ageMin}
              onChange={(e) => setAgeMin(Number(e.target.value))}
              className="w-14 px-1 py-0.5 border-2 border-navy rounded-md text-sm"
            />
            <span>–</span>
            <input
              type="number"
              min={3}
              max={99}
              value={ageMax}
              onChange={(e) => setAgeMax(Number(e.target.value))}
              className="w-14 px-1 py-0.5 border-2 border-navy rounded-md text-sm"
            />
          </label>
          <label className="font-body text-xs text-navy flex items-center gap-1">
            diff
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="px-2 py-1 border-2 border-navy rounded-md text-sm"
            >
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={save}
            disabled={status === "saving" || status === "saved"}
            className="pop pop-grass text-xs px-3 py-1"
          >
            {status === "saving"
              ? "Saving…"
              : status === "saved"
              ? "✓ Saved"
              : "Save"}
          </button>
          {error ? (
            <span className="font-body text-xs text-coral-deep">{error}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
