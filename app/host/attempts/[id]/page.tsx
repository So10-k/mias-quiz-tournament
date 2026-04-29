import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { db, schema } from "@/db";
import { eq, asc, inArray } from "drizzle-orm";
import { correctAnswerAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function InspectAttempt({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/signin");
  if (me.role !== "author") redirect("/play");

  const { id } = await params;
  const [attempt] = await db
    .select()
    .from(schema.attempts)
    .where(eq(schema.attempts.id, id))
    .limit(1);
  if (!attempt) notFound();

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, attempt.userId))
    .limit(1);
  const [round] = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.id, attempt.roundId))
    .limit(1);
  if (!round) notFound();

  const questions = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.roundId, round.id))
    .orderBy(asc(schema.questions.order));

  const optionRows =
    questions.length === 0
      ? []
      : await db
          .select()
          .from(schema.options)
          .where(
            inArray(
              schema.options.questionId,
              questions.map((q) => q.id)
            )
          );
  const optsByQ = new Map<string, typeof optionRows>();
  for (const o of optionRows) {
    if (!optsByQ.has(o.questionId)) optsByQ.set(o.questionId, []);
    optsByQ.get(o.questionId)!.push(o);
  }
  for (const [, list] of optsByQ) list.sort((a, b) => a.order - b.order);

  const allAnswers = await db
    .select()
    .from(schema.answers)
    .where(eq(schema.answers.attemptId, attempt.id));
  const ansByQ = new Map(allAnswers.map((a) => [a.questionId, a]));

  const correctCount = allAnswers.filter((a) => a.isCorrect).length;
  const total = questions.length;
  const recomputedScore = total === 0 ? 0 : correctCount / total;
  const threshold = Number(round.passThreshold ?? "0.6");
  const submittedAt = attempt.submittedAt
    ? new Date(attempt.submittedAt).toLocaleString()
    : "—";

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-2xl text-navy">🔍 Inspect attempt</h1>
          <Link href="/host/attempts" className="pop pop-white text-sm">
            ← Feed
          </Link>
        </div>

        <section className="card px-5 py-4">
          <h2 className="font-display text-lg text-navy">Who & where</h2>
          <p className="font-body text-sm text-navy mt-1">
            Player: <strong>{user?.name ?? user?.email ?? "—"}</strong>{" "}
            <code className="text-navy-soft">{attempt.userId}</code>
            <br />
            Round: <strong>{round.title}</strong> · chapter{" "}
            {round.chapterNumber} · {round.isPractice ? "practice" : "real"} ·{" "}
            <code>{round.status}</code>
            <br />
            Submitted: {submittedAt}
          </p>
        </section>

        <section className="card px-5 py-4">
          <h2 className="font-display text-lg text-navy">Score math</h2>
          <table className="font-body text-sm mt-2 w-full">
            <tbody>
              <tr>
                <td className="text-navy-soft pr-3">Correct answers</td>
                <td className="font-display text-navy">
                  {correctCount} / {total}
                </td>
              </tr>
              <tr>
                <td className="text-navy-soft pr-3">Recorded score</td>
                <td className="font-display text-navy">
                  {(Number(attempt.score ?? 0) * 100).toFixed(0)}%
                </td>
              </tr>
              <tr>
                <td className="text-navy-soft pr-3">Recomputed score</td>
                <td className="font-display text-navy">
                  {(recomputedScore * 100).toFixed(0)}%
                </td>
              </tr>
              <tr>
                <td className="text-navy-soft pr-3">Pass threshold</td>
                <td className="font-display text-navy">
                  {(threshold * 100).toFixed(0)}%
                </td>
              </tr>
              <tr>
                <td className="text-navy-soft pr-3">Recorded passed</td>
                <td className="font-display text-navy">
                  {attempt.passed === true
                    ? "✓ yes"
                    : attempt.passed === false
                    ? "✗ no"
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="card px-5 py-4">
          <h2 className="font-display text-lg text-navy">
            Per-question — flip answers silently
          </h2>
          <p className="font-body text-xs text-navy-soft mt-1">
            Toggling an answer recomputes the attempt score, adjusts strikes
            and re-runs bracket auto-resolve. No notification is sent — the
            player only sees the change if they revisit the review screen.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {questions.map((q, i) => {
              const opts = optsByQ.get(q.id) ?? [];
              const correctOpt = opts.find((o) => o.isCorrect);
              const a = ansByQ.get(q.id);
              const pickedOpt = a ? opts.find((o) => o.id === a.optionId) : null;
              const isMarkedCorrect = !!a?.isCorrect;
              return (
                <li
                  key={q.id}
                  className={
                    "card-sm px-4 py-3 " +
                    (isMarkedCorrect ? "bg-grass text-white" : "bg-white")
                  }
                >
                  <p className="font-display text-base">
                    Q{i + 1}. {q.prompt}
                  </p>
                  <p className="font-body text-sm mt-1 opacity-90">
                    Picked:{" "}
                    <strong>{pickedOpt?.label ?? "—"}</strong>
                  </p>
                  <p className="font-body text-sm mt-1 opacity-90">
                    Correct option:{" "}
                    <strong>{correctOpt?.label ?? "(none flagged)"}</strong>
                  </p>
                  {a ? (
                    <form action={correctAnswerAction} className="mt-3 flex flex-wrap gap-2 items-center">
                      <input type="hidden" name="answerId" value={a.id} />
                      <input
                        type="hidden"
                        name="isCorrect"
                        value={isMarkedCorrect ? "false" : "true"}
                      />
                      <span className="font-body text-xs opacity-90">
                        Currently marked{" "}
                        <strong>{isMarkedCorrect ? "correct" : "wrong"}</strong>.
                      </span>
                      <button
                        type="submit"
                        className={
                          "pop text-xs " +
                          (isMarkedCorrect ? "pop-coral" : "pop-grass")
                        }
                      >
                        {isMarkedCorrect ? "Mark wrong ✗" : "Mark correct ✓"}
                      </button>
                    </form>
                  ) : (
                    <p className="font-body text-xs mt-2 opacity-70">
                      No answer row recorded for this question.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Stage>
  );
}
