import { redirect } from "next/navigation";
import Link from "next/link";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { db, schema } from "@/db";
import { and, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function DebugLastAttemptPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; round?: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/signin");
  if (me.role !== "author") redirect("/play");

  const sp = await searchParams;

  // Pick which user to inspect — defaults to the host themselves so they
  // can quickly see their own most recent attempt. Pass ?user=<userId> or
  // ?user=<email> to inspect someone else.
  let targetUser = me;
  if (sp.user) {
    const looksLikeId = sp.user.length === 12;
    const [u] = looksLikeId
      ? await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, sp.user))
          .limit(1)
      : await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, sp.user))
          .limit(1);
    if (u) targetUser = u;
  }

  // Most recent attempt for the user (any round) unless ?round= specified.
  const conditions = sp.round
    ? and(
        eq(schema.attempts.userId, targetUser.id),
        eq(schema.attempts.roundId, sp.round)
      )
    : eq(schema.attempts.userId, targetUser.id);

  const [attempt] = await db
    .select()
    .from(schema.attempts)
    .where(conditions)
    .orderBy(desc(schema.attempts.startedAt))
    .limit(1);

  if (!attempt) {
    return (
      <Stage scrollable>
        <div className="max-w-3xl mx-auto p-6">
          <h1 className="font-display text-3xl text-navy">🔍 No attempt found</h1>
          <p className="font-body text-base text-navy-soft mt-2">
            User: <code>{targetUser.email}</code> ({targetUser.id})
          </p>
          <Link href="/host" className="pop pop-coral mt-4 inline-flex">
            ← Back
          </Link>
        </div>
      </Stage>
    );
  }

  const [round] = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.id, attempt.roundId))
    .limit(1);

  const qs = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.roundId, attempt.roundId))
    .orderBy(schema.questions.order);

  const opts = await db
    .select()
    .from(schema.options)
    .where(
      qs.length > 0
        ? eq(schema.options.questionId, qs[0].id) // narrowed below
        : eq(schema.options.id, "__none__")
    );
  // Re-fetch options for ALL questions (the narrowed query above is just to
  // satisfy the where signature when qs is empty).
  const allOpts =
    qs.length === 0
      ? []
      : await db.select().from(schema.options).where(
          // Drizzle's inArray
          (await import("drizzle-orm")).inArray(
            schema.options.questionId,
            qs.map((q) => q.id)
          )
        );
  void opts;

  const ans = await db
    .select()
    .from(schema.answers)
    .where(eq(schema.answers.attemptId, attempt.id));

  // Aggregate per question
  const optsByQ = new Map<string, typeof allOpts>();
  for (const o of allOpts) {
    if (!optsByQ.has(o.questionId)) optsByQ.set(o.questionId, []);
    optsByQ.get(o.questionId)!.push(o);
  }
  const ansByQ = new Map(ans.map((a) => [a.questionId, a]));

  // Sanity totals
  const total = qs.length;
  const correctMarked = qs.filter(
    (q) => (optsByQ.get(q.id) ?? []).some((o) => o.isCorrect)
  ).length;
  const ansCorrect = ans.filter((a) => a.isCorrect).length;

  const passThreshold = Number(round?.passThreshold ?? "0.6");
  const recordedScore = Number(attempt.score ?? "0");
  const recomputedScore = total === 0 ? 0 : ansCorrect / total;
  const wouldPass = recomputedScore >= passThreshold;

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto p-6 flex flex-col gap-4">
        <div className="card-sm bg-white px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-2xl text-navy">🔍 Attempt debug</h1>
          <Link href="/host" className="pop pop-white text-sm">
            ← Host
          </Link>
        </div>

        <section className="card px-5 py-4">
          <h2 className="font-display text-lg text-navy">Who & where</h2>
          <p className="font-body text-sm text-navy-soft mt-1">
            User: <strong>{targetUser.email}</strong> ({targetUser.id})
            <br />
            Round: <strong>{round?.title ?? attempt.roundId}</strong> · chapter{" "}
            {round?.chapterNumber} · {round?.isPractice ? "practice" : "real"} ·
            status <code>{round?.status}</code>
          </p>
        </section>

        <section
          className={
            "card px-5 py-4 " +
            (correctMarked < total ? "bg-coral-deep text-white" : "")
          }
        >
          <h2 className="font-display text-lg">
            {correctMarked < total
              ? "⚠️ Bad data!"
              : "✅ Question data looks healthy"}
          </h2>
          <p className="font-body text-sm mt-1">
            <strong>{correctMarked} of {total}</strong> question
            {total === 1 ? "" : "s"} have a correct option flagged.
            {correctMarked < total ? (
              <>
                {" "}
                The remaining{" "}
                <strong>{total - correctMarked}</strong> question
                {total - correctMarked === 1 ? " has" : "s have"} no answer
                marked correct, so picking ANY option scores zero on those.
                <br />
                Fix in the round editor (host panel → Round → Edit) — set the
                isCorrect flag on the right option.
              </>
            ) : null}
          </p>
        </section>

        <section className="card px-5 py-4">
          <h2 className="font-display text-lg text-navy">Score math</h2>
          <table className="font-body text-sm mt-2 w-full">
            <tbody>
              <Row label="Total questions" value={String(total)} />
              <Row label="Answers marked correct (DB)" value={String(ansCorrect)} />
              <Row
                label="Recorded score (attempt.score)"
                value={recordedScore.toFixed(2)}
              />
              <Row
                label="Recomputed score (ansCorrect / total)"
                value={recomputedScore.toFixed(2)}
              />
              <Row
                label="Pass threshold"
                value={passThreshold.toFixed(2)}
              />
              <Row
                label="Recorded passed flag"
                value={attempt.passed === true ? "yes" : attempt.passed === false ? "no" : "—"}
              />
              <Row
                label="Would-pass with recomputed score"
                value={wouldPass ? "yes" : "no"}
              />
              <Row
                label="Submitted at"
                value={
                  attempt.submittedAt
                    ? new Date(attempt.submittedAt).toLocaleString()
                    : "—"
                }
              />
            </tbody>
          </table>
        </section>

        <section className="card px-5 py-4">
          <h2 className="font-display text-lg text-navy">Per-question breakdown</h2>
          <ul className="mt-2 flex flex-col gap-3">
            {qs.map((q, i) => {
              const opt = optsByQ.get(q.id) ?? [];
              const correctOpt = opt.find((o) => o.isCorrect);
              const a = ansByQ.get(q.id);
              const pickedOpt = a ? opt.find((o) => o.id === a.optionId) : null;
              const noCorrect = !correctOpt;
              return (
                <li
                  key={q.id}
                  className={
                    "card-sm px-4 py-3 " +
                    (noCorrect
                      ? "bg-coral-deep text-white"
                      : a?.isCorrect
                      ? "bg-grass text-white"
                      : "bg-white")
                  }
                >
                  <p className="font-display text-base">
                    Q{i + 1}. {q.prompt}
                  </p>
                  <p className="font-body text-sm mt-1 opacity-90">
                    Correct option:{" "}
                    <strong>
                      {correctOpt
                        ? correctOpt.label
                        : "⚠️ NONE FLAGGED — every pick scores zero"}
                    </strong>
                  </p>
                  <p className="font-body text-sm mt-1 opacity-90">
                    User picked:{" "}
                    <strong>{pickedOpt?.label ?? "—"}</strong>
                    {a ? (
                      <span>
                        {" "}
                        ({a.isCorrect ? "marked correct" : "marked wrong"})
                      </span>
                    ) : null}
                  </p>
                  <details className="mt-2">
                    <summary className="font-body text-xs cursor-pointer opacity-80">
                      All options
                    </summary>
                    <ul className="mt-2 font-body text-xs">
                      {opt.map((o) => (
                        <li key={o.id}>
                          {o.isCorrect ? "✓ " : "  "}
                          {o.label}
                          <code className="ml-2 opacity-60">{o.id}</code>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card-sm bg-white px-4 py-3">
          <p className="font-body text-xs text-navy-soft">
            Tip: pass <code>?user=&lt;email&gt;</code> to inspect a specific
            player&rsquo;s most recent attempt, and{" "}
            <code>?round=&lt;roundId&gt;</code> to pin to a round.
          </p>
        </section>
      </div>
    </Stage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-navy/10">
      <td className="py-1 pr-4 text-navy-soft">{label}</td>
      <td className="py-1 font-display text-navy">{value}</td>
    </tr>
  );
}
