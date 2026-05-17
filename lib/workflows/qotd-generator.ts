// Drafts tomorrow's Question of the Day via Groq + auto-saves it as
// pending. Idempotent — if today's slot is already filled, no-op.

import { db, schema } from "@/db";
import { desc, eq, sql } from "drizzle-orm";
import { id as makeId } from "@/lib/ids";
import { generateDailyQuestion } from "@/lib/groq";
import type { WorkflowDef, WorkflowResult } from "./types";

function tomorrowKey(): string {
  const d = new Date(Date.now() + 86_400_000);
  return d.toISOString().slice(0, 10);
}

export const qotdGeneratorWorkflow: WorkflowDef = {
  id: "qotd-generator",
  name: "Generate tomorrow's QOTD",
  description:
    "Asks Groq to draft the next day's Question of the Day, pulls a recommendation from the queue if any, and saves the question to qotd_questions for the cron to surface tomorrow.",
  emoji: "🎯",
  sideEffects:
    "Writes one row to qotd_questions for tomorrow's date. Idempotent — exits no-op if a question already exists for that date.",
  async run(): Promise<WorkflowResult> {
    const forDate = tomorrowKey();
    const [existing] = await db
      .select()
      .from(schema.qotdQuestions)
      .where(eq(schema.qotdQuestions.forDate, forDate))
      .limit(1);
    if (existing) {
      return {
        ok: true,
        summary: `🎯 Tomorrow (${forDate}) already has a question — no-op.`,
        targets: [
          {
            targetId: forDate,
            name: forDate,
            status: "ok",
            tasksRemaining: 0,
            checks: [
              {
                id: "exists",
                label: "Existing QOTD",
                severity: "ok",
                detail: existing.prompt.slice(0, 120),
              },
            ],
            emailSent: false,
          },
        ],
        effects: ["No new question created."],
      };
    }
    const recent = await db
      .select({ prompt: schema.qotdQuestions.prompt })
      .from(schema.qotdQuestions)
      .orderBy(desc(schema.qotdQuestions.createdAt))
      .limit(20);
    const [rec] = await db
      .select()
      .from(schema.qotdRecommendations)
      .where(eq(schema.qotdRecommendations.status, "pending"))
      .orderBy(sql`random()`)
      .limit(1);
    const generated = await generateDailyQuestion({
      recommendation: rec?.topic ?? null,
      recentQuestionPrompts: recent.map((r) => r.prompt),
    });
    const newId = makeId();
    await db.insert(schema.qotdQuestions).values({
      id: newId,
      forDate,
      prompt: generated.prompt,
      options: generated.options,
      basedOnRecommendationId: rec?.id ?? null,
      context: generated.rationale,
    });
    if (rec) {
      await db
        .update(schema.qotdRecommendations)
        .set({ status: "used", pickedForQuestionId: newId })
        .where(eq(schema.qotdRecommendations.id, rec.id));
    }
    return {
      ok: true,
      summary: `🎯 Drafted tomorrow's QOTD (${forDate}).`,
      targets: [
        {
          targetId: forDate,
          name: `QOTD · ${forDate}`,
          status: "ok",
          tasksRemaining: 0,
          checks: [
            {
              id: "prompt",
              label: "Prompt",
              severity: "ok",
              detail: generated.prompt,
            },
            {
              id: "rationale",
              label: "Why this one",
              severity: "ok",
              detail: generated.rationale,
            },
            rec
              ? {
                  id: "rec",
                  label: "Seeded by recommendation",
                  severity: "ok",
                  detail: rec.topic,
                }
              : {
                  id: "rec",
                  label: "Seeded by recommendation",
                  severity: "warn",
                  detail: "No pending recommendation — picked freely.",
                },
          ],
          emailSent: false,
        },
      ],
      effects: [
        `Inserted qotd_questions row id=${newId}.`,
        rec ? `Recommendation ${rec.id} marked used.` : "",
      ].filter(Boolean),
    };
  },
};
