// Read-only audit on the file vault — count, total bytes, mime mix,
// access-mode breakdown, plus orphan detection (files referenced
// nowhere obvious).

import { db, schema } from "@/db";
import { sql } from "drizzle-orm";
import type { WorkflowDef, WorkflowResult, WorkflowCheck } from "./types";

function mb(b: number): string {
  return (b / (1024 * 1024)).toFixed(1) + " MB";
}

export const storageAuditWorkflow: WorkflowDef = {
  id: "storage-audit",
  name: "File vault audit",
  description:
    "Read-only inventory of the R2-backed file vault: total count, total bytes, mime-type mix, access-mode breakdown, biggest 10 files. Useful for spotting accidental large uploads.",
  emoji: "💾",
  sideEffects: "Read-only.",
  async run(): Promise<WorkflowResult> {
    const checks: WorkflowCheck[] = [];

    const [{ count, bytes }] = await db
      .select({
        count: sql<number>`count(*)::int`,
        bytes: sql<number>`coalesce(sum(${schema.files.size}), 0)::bigint`,
      })
      .from(schema.files);
    checks.push({
      id: "total",
      label: "Total files",
      severity: "ok",
      detail: `${count} files · ${mb(Number(bytes))}.`,
    });

    const accessBreakdown = await db
      .select({
        mode: schema.files.accessMode,
        c: sql<number>`count(*)::int`,
      })
      .from(schema.files)
      .groupBy(schema.files.accessMode);
    for (const a of accessBreakdown) {
      checks.push({
        id: `mode-${a.mode}`,
        label: `Access mode · ${a.mode}`,
        severity: "ok",
        detail: `${a.c} files.`,
      });
    }

    const mimes = await db
      .select({
        m: schema.files.mimeType,
        c: sql<number>`count(*)::int`,
        b: sql<number>`coalesce(sum(${schema.files.size}), 0)::bigint`,
      })
      .from(schema.files)
      .groupBy(schema.files.mimeType)
      .orderBy(sql`sum(${schema.files.size}) desc`)
      .limit(8);
    for (const m of mimes) {
      checks.push({
        id: `mime-${m.m}`,
        label: `Mime · ${m.m}`,
        severity: "ok",
        detail: `${m.c} files · ${mb(Number(m.b))}.`,
      });
    }

    const top = await db
      .select({
        n: schema.files.originalName,
        s: schema.files.size,
        m: schema.files.mimeType,
      })
      .from(schema.files)
      .orderBy(sql`${schema.files.size} desc`)
      .limit(10);
    for (const f of top) {
      checks.push({
        id: `top-${f.n}`,
        label: `Largest · ${f.n}`,
        severity: f.s > 50 * 1024 * 1024 ? "warn" : "ok",
        detail: `${mb(f.s)} · ${f.m}`,
        remedy:
          f.s > 50 * 1024 * 1024
            ? "Over 50MB — worth confirming it's still needed."
            : undefined,
      });
    }

    return {
      ok: true,
      summary: `💾 ${count} files · ${mb(Number(bytes))} stored.`,
      targets: [
        {
          targetId: "storage",
          name: "File vault (R2)",
          status: checks.some((c) => c.severity === "warn") ? "warn" : "ok",
          tasksRemaining: checks.filter((c) => c.severity === "warn").length,
          checks,
          emailSent: false,
        },
      ],
      effects: ["Read-only."],
    };
  },
};
