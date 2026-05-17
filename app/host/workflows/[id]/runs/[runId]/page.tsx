// Run detail. Renders the structured result with per-target
// breakdown and a PDF download link.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { findWorkflow, getRun } from "@/lib/workflows";
import type {
  WorkflowResult,
  WorkflowTargetResult,
  CheckSeverity,
} from "@/lib/workflows/types";

export const dynamic = "force-dynamic";

const SEV_BADGE: Record<CheckSeverity, string> = {
  ok: "bg-grass text-white",
  warn: "bg-coral text-white",
  fail: "bg-coral-deep text-white",
};

const SEV_GLYPH: Record<CheckSeverity, string> = {
  ok: "✓",
  warn: "⚠",
  fail: "✗",
};

export default async function HostWorkflowRunPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const { id, runId } = await params;
  const me = await currentUser();
  if (!me) redirect(`/signin?next=/host/workflows/${id}/runs/${runId}`);
  if (me.role !== "author") redirect("/");
  const def = findWorkflow(id);
  if (!def) notFound();
  const run = await getRun(runId);
  if (!run) notFound();
  const result = (run.resultJson as unknown as WorkflowResult | null) ?? null;

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 pb-12 flex flex-col gap-5">
        <header className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
              Run {runId.slice(0, 8)}…
            </p>
            <h1 className="font-display text-2xl text-navy mt-0.5">
              {def.emoji} {def.name}
            </h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href={`/host/workflows/${id}`}
              className="pop pop-white text-sm"
            >
              ← {def.name}
            </Link>
            <a
              href={`/host/workflows/${id}/runs/${runId}/pdf`}
              target="_blank"
              className="pop pop-coral text-sm"
            >
              📄 Download PDF
            </a>
          </div>
        </header>

        <section
          className={
            "card px-6 py-5 border-4 " +
            (run.status === "ok"
              ? "border-grass"
              : run.status === "failed"
                ? "border-coral-deep"
                : "border-sun")
          }
        >
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-display text-2xl text-navy">
              {run.summary ?? "(no summary)"}
            </h2>
            <span
              className={
                "font-display text-xs px-3 py-1 rounded-full border-2 border-navy " +
                (run.status === "ok"
                  ? "bg-grass text-white"
                  : run.status === "failed"
                    ? "bg-coral-deep text-white"
                    : "bg-sun text-navy")
              }
            >
              {run.status.toUpperCase()}
            </span>
          </div>
          <p className="font-body text-xs text-navy-soft mt-2">
            Started {run.startedAt.toISOString().replace("T", " ").slice(0, 19)} UTC
            {run.completedAt
              ? ` · finished ${run.completedAt.toISOString().replace("T", " ").slice(0, 19)} UTC`
              : ""}
            {run.emailsSent
              ? ` · ${run.emailsSent} email${run.emailsSent === 1 ? "" : "s"} sent`
              : ""}
          </p>
          {result?.effects?.length ? (
            <ul className="mt-4 flex flex-col gap-1 font-body text-sm text-navy">
              {result.effects.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          ) : null}
          {run.error ? (
            <pre className="mt-3 bg-coral-soft text-white px-3 py-2 rounded-lg text-xs whitespace-pre-wrap">
              {run.error}
            </pre>
          ) : null}
        </section>

        {result?.targets?.length ? (
          <section className="flex flex-col gap-3">
            {result.targets.map((t) => (
              <TargetCard key={t.targetId} t={t} />
            ))}
          </section>
        ) : null}
      </div>
    </Stage>
  );
}

function TargetCard({ t }: { t: WorkflowTargetResult }) {
  return (
    <div
      className={
        "card px-5 py-5 border-4 " +
        (t.status === "ok"
          ? "border-grass"
          : t.status === "warn"
            ? "border-coral"
            : "border-coral-deep")
      }
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="font-display text-xl text-navy">{t.name}</h3>
        <span
          className={
            "font-display text-xs px-3 py-1 rounded-full border-2 border-navy " +
            SEV_BADGE[t.status]
          }
        >
          {t.status.toUpperCase()} · {t.tasksRemaining} task
          {t.tasksRemaining === 1 ? "" : "s"} left
        </span>
      </div>
      {t.contact ? (
        <p className="font-body text-xs text-navy-soft mt-1">
          {t.contact}
          {t.emailSent ? " · ✉️ reminder sent" : ""}
        </p>
      ) : null}
      <ul className="mt-3 flex flex-col gap-2">
        {t.checks.map((c) => (
          <li
            key={c.id}
            className="card-sm bg-white px-3 py-2 flex items-start gap-2"
          >
            <span
              className="inline-block font-display text-sm w-6 text-center"
              style={{
                color:
                  c.severity === "ok"
                    ? "#5BCE7A"
                    : c.severity === "warn"
                      ? "#FF8C42"
                      : "#C9296A",
              }}
            >
              {SEV_GLYPH[c.severity]}
            </span>
            <div className="flex-1">
              <p className="font-display text-sm text-navy">{c.label}</p>
              <p className="font-body text-xs text-navy-soft mt-0.5">
                {c.detail}
              </p>
              {c.remedy ? (
                <p className="font-body text-xs text-coral-deep mt-1 italic">
                  → {c.remedy}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
