// Read-only 30-day site-traffic rollup: top countries, top pages,
// top devices, day-by-day visit volume.

import { db, schema } from "@/db";
import { gt, sql } from "drizzle-orm";
import type { WorkflowDef, WorkflowResult, WorkflowCheck } from "./types";

export const visitAnalyticsWorkflow: WorkflowDef = {
  id: "visit-analytics",
  name: "Visit analytics rollup",
  description:
    "30-day traffic snapshot — top 10 paths, top 8 countries, signed-in vs anonymous mix, busiest day. Drops it all into a PDF you can share with whoever's curious about reach.",
  emoji: "📊",
  sideEffects: "Read-only.",
  async run(): Promise<WorkflowResult> {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const checks: WorkflowCheck[] = [];

    const [{ total, signed }] = await db
      .select({
        total: sql<number>`count(*)::int`,
        signed: sql<number>`count(*) filter (where ${schema.visitLogs.userId} is not null)::int`,
      })
      .from(schema.visitLogs)
      .where(gt(schema.visitLogs.createdAt, since));
    checks.push({
      id: "total",
      label: "30-day total page views",
      severity: total > 0 ? "ok" : "warn",
      detail: `${total.toLocaleString()} views · ${signed.toLocaleString()} signed-in (${total ? Math.round((signed / total) * 100) : 0}%).`,
    });

    const topPaths = (await db.execute(sql<{ p: string; c: number }>`
      select ${schema.visitLogs.path} as p, count(*)::int as c
      from ${schema.visitLogs}
      where ${schema.visitLogs.createdAt} > ${since}
      group by 1 order by 2 desc limit 10
    `)) as unknown as Array<{ p: string; c: number }>;
    for (const r of topPaths) {
      checks.push({
        id: `path-${r.p}`,
        label: `Page · ${r.p}`,
        severity: "ok",
        detail: `${r.c.toLocaleString()} views.`,
      });
    }

    const topCountries = (await db.execute(sql<{ c: string; n: number }>`
      select coalesce(${schema.visitLogs.country}, '(unknown)') as c,
             count(*)::int as n
      from ${schema.visitLogs}
      where ${schema.visitLogs.createdAt} > ${since}
      group by 1 order by 2 desc limit 8
    `)) as unknown as Array<{ c: string; n: number }>;
    for (const r of topCountries) {
      checks.push({
        id: `country-${r.c}`,
        label: `Country · ${r.c}`,
        severity: "ok",
        detail: `${r.n.toLocaleString()} views.`,
      });
    }

    const [busiest] = (await db.execute(sql<{ d: string; c: number }>`
      select date_trunc('day', ${schema.visitLogs.createdAt})::text as d,
             count(*)::int as c
      from ${schema.visitLogs}
      where ${schema.visitLogs.createdAt} > ${since}
      group by 1 order by 2 desc limit 1
    `)) as unknown as Array<{ d: string; c: number }>;
    if (busiest)
      checks.push({
        id: "busiest",
        label: "Busiest day",
        severity: "ok",
        detail: `${busiest.d.slice(0, 10)} · ${busiest.c.toLocaleString()} views.`,
      });

    return {
      ok: true,
      summary: `📊 30d: ${total.toLocaleString()} views across ${topPaths.length} top pages.`,
      targets: [
        {
          targetId: "traffic-30d",
          name: "30-day traffic",
          status: "ok",
          tasksRemaining: 0,
          checks,
          emailSent: false,
        },
      ],
      effects: ["Read-only."],
    };
  },
};
