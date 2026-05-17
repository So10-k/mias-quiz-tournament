// Read-only: lists the top 25 signed-in visitors by lifetime page
// views. Helps Sam identify who's a power user vs a lurker.

import { db, schema } from "@/db";
import { eq, isNotNull, sql } from "drizzle-orm";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

export const visitorLeaderboardWorkflow: WorkflowDef = {
  id: "visitor-leaderboard",
  name: "Visitor leaderboard",
  description:
    "Top 25 signed-in visitors ranked by lifetime page views, with their last-seen date and country. Read-only.",
  emoji: "🏅",
  sideEffects: "Read-only.",
  async run(): Promise<WorkflowResult> {
    const rows = (await db.execute(sql<{
      user_id: string;
      views: number;
      last_seen: string;
      country: string | null;
    }>`
      select v.user_id::text,
             count(*)::int as views,
             max(v.created_at)::text as last_seen,
             (array_agg(v.country order by v.created_at desc))[1] as country
      from visit_logs v
      where v.user_id is not null
      group by v.user_id
      order by views desc
      limit 25
    `)) as unknown as Array<{
      user_id: string;
      views: number;
      last_seen: string;
      country: string | null;
    }>;
    if (rows.length === 0) {
      return {
        ok: true,
        summary: "No signed-in visits yet.",
        targets: [],
        effects: [],
      };
    }
    const ids = rows.map((r) => r.user_id);
    const users = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(
        sql`${schema.users.id} = ANY(${sql.raw(`ARRAY[${ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")}]`)})`
      );
    const byId = new Map(users.map((u) => [u.id, u]));
    const targets: WorkflowTargetResult[] = rows.map((r, i) => {
      const u = byId.get(r.user_id);
      return {
        targetId: r.user_id,
        name: `#${i + 1}  ${u?.name ?? u?.email ?? "(unknown)"}`,
        contact: u?.email ?? undefined,
        status: "ok",
        tasksRemaining: 0,
        checks: [
          {
            id: "views",
            label: "Lifetime page views",
            severity: "ok",
            detail: `${r.views.toLocaleString()} views.`,
          },
          {
            id: "last",
            label: "Last seen",
            severity: "ok",
            detail: r.last_seen.slice(0, 10),
          },
          {
            id: "country",
            label: "Country",
            severity: "ok",
            detail: r.country ?? "(unknown)",
          },
        ],
        emailSent: false,
      };
    });
    return {
      ok: true,
      summary: `🏅 Top ${rows.length} visitors compiled.`,
      targets,
      effects: ["Read-only."],
    };
  },
};
