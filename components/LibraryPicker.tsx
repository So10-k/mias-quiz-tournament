"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { fetchLibrary } from "@/app/host/library-actions";

type Option = { label: string; isCorrect: boolean };
type LibraryRow = {
  id: string;
  prompt: string;
  options: Option[];
  subject: string;
  ageMin: number;
  ageMax: number;
  difficulty: number;
  source: "seed" | "host";
};

type Props = {
  onPick: (q: { prompt: string; options: Option[] }) => void;
  alreadyPickedIds?: Set<string>;
};

const SUBJECTS: { value: string; label: string }[] = [
  { value: "", label: "Any subject" },
  { value: "math", label: "Math" },
  { value: "reading", label: "Reading" },
  { value: "science", label: "Science" },
  { value: "history", label: "History" },
  { value: "geography", label: "Geography" },
  { value: "animals", label: "Animals" },
  { value: "words", label: "Words & Spelling" },
  { value: "riddles", label: "Riddles" },
  { value: "logic", label: "Logic" },
  { value: "art", label: "Art" },
  { value: "music", label: "Music" },
  { value: "sports", label: "Sports" },
  { value: "general", label: "General" },
];

const DIFFICULTY_LABEL = (n: number) =>
  ({ 1: "Easy", 2: "Easy-Med", 3: "Medium", 4: "Med-Hard", 5: "Hard" } as Record<number, string>)[n] ?? `${n}`;

export function LibraryPicker({ onPick, alreadyPickedIds }: Props) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [age, setAge] = useState<string>(""); // "" or a number
  const [difficulty, setDifficulty] = useState<string>("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"" | "seed" | "host">("");
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [count, setCount] = useState(0);
  const [subjectCounts, setSubjectCounts] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();

  const filter = useMemo(
    () => ({
      subject: subject || null,
      ageMin: age ? Number(age) : null,
      ageMax: age ? Number(age) : null,
      difficulty: difficulty ? Number(difficulty) : null,
      search: search || null,
      source: source || null,
      limit: 60,
    }),
    [subject, age, difficulty, search, source]
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await fetchLibrary(filter as any);
          setRows(res.rows as any);
          setCount(res.count);
          setSubjectCounts(res.subjectCounts);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("library fetch failed", e);
        }
      });
    }, 180); // debounce
    return () => clearTimeout(t);
  }, [open, filter]);

  return (
    <div className="card-sm bg-white px-5 py-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pop pop-sky text-base"
      >
        📚 {open ? "Hide library" : `Pick from library`}
      </button>

      {open ? (
        <div className="mt-5 flex flex-col gap-3">
          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="px-2 py-1 border-2 border-navy rounded-md font-body text-sm bg-white"
            >
              {SUBJECTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                  {subjectCounts[s.value] != null
                    ? `  (${subjectCounts[s.value]})`
                    : ""}
                </option>
              ))}
            </select>
            <select
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="px-2 py-1 border-2 border-navy rounded-md font-body text-sm bg-white"
            >
              <option value="">Any age</option>
              {Array.from({ length: 11 }, (_, i) => 4 + i).map((a) => (
                <option key={a} value={a}>
                  Age {a}
                </option>
              ))}
            </select>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="px-2 py-1 border-2 border-navy rounded-md font-body text-sm bg-white"
            >
              <option value="">Any difficulty</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABEL(d)}
                </option>
              ))}
            </select>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as any)}
              className="px-2 py-1 border-2 border-navy rounded-md font-body text-sm bg-white"
            >
              <option value="">All sources</option>
              <option value="seed">Built-in</option>
              <option value="host">Mine</option>
            </select>
            <input
              type="text"
              placeholder="search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-2 py-1 border-2 border-navy rounded-md font-body text-sm"
            />
          </div>

          <p className="font-body text-xs text-navy-soft">
            {pending ? "Loading…" : `Showing ${rows.length} of ${count}`}
          </p>

          <ul className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
            {rows.map((q) => {
              const already = alreadyPickedIds?.has(q.id);
              return (
                <li
                  key={q.id}
                  className="px-3 py-2 rounded-lg border-2 border-navy bg-white flex flex-col gap-2"
                >
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="font-display text-base text-navy">
                      {q.prompt}
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="font-display text-xs text-navy bg-sun border-2 border-navy rounded-md px-2 py-0.5">
                        {q.subject}
                      </span>
                      <span className="font-display text-xs text-navy bg-sky1 border-2 border-navy rounded-md px-2 py-0.5">
                        ages {q.ageMin}-{q.ageMax}
                      </span>
                      <span className="font-display text-xs text-white bg-coral border-2 border-navy rounded-md px-2 py-0.5">
                        {DIFFICULTY_LABEL(q.difficulty)}
                      </span>
                      {q.source === "host" ? (
                        <span className="font-display text-xs text-white bg-grass border-2 border-navy rounded-md px-2 py-0.5">
                          mine
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-1 text-sm font-body text-navy-soft">
                    {q.options.map((o, oi) => (
                      <li key={oi}>
                        <span className="font-display text-navy">
                          {String.fromCharCode(65 + oi)}.
                        </span>{" "}
                        <span className={o.isCorrect ? "text-grass-deep font-display" : ""}>
                          {o.label}
                          {o.isCorrect ? " ✓" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        onPick({
                          prompt: q.prompt,
                          options: q.options,
                        })
                      }
                      className="pop pop-coral text-xs px-3 py-1"
                      disabled={already}
                    >
                      {already ? "✓ added" : "+ add to round"}
                    </button>
                  </div>
                </li>
              );
            })}
            {rows.length === 0 && !pending ? (
              <li className="font-body text-sm text-navy-soft">
                No questions match these filters.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
