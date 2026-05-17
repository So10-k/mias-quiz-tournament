// Seeds three fresh practice rounds with random library questions so
// players have something to warm up on between real rounds.

import { db, schema } from "@/db";
import { sql, eq } from "drizzle-orm";
import { id as makeId } from "@/lib/ids";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

const TITLES = [
  "Practice · Wonders Sampler",
  "Practice · Speed Round",
  "Practice · Bracket Warm-up",
];
const PRACTICE_Q_COUNT = 8;

export const practiceSeederWorkflow: WorkflowDef = {
  id: "practice-seeder",
  name: "Seed practice rounds",
  description:
    "Creates three fresh non-live practice rounds in the active tournament, each populated with 8 random library questions. Useful to give players something to warm up on without affecting the real bracket.",
  emoji: "🎯",
  sideEffects:
    "Writes 3 rounds + 24 questions + 96 options to the DB. Idempotent-ish: a 24h-cooldown check avoids spamming the practice list.",
  async run(): Promise<WorkflowResult> {
    const t =
      (await getActiveTournament()) ?? (await getLatestTournament());
    if (!t) {
      return {
        ok: false,
        summary: "No tournament — create one first.",
        targets: [],
        effects: [],
      };
    }
    // Cooldown — recent practice round added in last 24h?
    const since = new Date(Date.now() - 24 * 3_600_000);
    const [recent] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.rounds)
      .where(
        sql`${schema.rounds.tournamentId} = ${t.id}
            AND ${schema.rounds.isPractice} = true
            AND ${schema.rounds.createdAt} > ${since}`
      );
    if ((recent?.c ?? 0) >= 3) {
      return {
        ok: true,
        summary: "🎯 Already seeded practice rounds in the last 24h — no-op.",
        targets: [],
        effects: ["Cooldown active."],
      };
    }
    const [maxRow] = await db
      .select({
        max: sql<number>`COALESCE(MAX(${schema.rounds.chapterNumber}), 0)`,
      })
      .from(schema.rounds)
      .where(eq(schema.rounds.tournamentId, t.id));
    let nextChapter = (maxRow?.max ?? 0) + 1;

    const targets: WorkflowTargetResult[] = [];

    for (const title of TITLES) {
      const lib = await db
        .select()
        .from(schema.libraryQuestions)
        .orderBy(sql`random()`)
        .limit(PRACTICE_Q_COUNT);
      if (lib.length === 0) {
        return {
          ok: false,
          summary: "Library empty — can't seed.",
          targets: [],
          effects: [],
        };
      }
      const roundId = makeId();
      await db.insert(schema.rounds).values({
        id: roundId,
        tournamentId: t.id,
        chapterNumber: nextChapter++,
        title,
        isPractice: true,
        isLive: false,
        status: "draft",
      });
      for (let qi = 0; qi < lib.length; qi++) {
        const q = lib[qi];
        const qid = makeId();
        await db.insert(schema.questions).values({
          id: qid,
          roundId,
          order: qi,
          prompt: q.prompt,
          questionType: "multiple_choice",
          points: 1,
        });
        for (let oi = 0; oi < q.options.length; oi++) {
          await db.insert(schema.options).values({
            id: makeId(),
            questionId: qid,
            order: oi,
            label: q.options[oi].label,
            isCorrect: q.options[oi].isCorrect,
          });
        }
      }
      targets.push({
        targetId: roundId,
        name: title,
        status: "ok",
        tasksRemaining: 0,
        checks: [
          {
            id: "questions",
            label: "Questions seeded",
            severity: "ok",
            detail: `${lib.length} questions from the library.`,
          },
        ],
        emailSent: false,
      });
    }
    return {
      ok: true,
      summary: `🎯 Seeded ${targets.length} practice rounds.`,
      targets,
      effects: [
        `Inserted ${targets.length} rounds × ${PRACTICE_Q_COUNT} questions.`,
      ],
    };
  },
};
