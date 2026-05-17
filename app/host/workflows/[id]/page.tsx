// Per-workflow detail. Shows the metadata + run-confirmation form +
// recent runs of this workflow.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { findWorkflow, listRuns } from "@/lib/workflows";
import { runWorkflowAction } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  running: "bg-sun text-navy",
  ok: "bg-grass text-white",
  failed: "bg-coral-deep text-white",
};

export default async function HostWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) redirect(`/signin?next=/host/workflows/${id}`);
  if (me.role !== "author") redirect("/");
  const def = findWorkflow(id);
  if (!def) notFound();
  const runs = await listRuns(id);

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 pb-12 flex flex-col gap-5">
        <header className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
              Host · Workflows
            </p>
            <h1 className="font-display text-2xl text-navy mt-0.5">
              {def.emoji} {def.name}
            </h1>
          </div>
          <Link href="/host/workflows" className="pop pop-white text-sm">
            ← Workflows
          </Link>
        </header>

        <section className="card px-6 py-5">
          <h2 className="font-display text-lg text-navy">What this does</h2>
          <p className="font-body text-sm text-navy mt-2 leading-relaxed">
            {def.description}
          </p>
          <div className="mt-4 px-4 py-3 rounded-xl border-3 border-coral-deep bg-coral-soft text-white">
            <p className="font-display text-xs uppercase tracking-[0.18em]">
              ⚠ Side effects
            </p>
            <p className="font-body text-sm mt-1">{def.sideEffects}</p>
          </div>

          <form
            action={runWorkflowAction}
            className="mt-5 flex items-center gap-2 flex-wrap"
          >
            <input type="hidden" name="workflowId" value={def.id} />
            <input
              name="confirm"
              placeholder="Type RUN to confirm"
              required
              minLength={3}
              className="card-sm bg-white px-3 py-1.5 text-sm font-body border-2 border-navy"
            />
            <button className="pop pop-coral text-base">▶ Run workflow</button>
          </form>
          <p className="font-body text-[11px] text-navy-soft mt-3 italic">
            On completion you'll be redirected to the run detail page
            with the full per-target breakdown + PDF download link.
          </p>
        </section>

        <section className="card px-6 py-5">
          <h2 className="font-display text-lg text-navy">📜 Past runs</h2>
          {runs.length === 0 ? (
            <p className="font-body text-sm text-navy-soft mt-2 italic">
              No runs yet.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {runs.map((r) => (
                <li
                  key={r.id}
                  className="card-sm bg-white px-3 py-2 flex items-center gap-3 flex-wrap"
                >
                  <span
                    className={
                      "font-display text-[10px] px-2 py-0.5 rounded border-2 border-navy " +
                      (STATUS_BADGE[r.status] ?? "bg-white text-navy")
                    }
                  >
                    {r.status.toUpperCase()}
                  </span>
                  <span className="font-display text-base text-navy flex-1 min-w-0 truncate">
                    {r.summary ?? "(no summary)"}
                  </span>
                  <span className="font-body text-[11px] text-navy-soft">
                    {r.startedAt.toISOString().replace("T", " ").slice(0, 19)}
                  </span>
                  {r.emailsSent ? (
                    <span className="font-display text-[10px] px-2 py-0.5 rounded bg-sky1 text-navy border-2 border-navy">
                      ✉️ {r.emailsSent}
                    </span>
                  ) : null}
                  <Link
                    href={`/host/workflows/${def.id}/runs/${r.id}`}
                    className="pop pop-coral text-xs px-3 py-1"
                  >
                    Open →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Stage>
  );
}
