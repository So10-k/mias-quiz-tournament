import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { requireStaff } from "@/lib/staff-auth";
import { logStaffAction } from "@/lib/staff-audit";
import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";
import {
  getTodayQuestion,
  generateAndStoreDailyQuestion,
  regenerateDailyQuestion,
  rejectRecommendation,
  listAllResponsesForStaff,
  rereviewAll,
  todayKey,
} from "@/lib/qotd";
import { fetchCurrentEventsContext } from "@/lib/brave";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function generateNowAction() {
  "use server";
  const me = await requireStaff({
    next: "/staff/qotd",
    permission: "forms:write",
  });
  const ctx = await fetchCurrentEventsContext();
  try {
    const result = await generateAndStoreDailyQuestion({
      currentEventsContext: ctx,
    });
    await logStaffAction({
      actor: { id: me.id, email: me.email },
      action: "qotd.generate_manual",
      details: result,
    });
  } catch (e) {
    await logStaffAction({
      actor: { id: me.id, email: me.email },
      action: "qotd.generate_failed",
      details: { error: e instanceof Error ? e.message : String(e) },
    });
    redirect(
      `/staff/qotd?error=${encodeURIComponent(
        e instanceof Error ? e.message : "generation failed"
      )}`
    );
  }
  revalidatePath("/staff/qotd");
  redirect("/staff/qotd?ok=1");
}

async function rejectRecAction(formData: FormData) {
  "use server";
  const me = await requireStaff({
    next: "/staff/qotd",
    permission: "forms:write",
  });
  const recId = String(formData.get("recId") ?? "");
  const reason = String(formData.get("reason") ?? "staff rejection");
  if (!recId) return;
  await rejectRecommendation({ recId, reason });
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "qotd.recommendation_rejected",
    target: recId,
    details: { reason },
  });
  revalidatePath("/staff/qotd");
}

async function regenerateAction(formData: FormData) {
  "use server";
  const me = await requireStaff({
    next: "/staff/qotd",
    permission: "forms:write",
  });
  // Soft confirm: button submits with confirm=yes. Without it (e.g. a
  // hand-rolled POST), do nothing and bounce. We surface a confirm
  // overlay UI-side via the second-click pattern.
  if (formData.get("confirm") !== "yes") {
    redirect("/staff/qotd?error=confirm");
  }
  const ctx = await fetchCurrentEventsContext();
  try {
    const result = await regenerateDailyQuestion({
      currentEventsContext: ctx,
    });
    await logStaffAction({
      actor: { id: me.id, email: me.email },
      action: "qotd.regenerate",
      details: result,
    });
    if (!result.created) {
      redirect(
        `/staff/qotd?error=${encodeURIComponent(result.reason ?? "regen failed")}`
      );
    }
    revalidatePath("/staff/qotd");
    revalidatePath("/qotd");
    revalidatePath("/");
    redirect(
      `/staff/qotd?ok=${encodeURIComponent(
        result.replaced
          ? `replaced — wiped ${result.lostResponses} response${result.lostResponses === 1 ? "" : "s"}`
          : "new question generated"
      )}`
    );
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT"))
      throw e;
    await logStaffAction({
      actor: { id: me.id, email: me.email },
      action: "qotd.regenerate_failed",
      details: { error: e instanceof Error ? e.message : String(e) },
    });
    redirect(
      `/staff/qotd?error=${encodeURIComponent(
        e instanceof Error ? e.message : "regen failed"
      )}`
    );
  }
}

async function rereviewAction() {
  "use server";
  const me = await requireStaff({
    next: "/staff/qotd",
    permission: "forms:write",
  });
  const stats = await rereviewAll();
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "qotd.rereview",
    details: stats,
  });
  revalidatePath("/staff/qotd");
  redirect(
    `/staff/qotd?ok=${encodeURIComponent(
      `re-reviewed ${stats.responsesReviewed} resp · hid ${stats.responsesNewlyHidden} · unhid ${stats.responsesUnhidden} · rejected ${stats.recsNewlyRejected}/${stats.recsReviewed} recs`
    )}`
  );
}

async function hideResponseAction(formData: FormData) {
  "use server";
  const me = await requireStaff({
    next: "/staff/qotd",
    permission: "forms:write",
  });
  const responseId = String(formData.get("responseId") ?? "");
  const hide = formData.get("hide") === "yes";
  if (!responseId) return;
  await db
    .update(schema.qotdResponses)
    .set({ hidden: hide })
    .where(eq(schema.qotdResponses.id, responseId));
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: hide ? "qotd.response_hidden" : "qotd.response_unhidden",
    target: responseId,
  });
  revalidatePath("/staff/qotd");
}

export default async function StaffQotdPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireStaff({
    next: "/staff/qotd",
    permission: "forms:read",
  });
  const sp = await searchParams;

  const today = await getTodayQuestion();
  const responses = today ? await listAllResponsesForStaff(today.id) : [];

  const pending = await db
    .select({
      id: schema.qotdRecommendations.id,
      topic: schema.qotdRecommendations.topic,
      status: schema.qotdRecommendations.status,
      createdAt: schema.qotdRecommendations.createdAt,
      userName: schema.users.name,
      userEmail: schema.users.email,
    })
    .from(schema.qotdRecommendations)
    .leftJoin(
      schema.users,
      eq(schema.users.id, schema.qotdRecommendations.userId)
    )
    .orderBy(desc(schema.qotdRecommendations.createdAt))
    .limit(50);

  const recentQs = await db
    .select()
    .from(schema.qotdQuestions)
    .orderBy(desc(schema.qotdQuestions.forDate))
    .limit(7);

  return (
    <Stage scrollable>
      <div className="max-w-4xl mx-auto pt-4 px-4 flex flex-col gap-5 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">
            💡 QOTD admin
          </h1>
          <Link href="/staff" className="pop pop-white text-sm">
            ← Overview
          </Link>
        </div>

        {sp.ok ? (
          <div className="card-sm bg-grass text-white px-4 py-3">
            <p className="font-display text-sm">✓ Done.</p>
          </div>
        ) : null}
        {sp.error ? (
          <div className="card-sm bg-coral text-white px-4 py-3">
            <p className="font-display text-sm">⚠️ {sp.error}</p>
          </div>
        ) : null}

        {/* Today */}
        <section className="card px-5 py-5 flex flex-col gap-3">
          <h2 className="font-display text-lg text-navy">
            Today · {todayKey()}
          </h2>
          {today ? (
            <>
              <p className="font-display text-base text-navy">
                {today.prompt}
              </p>
              <ul className="font-body text-sm text-navy-soft list-disc pl-5">
                {today.options.map((o) => (
                  <li key={o.value}>
                    {o.value}. {o.label}
                  </li>
                ))}
              </ul>
              {today.context ? (
                <p className="font-body text-xs text-navy-soft italic">
                  Why: {today.context}
                </p>
              ) : null}
            </>
          ) : (
            <p className="font-body text-sm text-navy-soft">
              No question for today yet.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <form action={generateNowAction}>
              <button className="pop pop-coral text-sm">
                {today ? "🔄 Generate (skip if exists)" : "⚡ Generate now"}
              </button>
            </form>
            {today ? (
              <details className="inline-block">
                <summary className="cursor-pointer pop pop-coral text-sm list-none">
                  🗑️ Don&rsquo;t like it — regenerate
                </summary>
                <form
                  action={regenerateAction}
                  className="mt-2 card-sm bg-white px-3 py-3 flex flex-col gap-2"
                >
                  <input type="hidden" name="confirm" value="yes" />
                  <p className="font-body text-xs text-navy">
                    This <strong>deletes</strong> today&rsquo;s question and
                    asks Groq for a new one. Any responses already submitted
                    will be wiped (
                    <strong>
                      {responses.length} so far
                    </strong>
                    ). The current question&rsquo;s recommendation goes back
                    to the pending queue.
                  </p>
                  <button
                    className="pop pop-coral text-xs self-start"
                    type="submit"
                  >
                    Yes, throw it out and regenerate
                  </button>
                </form>
              </details>
            ) : null}
            <form action={rereviewAction}>
              <button
                className="pop pop-yellow text-sm"
                title="Re-run safeguard on all existing responses + recommendations"
              >
                🛡️ Re-review existing data
              </button>
            </form>
          </div>
          <p className="font-body text-xs text-navy-soft">
            Auto-runs daily at 11:00 UTC (~6–7am ET) via Vercel Cron.
            Generate is idempotent — won&rsquo;t overwrite. Regenerate is
            destructive — wipes responses + reverts the recommendation.
            Re-review fires the safeguard prompt against everything already
            in the DB; use it after tightening rules to catch stragglers.
          </p>
        </section>

        {/* Today's responses (full audit view) */}
        {today ? (
          <section className="card px-5 py-5 flex flex-col gap-3">
            <h2 className="font-display text-lg text-navy">
              Today&rsquo;s responses ({responses.length})
            </h2>
            {responses.length === 0 ? (
              <p className="font-body text-sm text-navy-soft">
                Nobody has answered yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {responses.map((r) => (
                  <li
                    key={r.id}
                    className={
                      "card-sm px-3 py-2 flex items-center gap-3 " +
                      (r.hidden ? "bg-coral-deep/10" : "bg-white")
                    }
                  >
                    <span className="font-display text-sm text-navy flex-1 min-w-0 truncate">
                      <span className="text-coral-deep mr-2">
                        {r.choice === "other" ? "💬" : `${r.choice}.`}
                      </span>
                      {r.choice === "other"
                        ? r.otherTextClean ?? r.otherTextRaw ?? "—"
                        : "(option pick)"}
                      {r.choice === "other" && r.hidden ? (
                        <span className="ml-2 text-xs text-coral-deep">
                          [HIDDEN]
                        </span>
                      ) : null}
                    </span>
                    <span className="font-body text-xs text-navy-soft truncate max-w-[20ch]">
                      {r.userName ?? r.userEmail ?? "—"}
                    </span>
                    {r.choice === "other" ? (
                      <form action={hideResponseAction}>
                        <input
                          type="hidden"
                          name="responseId"
                          value={r.id}
                        />
                        <input
                          type="hidden"
                          name="hide"
                          value={r.hidden ? "no" : "yes"}
                        />
                        <button className="pop pop-white text-xs">
                          {r.hidden ? "show" : "hide"}
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {/* Recommendation queue */}
        <section className="card px-5 py-5 flex flex-col gap-3">
          <h2 className="font-display text-lg text-navy">
            Recommendation queue
          </h2>
          {pending.length === 0 ? (
            <p className="font-body text-sm text-navy-soft">
              No suggestions yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pending.map((r) => (
                <li
                  key={r.id}
                  className="card-sm bg-white px-3 py-2 flex items-center gap-3"
                >
                  <span className="font-display text-sm text-navy flex-1 min-w-0">
                    {r.topic}
                  </span>
                  <span className="font-body text-xs text-navy-soft truncate max-w-[16ch]">
                    {r.userName ?? r.userEmail ?? "—"}
                  </span>
                  <span
                    className={
                      "font-display text-xs px-2 py-0.5 rounded-md border-2 border-navy " +
                      (r.status === "used"
                        ? "bg-grass text-white"
                        : r.status === "rejected"
                          ? "bg-coral-deep text-white"
                          : "bg-sun text-navy")
                    }
                  >
                    {r.status}
                  </span>
                  {r.status === "pending" ? (
                    <form action={rejectRecAction}>
                      <input type="hidden" name="recId" value={r.id} />
                      <input
                        type="hidden"
                        name="reason"
                        value="staff rejection"
                      />
                      <button className="pop pop-coral text-xs">
                        reject
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent questions archive */}
        <section className="card px-5 py-5 flex flex-col gap-3">
          <h2 className="font-display text-lg text-navy">Last 7 days</h2>
          {recentQs.length === 0 ? (
            <p className="font-body text-sm text-navy-soft">
              No history yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {recentQs.map((q) => (
                <li
                  key={q.id}
                  className="font-body text-sm text-navy flex items-baseline gap-3"
                >
                  <span className="text-navy-soft text-xs w-24 shrink-0">
                    {q.forDate}
                  </span>
                  <span className="flex-1 truncate">{q.prompt}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Stage>
  );
}
