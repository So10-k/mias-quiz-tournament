// For the most-recently-closed round, generate a per-round recap
// report: pass count, fail count, avg score, top scorers, strikes
// handed out. Read-only.

import { db, schema } from "@/db";
import { and, desc, eq, sql } from "drizzle-orm";
import type { WorkflowDef, WorkflowResult, WorkflowCheck } from "./types";

export const roundRecapWorkflow: WorkflowDef = {
  id: "round-recap",
  name: "Round recap",
  description:
    "Generates a recap for the most-recently-closed real (non-practice) round: how many passed, how many failed, average score, top scorers, strikes handed out. Read-only — output is a PDF you can share or staple to a forum recap.",
  emoji: "📜",
  sideEffects: "Read-only.",
  async run(): Promise<WorkflowResult> {
    const [round] = await db
      .select()
      .from(schema.rounds)
      .where(
        and(
          eq(schema.rounds.status, "closed"),
          eq(schema.rounds.isPractice, false)
        )
      )
      .orderBy(desc(schema.rounds.chapterNumber))
      .limit(1);
    if (!round) {
      return {
        ok: false,
        summary: "No closed real rounds yet.",
        targets: [],
        effects: [],
      };
    }
    const [stats] = await db
      .select({
        attempts: sql<number>`count(*)::int`,
        passed: sql<number>`count(*) filter (where ${schema.attempts.passed} is true)::int`,
        avg: sql<number>`coalesce(avg(${schema.attempts.score}), 0)::float`,
      })
      .from(schema.attempts)
      .where(eq(schema.attempts.roundId, round.id));

    const top = await db
      .select({
        userId: schema.attempts.userId,
        score: schema.attempts.score,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.attempts)
      .innerJoin(schema.users, eq(schema.users.id, schema.attempts.userId))
      .where(eq(schema.attempts.roundId, round.id))
      .orderBy(desc(schema.attempts.score))
      .limit(5);

    const [{ strikes }] = await db
      .select({ strikes: sql<number>`count(*)::int` })
      .from(schema.strikes)
      .where(eq(schema.strikes.roundId, round.id));

    const checks: WorkflowCheck[] = [
      {
        id: "title",
        label: round.title,
        severity: "ok",
        detail: `Chapter ${round.chapterNumber} · closed ${round.closesAt?.toISOString().slice(0, 10) ?? "?"}.`,
      },
      {
        id: "attempts",
        label: "Attempts",
        severity: "ok",
        detail: `${stats?.attempts ?? 0} attempts · ${stats?.passed ?? 0} passed.`,
      },
      {
        id: "avg",
        label: "Average score",
        severity: "ok",
        detail: `${Math.round(Number(stats?.avg ?? 0) * 100)}%.`,
      },
      {
        id: "strikes",
        label: "Strikes handed out",
        severity: strikes > 0 ? "warn" : "ok",
        detail: `${strikes} strike${strikes === 1 ? "" : "s"} this round.`,
      },
      ...top.map((t, i) => ({
        id: `top-${i}`,
        label: `#${i + 1}  ${t.name ?? t.email}`,
        severity: "ok" as const,
        detail: `Score: ${Math.round(Number(t.score ?? 0) * 100)}%.`,
      })),
    ];

    return {
      ok: true,
      summary: `📜 ${round.title} · ${stats?.passed ?? 0}/${stats?.attempts ?? 0} passed.`,
      targets: [
        {
          targetId: round.id,
          name: `Chapter ${round.chapterNumber}: ${round.title}`,
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
