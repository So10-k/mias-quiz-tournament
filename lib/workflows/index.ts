// Workflow registry. Add a new workflow by importing it here.

import { finalsReadinessWorkflow } from "./finals-readiness";
import { siteHealthAuditWorkflow } from "./site-health-audit";
import { bracketIntegrityWorkflow } from "./bracket-integrity";
import { emailDeliverabilityWorkflow } from "./email-deliverability";
import { libraryAuditWorkflow } from "./library-audit";
import { reEngagementNudgeWorkflow } from "./re-engagement-nudge";
import { broadcastCountdownWorkflow } from "./broadcast-countdown";
import { predictionsReminderWorkflow } from "./predictions-reminder";
import { ndaPendingChaseWorkflow } from "./nda-pending-chase";
import { finalistHandoffPacketWorkflow } from "./finalist-handoff-packet";
import { championCeremonyWorkflow } from "./champion-ceremony";
// ─ Wave 2 ───────────────────────────────────────────────────────────
import { visitAnalyticsWorkflow } from "./visit-analytics";
import { qotdGeneratorWorkflow } from "./qotd-generator";
import { practiceSeederWorkflow } from "./practice-seeder";
import { newsletterDigestWorkflow } from "./newsletter-digest";
import { tournamentArchiveWorkflow } from "./tournament-archive";
import { staleDraftsWorkflow } from "./stale-drafts";
import { articleSeoAuditWorkflow } from "./article-seo-audit";
import { qotdStreakRewardsWorkflow } from "./qotd-streak-rewards";
import { predictionsRecapWorkflow } from "./predictions-recap";
import { eliminatedThankYouWorkflow } from "./eliminated-thank-you";
import { visitorLeaderboardWorkflow } from "./visitor-leaderboard";
import { storageAuditWorkflow } from "./storage-audit";
import { forumReconciliationWorkflow } from "./forum-reconciliation";
import { roundRecapWorkflow } from "./round-recap";
import { inactiveAuthorWorkflow } from "./inactive-author";
import { forumGroupResyncWorkflow } from "./forum-group-resync";
import { sundayRecapWorkflow } from "./sunday-recap";
import { intercomSegmentsWorkflow } from "./intercom-segments";
import type { WorkflowDef, WorkflowResult } from "./types";

import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";
import { id as makeId } from "@/lib/ids";

export const WORKFLOWS: WorkflowDef[] = [
  // Pre-broadcast prep
  finalsReadinessWorkflow,
  ndaPendingChaseWorkflow,
  broadcastCountdownWorkflow,
  finalistHandoffPacketWorkflow,
  // Audits (read-only, safe to re-run)
  siteHealthAuditWorkflow,
  bracketIntegrityWorkflow,
  emailDeliverabilityWorkflow,
  libraryAuditWorkflow,
  visitAnalyticsWorkflow,
  storageAuditWorkflow,
  articleSeoAuditWorkflow,
  inactiveAuthorWorkflow,
  staleDraftsWorkflow,
  forumReconciliationWorkflow,
  intercomSegmentsWorkflow,
  // Engagement
  reEngagementNudgeWorkflow,
  predictionsReminderWorkflow,
  predictionsRecapWorkflow,
  qotdStreakRewardsWorkflow,
  visitorLeaderboardWorkflow,
  newsletterDigestWorkflow,
  sundayRecapWorkflow,
  // Content
  qotdGeneratorWorkflow,
  practiceSeederWorkflow,
  // Operations
  roundRecapWorkflow,
  forumGroupResyncWorkflow,
  // Post-broadcast
  championCeremonyWorkflow,
  eliminatedThankYouWorkflow,
  tournamentArchiveWorkflow,
];

export function findWorkflow(id: string): WorkflowDef | null {
  return WORKFLOWS.find((w) => w.id === id) ?? null;
}

// ─── persistence ────────────────────────────────────────────────────

export type WorkflowRunRow = typeof schema.workflowRuns.$inferSelect;

export async function listRuns(workflowId?: string): Promise<WorkflowRunRow[]> {
  const q = workflowId
    ? db
        .select()
        .from(schema.workflowRuns)
        .where(eq(schema.workflowRuns.workflowId, workflowId))
        .orderBy(desc(schema.workflowRuns.startedAt))
        .limit(20)
    : db
        .select()
        .from(schema.workflowRuns)
        .orderBy(desc(schema.workflowRuns.startedAt))
        .limit(40);
  return q;
}

export async function getRun(runId: string): Promise<WorkflowRunRow | null> {
  const [row] = await db
    .select()
    .from(schema.workflowRuns)
    .where(eq(schema.workflowRuns.id, runId))
    .limit(1);
  return row ?? null;
}

// Internal — the actual workflow execution + result persistence.
// Called by both the synchronous + deferred wrappers below.
async function executeWorkflowCore(args: {
  runId: string;
  def: WorkflowDef;
  triggeredByUserId: string | null;
}): Promise<{ result: WorkflowResult | null; error?: string }> {
  try {
    const result = await args.def.run({
      triggeredByUserId: args.triggeredByUserId,
    });
    const emailsSent = result.targets.reduce(
      (sum, t) => sum + (t.emailSent ? 1 : 0),
      0
    );
    await db
      .update(schema.workflowRuns)
      .set({
        status: result.ok ? "ok" : "failed",
        completedAt: new Date(),
        summary: result.summary,
        resultJson: result as unknown as Record<string, unknown>,
        emailsSent,
      })
      .where(eq(schema.workflowRuns.id, args.runId));
    return { result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(schema.workflowRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: msg.slice(0, 800),
      })
      .where(eq(schema.workflowRuns.id, args.runId));
    return { result: null, error: msg };
  }
}

// Insert a "running" row + return its id, then schedule the actual
// work to run AFTER the HTTP response is sent (Next.js `after()`).
// The browser sees the running row instantly + AutoRefresh flips it
// to ok/failed when the deferred work finishes. Falls back to a
// fire-and-forget Promise if after() isn't available.
export async function executeWorkflowDeferred(args: {
  workflowId: string;
  triggeredByUserId: string | null;
}): Promise<{ runId: string; error?: string }> {
  const def = findWorkflow(args.workflowId);
  if (!def) return { runId: "", error: `unknown workflow: ${args.workflowId}` };
  const runId = makeId();
  await db.insert(schema.workflowRuns).values({
    id: runId,
    workflowId: def.id,
    triggeredByUserId: args.triggeredByUserId,
    status: "running",
  });
  // Defer the real work via Next.js after(). On Vercel this keeps the
  // function alive past the response. Locally it just runs after the
  // current tick.
  try {
    const { after } = await import("next/server");
    after(async () => {
      await executeWorkflowCore({
        runId,
        def,
        triggeredByUserId: args.triggeredByUserId,
      });
    });
  } catch {
    // after() unavailable — fire-and-forget the promise. May be killed
    // if the runtime tears down before it resolves; acceptable
    // fallback because the row is already persisted as 'running'.
    void executeWorkflowCore({
      runId,
      def,
      triggeredByUserId: args.triggeredByUserId,
    });
  }
  return { runId };
}

// Synchronous variant — used by direct-detail-page launches that
// want to wait for completion and redirect to the run detail page.
export async function executeWorkflow(args: {
  workflowId: string;
  triggeredByUserId: string | null;
}): Promise<{ runId: string; result: WorkflowResult | null; error?: string }> {
  const def = findWorkflow(args.workflowId);
  if (!def) {
    return { runId: "", result: null, error: `unknown workflow: ${args.workflowId}` };
  }
  const runId = makeId();
  await db.insert(schema.workflowRuns).values({
    id: runId,
    workflowId: def.id,
    triggeredByUserId: args.triggeredByUserId,
    status: "running",
  });
  const out = await executeWorkflowCore({
    runId,
    def,
    triggeredByUserId: args.triggeredByUserId,
  });
  return { runId, ...out };
}
