// Real-question editor for one of the four finals slots:
// rehearsal / losers / winners / championship.
//
// Each question is its own editable card: prompt + four options +
// radio for "which is correct" + up/down reorder + delete. Round
// meta (title, seconds per Q) lives in a card at the top, plus a
// "seed N from library" button for fast filler.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { db, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import {
  getFinalsRoundSummary,
  type FinalsSlot,
} from "@/lib/finals-rounds";
import {
  addQuestionAction,
  deleteQuestionAction,
  generateMysteryChampionshipAction,
  generatePlacesAction,
  moveQuestionAction,
  saveQuestionAction,
  seedFromLibraryAction,
  updateRoundMetaAction,
} from "./actions";

export const dynamic = "force-dynamic";
// Server actions colocated with this route (including the Groq-backed
// generators) inherit this. Groq with 15 hard MC questions can take
// 30-60s; default Vercel function timeout used to be 10s on hobby.
export const maxDuration = 300;

const VALID_SLOTS: FinalsSlot[] = [
  "rehearsal",
  "losers",
  "winners",
  "championship",
];

const SLOT_LABEL: Record<FinalsSlot, string> = {
  rehearsal: "🎬 Rehearsal",
  losers: "🥈 Losers' Final",
  winners: "🏆 Winners' Final",
  championship: "👑 Championship",
};

export default async function FinalsQuestionEditorPage({
  params,
}: {
  params: Promise<{ slot: string }>;
}) {
  const { slot: slotRaw } = await params;
  if (!VALID_SLOTS.includes(slotRaw as FinalsSlot)) notFound();
  const slot = slotRaw as FinalsSlot;

  const me = await currentUser();
  if (!me) redirect(`/signin?next=/host/finals-control/round/${slot}`);
  if (me.role !== "author") redirect("/");

  const summary = await getFinalsRoundSummary(slot);

  const round = summary.roundId
    ? (
        await db
          .select()
          .from(schema.rounds)
          .where(eq(schema.rounds.id, summary.roundId))
          .limit(1)
      )[0] ?? null
    : null;

  const questions =
    summary.roundId != null
      ? await db
          .select()
          .from(schema.questions)
          .where(eq(schema.questions.roundId, summary.roundId))
          .orderBy(asc(schema.questions.order))
      : [];

  const allOptions =
    questions.length > 0
      ? await db
          .select()
          .from(schema.options)
          .where(eq(schema.options.questionId, questions[0].id))
          .orderBy(asc(schema.options.order))
      : [];

  // For each question, pull its options. Doing this per-question
  // keeps the editor simple even if list grows.
  const optionsByQuestion: Map<string, typeof allOptions> = new Map();
  for (const q of questions) {
    const opts = await db
      .select()
      .from(schema.options)
      .where(eq(schema.options.questionId, q.id))
      .orderBy(asc(schema.options.order));
    optionsByQuestion.set(q.id, opts);
  }

  return (
    <Stage scrollable>
      <div className="max-w-4xl mx-auto pt-4 px-4 pb-12 flex flex-col gap-5">
        <header className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
              Host · Finals Control · Questions
            </p>
            <h1 className="font-display text-2xl md:text-3xl text-navy mt-0.5">
              {SLOT_LABEL[slot]} — questions
            </h1>
            <p className="font-body text-sm text-navy-soft mt-1">
              Real questions for the real round.{" "}
              {round ? (
                <>
                  Editing round{" "}
                  <code className="text-xs">{round.id.slice(0, 8)}</code> ·
                  status <strong>{round.liveStatus}</strong>.
                </>
              ) : (
                "Round doesn't exist yet — adding a question creates it."
              )}
            </p>
          </div>
          <Link
            href="/host/finals-control"
            className="pop pop-white text-sm"
          >
            ← Finals Control
          </Link>
        </header>

        {/* ── Round meta ─────────────────────────────────────── */}
        <section className="card px-6 py-5">
          <h2 className="font-display text-lg text-navy">Round meta</h2>
          <form
            action={updateRoundMetaAction}
            className="mt-3 grid md:grid-cols-3 gap-3"
          >
            <input type="hidden" name="slot" value={slot} />
            <label className="font-display text-sm text-navy md:col-span-2">
              Title
              <input
                name="title"
                defaultValue={round?.title ?? ""}
                placeholder={SLOT_LABEL[slot]}
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
              />
            </label>
            <label className="font-display text-sm text-navy">
              Seconds per question
              <input
                name="seconds"
                type="number"
                min={10}
                max={120}
                defaultValue={round?.liveQuestionSeconds ?? 30}
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
              />
            </label>
            <button className="pop pop-coral text-sm md:col-span-3 self-start">
              💾 Save round meta
            </button>
          </form>
        </section>

        {/* ── Quick filler / mystery generator ────────────────── */}
        {slot === "championship" ? (
          <section
            className="card px-6 py-5"
            style={{
              background:
                "linear-gradient(135deg, #1B2A4E 0%, #3B4A7E 100%)",
              color: "#FFFFFF",
              borderColor: "#FFD93D",
            }}
          >
            <h2 className="font-display text-lg" style={{ color: "#FFD93D" }}>
              🎭 Miscellaneous championship generator
            </h2>
            <p className="font-body text-sm mt-1" style={{ color: "#B7E5FF" }}>
              The championship is HARD miscellaneous trivia — every
              question on a different subject so no one can study.
              Click generate → Groq drafts the set and stores it
              blind. You never see the prompts in this editor (the
              cards below show "🎭 hidden") since you might be a
              finalist. Mia / the live HUD see them at play.
            </p>
            <form
              action={generateMysteryChampionshipAction}
              className="mt-3 flex items-center gap-2 flex-wrap"
            >
              <input type="hidden" name="slot" value={slot} />
              <label
                className="font-display text-sm flex items-center gap-2"
                style={{ color: "#FFFFFF" }}
              >
                Count
                <input
                  name="count"
                  type="number"
                  min={5}
                  max={30}
                  defaultValue={15}
                  className="card-sm bg-white px-2 py-1 w-20 text-sm font-body border-2 border-navy text-navy"
                />
              </label>
              <button
                className="pop text-sm"
                style={{
                  background: "#FFD93D",
                  color: "#1B2A4E",
                  border: "3px solid #FFD93D",
                  boxShadow: "4px 4px 0 #FFFFFF",
                }}
              >
                🎭 Generate misc championship questions
              </button>
            </form>
            <p
              className="font-body text-[11px] italic mt-3"
              style={{ color: "#B7E5FF" }}
            >
              Wipes any existing championship questions and replaces
              with a fresh AI batch. Safe to re-run for a new set.
            </p>
          </section>
        ) : (
          <>
            {(slot === "winners" || slot === "losers") ? (
              <section
                className="card px-6 py-5"
                style={{
                  background:
                    "linear-gradient(135deg, #2D5F3F 0%, #4C8B5E 100%)",
                  color: "#FFFFFF",
                  borderColor: "#FFD93D",
                }}
              >
                <h2
                  className="font-display text-lg"
                  style={{ color: "#FFD93D" }}
                >
                  🌍 Famous-places generator (EXTREME)
                </h2>
                <p
                  className="font-body text-sm mt-1"
                  style={{ color: "#E8F5EE" }}
                >
                  Both bracket finals are famous-places trivia at
                  extreme difficulty. Click generate → Groq drafts a
                  fresh set, pulling the OTHER bracket's prompts as an
                  exclusion list so the two rounds never overlap.
                </p>
                <form
                  action={generatePlacesAction}
                  className="mt-3 flex items-center gap-2 flex-wrap"
                >
                  <input type="hidden" name="slot" value={slot} />
                  <label
                    className="font-display text-sm flex items-center gap-2"
                    style={{ color: "#FFFFFF" }}
                  >
                    Count
                    <input
                      name="count"
                      type="number"
                      min={5}
                      max={30}
                      defaultValue={15}
                      className="card-sm bg-white px-2 py-1 w-20 text-sm font-body border-2 border-navy text-navy"
                    />
                  </label>
                  <button
                    className="pop text-sm"
                    style={{
                      background: "#FFD93D",
                      color: "#1B2A4E",
                      border: "3px solid #FFD93D",
                      boxShadow: "4px 4px 0 #FFFFFF",
                    }}
                  >
                    🌍 Generate famous-places questions
                  </button>
                </form>
                <p
                  className="font-body text-[11px] italic mt-3"
                  style={{ color: "#E8F5EE" }}
                >
                  Wipes any existing questions on this round and replaces
                  with a fresh set. Re-run safely; each run pulls the
                  other bracket's prompts so this one stays distinct.
                </p>
              </section>
            ) : null}

            <section className="card px-6 py-5 bg-sky1">
              <h2 className="font-display text-lg text-navy">⚡ Quick filler</h2>
              <p className="font-body text-sm text-navy-soft mt-1">
                Need a fast start? Pull random questions from the
                library. They land at the end of the current list —
                edit or delete anything you don't like.
                {(slot === "winners" || slot === "losers") ? (
                  <>
                    {" "}For the real finals, prefer the famous-places
                    generator above — this is just a fallback.
                  </>
                ) : null}
              </p>
              <form
                action={seedFromLibraryAction}
                className="mt-3 flex items-center gap-2 flex-wrap"
              >
                <input type="hidden" name="slot" value={slot} />
                <label className="font-display text-sm text-navy flex items-center gap-2">
                  Count
                  <input
                    name="count"
                    type="number"
                    min={1}
                    max={30}
                    defaultValue={15}
                    className="card-sm bg-white px-2 py-1 w-20 text-sm font-body border-2 border-navy"
                  />
                </label>
                <button className="pop pop-coral text-sm">
                  📚 Seed from library
                </button>
              </form>
            </section>
          </>
        )}

        {/* ── Question list ──────────────────────────────────── */}
        {slot === "championship" ? (
          <section className="card px-6 py-5 bg-navy text-white">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h2 className="font-display text-lg" style={{ color: "#FFD93D" }}>
                🎭 Sealed questions ({questions.length})
              </h2>
              <span
                className="font-display text-[11px] uppercase tracking-[0.18em] px-2 py-1 rounded-full"
                style={{ background: "#FFD93D", color: "#1B2A4E" }}
              >
                Blind mode
              </span>
            </div>
            <p
              className="font-body text-sm mt-2"
              style={{ color: "#B7E5FF" }}
            >
              For fairness, the prompts and answers are hidden from
              you. The questions are stored — Mia and the live HUD on
              the broadcast machine can see them when the round runs.
              Re-generate above if you want a new set.
            </p>
            {questions.length === 0 ? (
              <p
                className="font-body text-sm mt-3 italic"
                style={{ color: "#B7E5FF" }}
              >
                No mystery questions yet — generate above.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className="card-sm px-3 py-3 text-center"
                    style={{
                      background: "#3B4A7E",
                      borderColor: "#FFD93D",
                      color: "#FFD93D",
                    }}
                  >
                    <div className="font-display text-xs uppercase tracking-[0.16em]">
                      Q{i + 1}
                    </div>
                    <div className="font-body text-xl mt-1">🎭</div>
                    <div
                      className="font-body text-[10px] mt-1"
                      style={{ color: "#B7E5FF" }}
                    >
                      sealed
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="card px-6 py-5">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h2 className="font-display text-lg text-navy">
                ❓ Questions ({questions.length})
              </h2>
              <form action={addQuestionAction}>
                <input type="hidden" name="slot" value={slot} />
                <button className="pop pop-coral text-sm">
                  + Add empty question
                </button>
              </form>
            </div>
            {questions.length === 0 ? (
              <p className="font-body text-sm text-navy-soft mt-3 italic">
                No questions yet. Click "Add empty question" or "Seed
                from library" above.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {questions.map((q, i) => {
                  const opts = optionsByQuestion.get(q.id) ?? [];
                  const isFirst = i === 0;
                  const isLast = i === questions.length - 1;
                  const correctId =
                    opts.find((o) => o.isCorrect)?.id ?? opts[0]?.id ?? "";
                  return (
                  <form
                    key={q.id}
                    action={saveQuestionAction}
                    className="card-sm bg-white px-4 py-4 border-3 border-navy flex flex-col gap-3"
                  >
                    <input type="hidden" name="slot" value={slot} />
                    <input type="hidden" name="questionId" value={q.id} />
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <p className="font-display text-xs uppercase tracking-[0.18em] text-coral-deep">
                        Q{i + 1} / {questions.length}
                      </p>
                      <div className="flex gap-1 items-center">
                        <ReorderButton
                          slot={slot}
                          questionId={q.id}
                          direction="up"
                          disabled={isFirst}
                          label="↑"
                        />
                        <ReorderButton
                          slot={slot}
                          questionId={q.id}
                          direction="down"
                          disabled={isLast}
                          label="↓"
                        />
                        <DeleteButton slot={slot} questionId={q.id} />
                      </div>
                    </div>
                    <label className="font-display text-sm text-navy">
                      Prompt
                      <textarea
                        name="prompt"
                        defaultValue={q.prompt}
                        rows={2}
                        required
                        className="card-sm bg-white px-3 py-2 w-full mt-1 text-base font-body border-2 border-navy"
                      />
                    </label>
                    <div className="flex flex-col gap-2">
                      {opts.map((o, oi) => (
                        <label
                          key={o.id}
                          className="flex items-center gap-2 bg-sky1 px-3 py-2 border-2 border-navy rounded-xl"
                        >
                          <input
                            type="radio"
                            name="correct"
                            value={o.id}
                            defaultChecked={o.id === correctId}
                            className="w-4 h-4"
                          />
                          <span className="font-display text-xs text-coral-deep w-7">
                            {String.fromCharCode(65 + oi)}.
                          </span>
                          <input
                            name={`option_${o.id}_label`}
                            defaultValue={o.label}
                            className="card-sm bg-white px-2 py-1 flex-1 text-base font-body border-2 border-navy"
                          />
                          {o.id === correctId ? (
                            <span className="font-display text-[10px] uppercase px-2 py-0.5 rounded bg-grass text-white">
                              ✓ correct
                            </span>
                          ) : null}
                        </label>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button className="pop pop-white text-xs">
                        💾 Save question
                      </button>
                    </div>
                  </form>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </Stage>
  );
}

function ReorderButton({
  slot,
  questionId,
  direction,
  disabled,
  label,
}: {
  slot: FinalsSlot;
  questionId: string;
  direction: "up" | "down";
  disabled: boolean;
  label: string;
}) {
  return (
    <form action={moveQuestionAction} className="contents">
      <input type="hidden" name="slot" value={slot} />
      <input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        className="font-display text-xs px-2 py-1 rounded-full border-2 border-navy bg-white text-navy disabled:opacity-40"
      >
        {label}
      </button>
    </form>
  );
}

function DeleteButton({
  slot,
  questionId,
}: {
  slot: FinalsSlot;
  questionId: string;
}) {
  return (
    <form action={deleteQuestionAction} className="contents">
      <input type="hidden" name="slot" value={slot} />
      <input type="hidden" name="questionId" value={questionId} />
      <button
        type="submit"
        className="font-display text-xs px-2 py-1 rounded-full border-2 border-coral-deep bg-white text-coral-deep"
      >
        🗑
      </button>
    </form>
  );
}
