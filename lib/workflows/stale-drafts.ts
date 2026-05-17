// Surfaces blog articles that have been in 'draft' state for too
// long. Read-only — Sam decides what to do with the list.

import { db, schema } from "@/db";
import { and, asc, eq, lt } from "drizzle-orm";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

export const staleDraftsWorkflow: WorkflowDef = {
  id: "stale-drafts",
  name: "Stale-draft cleanup",
  description:
    "Lists every blog article that has been in 'draft' status for more than 30 days. Helpful for clearing the editor backlog before each season.",
  emoji: "🧹",
  sideEffects: "Read-only.",
  async run(): Promise<WorkflowResult> {
    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    const drafts = await db
      .select({
        id: schema.articles.id,
        slug: schema.articles.slug,
        title: schema.articles.title,
        author: schema.articles.authorName,
        updatedAt: schema.articles.updatedAt,
        createdAt: schema.articles.createdAt,
      })
      .from(schema.articles)
      .where(
        and(
          eq(schema.articles.status, "draft"),
          lt(schema.articles.updatedAt, cutoff)
        )
      )
      .orderBy(asc(schema.articles.updatedAt));

    const targets: WorkflowTargetResult[] = drafts.map((d) => {
      const days = Math.round(
        (Date.now() - d.updatedAt.getTime()) / 86_400_000
      );
      return {
        targetId: d.id,
        name: d.title,
        contact: `/blog/${d.slug}`,
        status: days > 90 ? "fail" : "warn",
        tasksRemaining: 1,
        checks: [
          {
            id: "age",
            label: "Idle for",
            severity: days > 90 ? "fail" : "warn",
            detail: `${days} day(s) since last edit. Author: ${d.author}.`,
            remedy: "Publish, archive, or delete from /host/articles.",
          },
        ],
        emailSent: false,
      };
    });
    return {
      ok: true,
      summary:
        drafts.length === 0
          ? "🧹 No stale drafts — editor is clean."
          : `🧹 ${drafts.length} stale draft${drafts.length === 1 ? "" : "s"} (>30d idle).`,
      targets,
      effects: ["Read-only."],
    };
  },
};
