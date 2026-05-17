// Audit-only: walks every signed-in user and checks whether they've
// ever SSO'd into discuss.miaswebsites.art (via Intercom contact
// lookup as a proxy — same external_id). Flags users who exist in
// the quiz DB but never showed up on the forum.

import { db, schema } from "@/db";
import { gt, sql } from "drizzle-orm";
import {
  findContactByExternalId,
  intercomApiReady,
} from "@/lib/intercom-api";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

export const forumReconciliationWorkflow: WorkflowDef = {
  id: "forum-reconciliation",
  name: "Forum reconciliation audit",
  description:
    "Walks every quiz-site user with recent activity and verifies they've SSO'd into the Discourse forum at least once. Flags accounts that exist on quiz.miaswebsites.art but never showed up at discuss.miaswebsites.art. Read-only.",
  emoji: "🔗",
  sideEffects: "Read-only. Requires Intercom API access (uses contact lookup as a proxy).",
  async run(): Promise<WorkflowResult> {
    if (!intercomApiReady()) {
      return {
        ok: false,
        summary: "INTERCOM_ACCESS_TOKEN not set — workflow can't proxy-check Discourse presence.",
        targets: [],
        effects: ["Set INTERCOM_ACCESS_TOKEN to enable this."],
      };
    }
    const since = new Date(Date.now() - 30 * 86_400_000);
    const recentUsers = await db.execute(sql<{
      id: string;
      name: string | null;
      email: string;
    }>`
      select distinct u.id::text, u.name, u.email
      from users u
      join visit_logs v on v.user_id = u.id
      where v.created_at > ${since}
      order by u.email
      limit 40
    `);
    const arr = recentUsers as unknown as Array<{
      id: string;
      name: string | null;
      email: string;
    }>;
    const targets: WorkflowTargetResult[] = [];
    let withContact = 0;
    let withoutContact = 0;
    for (const u of arr) {
      const contact = await findContactByExternalId(u.id);
      const found = !!contact;
      if (found) withContact++;
      else withoutContact++;
      targets.push({
        targetId: u.id,
        name: u.name ?? u.email,
        contact: u.email,
        status: found ? "ok" : "warn",
        tasksRemaining: found ? 0 : 1,
        checks: [
          {
            id: "intercom-contact",
            label: "Intercom contact exists",
            severity: found ? "ok" : "warn",
            detail: found
              ? `id=${contact.id}`
              : "No Intercom contact — either never logged in OR never opened Messenger.",
          },
        ],
        emailSent: false,
      });
    }
    return {
      ok: true,
      summary: `🔗 ${withContact} of ${arr.length} recent users have Intercom contacts · ${withoutContact} unreconciled.`,
      targets,
      effects: ["Read-only."],
    };
  },
};
