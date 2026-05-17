// Read-only: flags users with role='author' who haven't published or
// updated an article in 90+ days. Helps decide whether an author
// account can be downgraded.

import { db, schema } from "@/db";
import { desc, eq, sql } from "drizzle-orm";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

export const inactiveAuthorWorkflow: WorkflowDef = {
  id: "inactive-author",
  name: "Inactive author audit",
  description:
    "Lists every user with role='author' and the date of their most recent published article. Flags authors with no published content in 90+ days. Read-only.",
  emoji: "✍️",
  sideEffects: "Read-only.",
  async run(): Promise<WorkflowResult> {
    const authors = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(eq(schema.users.role, "author"));
    const targets: WorkflowTargetResult[] = [];
    for (const a of authors) {
      const [latest] = await db
        .select({
          publishedAt: schema.articles.publishedAt,
          updatedAt: schema.articles.updatedAt,
          title: schema.articles.title,
        })
        .from(schema.articles)
        .where(eq(schema.articles.authorUserId, a.id))
        .orderBy(desc(schema.articles.updatedAt))
        .limit(1);
      const [{ totalArticles }] = await db
        .select({ totalArticles: sql<number>`count(*)::int` })
        .from(schema.articles)
        .where(eq(schema.articles.authorUserId, a.id));
      const ref = latest?.publishedAt ?? latest?.updatedAt ?? null;
      const days = ref
        ? Math.round((Date.now() - ref.getTime()) / 86_400_000)
        : null;
      const stale = days == null ? true : days > 90;
      targets.push({
        targetId: a.id,
        name: a.name ?? a.email,
        contact: a.email,
        status: stale ? "warn" : "ok",
        tasksRemaining: stale ? 1 : 0,
        checks: [
          {
            id: "articles",
            label: "Total articles",
            severity: totalArticles > 0 ? "ok" : "warn",
            detail: `${totalArticles} article${totalArticles === 1 ? "" : "s"} written.`,
          },
          {
            id: "last",
            label: "Last article activity",
            severity: stale ? "warn" : "ok",
            detail: ref
              ? `${ref.toISOString().slice(0, 10)} · ${days} day(s) ago. "${latest?.title}"`
              : "No articles ever written.",
            remedy: stale
              ? "Consider whether this account still needs author role (downgrade in /host)."
              : undefined,
          },
        ],
        emailSent: false,
      });
    }
    return {
      ok: true,
      summary: `✍️ ${targets.filter((t) => t.status === "warn").length} inactive author(s) of ${authors.length} total.`,
      targets,
      effects: ["Read-only."],
    };
  },
};
