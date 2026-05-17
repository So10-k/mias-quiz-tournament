// Generic host-workflow primitive. A Workflow is a server-side
// function the host can trigger from /host/workflows. Each workflow:
//   • exposes static metadata (id, name, description, emoji)
//   • runs an action that returns a structured WorkflowResult
//   • optionally produces a PDF report — generated on-demand from
//     the stored result_json, so the PDF stays accurate even if the
//     report renderer is updated later.

export type CheckSeverity = "ok" | "warn" | "fail";

export type WorkflowCheck = {
  /** Stable key for the check; e.g. "nda-agreed". */
  id: string;
  /** Display label — "Discourse NDA agreed". */
  label: string;
  severity: CheckSeverity;
  /** Short reason / detail surfaced to the human. */
  detail: string;
  /** Optional "what to do next" snippet that gets cited in the
      personalized email. */
  remedy?: string;
};

export type WorkflowTargetResult = {
  /** Stable id (e.g. user.id). */
  targetId: string;
  /** Display name. */
  name: string;
  /** Email or other contact handle for the audit trail. */
  contact?: string;
  /** Worst-of severity across this target's checks. */
  status: CheckSeverity;
  /** What this target is asked to do, if anything. */
  tasksRemaining: number;
  checks: WorkflowCheck[];
  /** True if an email was sent to this target during the run. */
  emailSent: boolean;
  /** Optional flat free-text notes the host can read later. */
  notes?: string[];
};

export type WorkflowResult = {
  ok: boolean;
  /** One-line headline for the run list — "3 of 4 finalists ready". */
  summary: string;
  /** Per-target details. PDF + UI iterate over this. */
  targets: WorkflowTargetResult[];
  /** Side-effect log — useful for "1 email sent, 3 skipped". */
  effects: string[];
};

export type WorkflowDef = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  /** Coarse warning copy shown next to the run button. */
  sideEffects: string;
  /** Server-side runner. Should never throw — wrap in try/catch and
      return ok:false with a useful summary. */
  run(args: { triggeredByUserId: string | null }): Promise<WorkflowResult>;
};
