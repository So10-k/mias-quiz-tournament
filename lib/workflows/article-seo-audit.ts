// Audits every published article for SEO + readability hygiene: dek
// present, cover image set, reasonable read time, slug-vs-title
// alignment, etc.

import { db, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

export const articleSeoAuditWorkflow: WorkflowDef = {
  id: "article-seo-audit",
  name: "Article SEO audit",
  description:
    "Walks every published article + flags missing dek, missing cover image, suspiciously short body, very long title, slug mismatch with title. Read-only.",
  emoji: "🔎",
  sideEffects: "Read-only.",
  async run(): Promise<WorkflowResult> {
    const articles = await db
      .select()
      .from(schema.articles)
      .where(eq(schema.articles.status, "published"))
      .orderBy(asc(schema.articles.title));
    const targets: WorkflowTargetResult[] = articles.map((a) => {
      const checks = [];
      checks.push({
        id: "dek",
        label: "Dek (preheader summary)",
        severity: a.dek && a.dek.trim().length >= 20 ? ("ok" as const) : ("warn" as const),
        detail: a.dek
          ? `${a.dek.length} chars.`
          : "Missing — used by digest preheader + share embeds.",
        remedy: a.dek ? undefined : "Add a 1–2 sentence dek in the article editor.",
      });
      checks.push({
        id: "cover",
        label: "Cover image",
        severity: a.coverImageUrl ? ("ok" as const) : ("warn" as const),
        detail: a.coverImageUrl
          ? a.coverImageUrl
          : "No cover — opengraph image will be the site default.",
      });
      checks.push({
        id: "body",
        label: "Body length",
        severity:
          a.bodyText.length >= 600
            ? ("ok" as const)
            : a.bodyText.length >= 200
              ? ("warn" as const)
              : ("fail" as const),
        detail: `${a.bodyText.length} chars of plaintext body.`,
      });
      checks.push({
        id: "read-time",
        label: "Read minutes set",
        severity: a.readMinutes > 0 ? ("ok" as const) : ("warn" as const),
        detail: `${a.readMinutes} min.`,
      });
      checks.push({
        id: "title-len",
        label: "Title length",
        severity:
          a.title.length >= 8 && a.title.length <= 90
            ? ("ok" as const)
            : ("warn" as const),
        detail: `${a.title.length} chars.`,
      });
      const slugified = a.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      checks.push({
        id: "slug",
        label: "Slug alignment",
        severity: a.slug === slugified ? ("ok" as const) : ("warn" as const),
        detail:
          a.slug === slugified
            ? "Slug matches the title."
            : `Slug "${a.slug}" diverges from canonical "${slugified}". OK if intentional.`,
      });
      const worst = checks.reduce<"ok" | "warn" | "fail">(
        (acc, c) =>
          c.severity === "fail"
            ? "fail"
            : c.severity === "warn" && acc !== "fail"
              ? "warn"
              : acc,
        "ok"
      );
      return {
        targetId: a.id,
        name: a.title,
        contact: `/blog/${a.slug}`,
        status: worst,
        tasksRemaining: checks.filter((c) => c.severity !== "ok").length,
        checks,
        emailSent: false,
      };
    });
    return {
      ok: true,
      summary: `🔎 Audited ${articles.length} published article${articles.length === 1 ? "" : "s"}.`,
      targets,
      effects: ["Read-only."],
    };
  },
};
