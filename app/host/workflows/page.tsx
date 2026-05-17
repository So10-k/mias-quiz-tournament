// Host workflows dashboard. Four sections, top-down:
//   1. Stat cards (runs lifetime, success rate, emails sent, last run)
//   2. ⚡ Initiate task — popup launcher (in the header)
//   3. ⏱ Active tasks — anything in 'running' state, pulsing
//   4. ✅ Recent completions — last 25 finished runs
//
// AutoRefresh polls every 2s when something is running, every 8s
// otherwise, so active tasks flip to ok/failed without a manual reload.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { AutoRefresh } from "@/components/AutoRefresh";
import { currentUser } from "@/lib/session";
import { WORKFLOWS, listRuns } from "@/lib/workflows";
import { db, schema } from "@/db";
import { sql } from "drizzle-orm";
import { WorkflowLauncher } from "./WorkflowLauncher";

export const dynamic = "force-dynamic";

export default async function HostWorkflowsDashboard() {
  const me = await currentUser();
  if (!me) redirect("/signin?next=/host/workflows");
  if (me.role !== "author") redirect("/");

  const runs = await listRuns();
  const active = runs.filter((r) => r.status === "running");
  const recent = runs.filter((r) => r.status !== "running").slice(0, 25);

  // Stat rollups (lifetime).
  const [{ totalRuns, okRuns, emails }] = await db
    .select({
      totalRuns: sql<number>`count(*)::int`,
      okRuns: sql<number>`count(*) filter (where ${schema.workflowRuns.status} = 'ok')::int`,
      emails: sql<number>`coalesce(sum(${schema.workflowRuns.emailsSent}), 0)::int`,
    })
    .from(schema.workflowRuns);
  const successRate =
    totalRuns > 0 ? Math.round((okRuns / totalRuns) * 100) : 0;
  const lastRun = runs[0]?.startedAt ?? null;

  // Workflow lookup so the run cards can show the emoji + name.
  const defById = new Map(WORKFLOWS.map((w) => [w.id, w]));

  // Only poll fast while something is actively running.
  const pollSeconds = active.length > 0 ? 2 : 8;

  // (WorkflowLauncher opens a popup browser window — the workflow
  //  list is rendered inside the popup at /host/workflows/launch.)

  return (
    <Stage scrollable>
      <AutoRefresh seconds={pollSeconds} />
      <div className="max-w-5xl mx-auto pt-4 px-4 pb-12 flex flex-col gap-5">
        {/* ── Header ─────────────────────────────────────────── */}
        <header className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
              Host · Workflows
            </p>
            <h1 className="font-display text-3xl text-navy mt-0.5">
              🤖 Workflows
            </h1>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <WorkflowLauncher />
            <Link href="/host" className="pop pop-white text-sm">
              ← Host
            </Link>
          </div>
        </header>

        {/* ── Stat cards ─────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Lifetime runs" value={String(totalRuns)} emoji="🤖" />
          <StatCard
            label="Success rate"
            value={`${successRate}%`}
            emoji={successRate >= 90 ? "✅" : successRate >= 70 ? "⚠️" : "🚨"}
          />
          <StatCard label="Emails sent" value={String(emails)} emoji="✉️" />
          <StatCard
            label="Last run"
            value={lastRun ? friendlyRelative(lastRun) : "never"}
            emoji="⏱"
          />
        </section>

        {/* ── Active tasks ───────────────────────────────────── */}
        {active.length > 0 ? (
          <section className="card px-6 py-5 border-4 border-coral-deep relative overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className="font-display text-xl text-navy">⏱ Active tasks</h2>
              <span className="font-display text-xs px-3 py-1 rounded-full border-2 border-navy bg-coral-deep text-white animate-pulse">
                {active.length} RUNNING
              </span>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {active.map((r) => {
                const def = defById.get(r.workflowId);
                return (
                  <li
                    key={r.id}
                    className="card-sm bg-sun px-4 py-3 border-3 border-navy flex items-center gap-3 flex-wrap"
                    style={{
                      boxShadow: "4px 4px 0 #C9296A",
                      animation: "wf-running-pulse 1.8s ease-in-out infinite",
                    }}
                  >
                    <span className="text-3xl">{def?.emoji ?? "🤖"}</span>
                    <span className="flex-1 min-w-0">
                      <span className="font-display text-base text-navy block leading-tight">
                        {def?.name ?? r.workflowId}
                      </span>
                      <span className="font-body text-xs text-navy-soft block">
                        Started {r.startedAt.toISOString().slice(11, 19)} UTC ·
                        ⏳ working…
                      </span>
                    </span>
                    <Spinner />
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* ── Recent completions ─────────────────────────────── */}
        <section className="card px-6 py-5">
          <h2 className="font-display text-xl text-navy">
            ✅ Recent completions
          </h2>
          {recent.length === 0 ? (
            <p className="font-body text-sm text-navy-soft mt-2 italic">
              No completed runs yet — hit{" "}
              <strong>⚡ Initiate task</strong> to start one.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {recent.map((r) => {
                const def = defById.get(r.workflowId);
                return (
                  <li
                    key={r.id}
                    className="card-sm bg-white px-3 py-2 flex items-center gap-3 flex-wrap"
                  >
                    <span className="text-xl">{def?.emoji ?? "🤖"}</span>
                    <span
                      className={
                        "font-display text-[10px] px-2 py-0.5 rounded border-2 border-navy " +
                        (r.status === "ok"
                          ? "bg-grass text-white"
                          : "bg-coral-deep text-white")
                      }
                    >
                      {r.status.toUpperCase()}
                    </span>
                    <span className="font-display text-sm text-navy flex-1 min-w-0 truncate">
                      {r.summary ?? def?.name ?? r.workflowId}
                    </span>
                    {r.emailsSent > 0 ? (
                      <span className="font-display text-[10px] px-2 py-0.5 rounded bg-sky1 text-navy border-2 border-navy">
                        ✉️ {r.emailsSent}
                      </span>
                    ) : null}
                    <span className="font-body text-[11px] text-navy-soft">
                      {friendlyRelative(r.startedAt)}
                    </span>
                    <Link
                      href={`/host/workflows/${r.workflowId}/runs/${r.id}`}
                      className="pop pop-coral text-xs px-3 py-1"
                    >
                      Open
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── All registered workflows ───────────────────────── */}
        <section className="card px-6 py-5 bg-sky1">
          <h2 className="font-display text-xl text-navy">📚 All workflows</h2>
          <p className="font-body text-xs text-navy-soft mt-1">
            Deep-link any workflow to its detail page for past runs +
            PDF downloads.
          </p>
          <div className="mt-3 grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {WORKFLOWS.map((w) => (
              <Link
                key={w.id}
                href={`/host/workflows/${w.id}`}
                className="card-sm bg-white px-3 py-2 flex items-start gap-2 hover:-translate-y-0.5 transition-transform"
                style={{ textDecoration: "none" }}
              >
                <span className="text-xl">{w.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="font-display text-sm text-navy block">
                    {w.name}
                  </span>
                  <span className="font-body text-[11px] text-navy-soft block line-clamp-1">
                    {w.description}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <style>{`
        @keyframes wf-running-pulse {
          0%, 100% { box-shadow: 4px 4px 0 #C9296A, 0 0 0 0 rgba(201, 41, 106, 0.4); }
          50%      { box-shadow: 4px 4px 0 #C9296A, 0 0 0 12px rgba(201, 41, 106, 0); }
        }
      `}</style>
    </Stage>
  );
}

function StatCard({
  label,
  value,
  emoji,
}: {
  label: string;
  value: string;
  emoji: string;
}) {
  return (
    <div
      className="card-sm bg-white px-3 py-3 border-3 border-navy"
      style={{ boxShadow: "4px 4px 0 #FFD93D" }}
    >
      <div className="text-2xl">{emoji}</div>
      <p className="font-display text-2xl text-navy mt-1 leading-none">
        {value}
      </p>
      <p className="font-display text-[10px] uppercase tracking-[0.16em] text-coral-deep mt-1">
        {label}
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block w-5 h-5 rounded-full border-2 border-navy"
      style={{
        borderTopColor: "transparent",
        animation: "wf-spinner 0.7s linear infinite",
      }}
    >
      <style>{`@keyframes wf-spinner { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

function friendlyRelative(d: Date): string {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return Math.round(s) + "s ago";
  const m = s / 60;
  if (m < 60) return Math.round(m) + "m ago";
  const h = m / 60;
  if (h < 24) return Math.round(h) + "h ago";
  return Math.round(h / 24) + "d ago";
}
