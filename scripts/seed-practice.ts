// Creates a practice round titled "Warm-up: Math!" with progressively harder questions.
// Idempotent: skips if a practice round with that exact
// title already exists in the active tournament.
//
//   DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/seed-practice.ts

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema.ts";
import { and, eq } from "drizzle-orm";
import {
  getOrCreateActiveTournament,
  createRound,
} from "../lib/engine.ts";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const TITLE = "Warm-up: Math!";
const INTRO =
  "These start simple but ramp up quickly — by the end you'll need real formulas. Good luck.";

const QUESTIONS: Array<{
  prompt: string;
  options: Array<{ label: string; isCorrect: boolean }>;
}> = [
  {
    prompt: "What is 8 + 5?",
    options: [
      { label: "12", isCorrect: false },
      { label: "13", isCorrect: true },
      { label: "14", isCorrect: false },
      { label: "11", isCorrect: false },
    ],
  },
  {
    prompt: "What is 9 × 6?",
    options: [
      { label: "56", isCorrect: false },
      { label: "63", isCorrect: false },
      { label: "54", isCorrect: true },
      { label: "48", isCorrect: false },
    ],
  },
  {
    prompt: "Solve: 3² + 4²",
    options: [
      { label: "25", isCorrect: true },
      { label: "12", isCorrect: false },
      { label: "49", isCorrect: false },
      { label: "7", isCorrect: false },
    ],
  },
  {
    prompt: "What is √144?",
    options: [
      { label: "10", isCorrect: false },
      { label: "12", isCorrect: true },
      { label: "14", isCorrect: false },
      { label: "16", isCorrect: false },
    ],
  },
  {
    prompt: "Solve for x: 2x + 7 = 19",
    options: [
      { label: "5", isCorrect: false },
      { label: "6", isCorrect: true },
      { label: "7", isCorrect: false },
      { label: "4", isCorrect: false },
    ],
  },
  {
    prompt: "What is the slope of the line passing through (2,3) and (6,11)?",
    options: [
      { label: "3", isCorrect: false },
      { label: "2", isCorrect: true },
      { label: "4", isCorrect: false },
      { label: "1", isCorrect: false },
    ],
  },
  {
    prompt: "If f(x) = 2x² - 3x + 1, what is f(3)?",
    options: [
      { label: "10", isCorrect: true },
      { label: "12", isCorrect: false },
      { label: "9", isCorrect: false },
      { label: "7", isCorrect: false },
    ],
  },
  {
    prompt: "A radioactive substance has a half-life of 10 years. If you start with 80g, how much remains after 20 years?",
    options: [
      { label: "10g", isCorrect: false },
      { label: "40g", isCorrect: false },
      { label: "20g", isCorrect: true },
      { label: "5g", isCorrect: false },
    ],
  },
  {
    prompt: "Using the ideal gas law PV = nRT, if pressure doubles and temperature stays constant, what happens to volume?",
    options: [
      { label: "It halves", isCorrect: true },
      { label: "It doubles", isCorrect: false },
      { label: "It stays the same", isCorrect: false },
      { label: "It quadruples", isCorrect: false },
    ],
  },
  {
    prompt: "In optics, aperture diameter doubles. How does light-gathering power change?",
    options: [
      { label: "Doubles", isCorrect: false },
      { label: "Quadruples", isCorrect: true },
      { label: "Halves", isCorrect: false },
      { label: "Stays the same", isCorrect: false },
    ],
  },
];

async function main() {
  const t = await getOrCreateActiveTournament();
  console.log(`→ active tournament: ${t.id}`);

  const existing = await db
    .select()
    .from(schema.rounds)
    .where(
      and(
        eq(schema.rounds.tournamentId, t.id),
        eq(schema.rounds.title, TITLE),
        eq(schema.rounds.isPractice, true)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    console.log(
      `✓ practice round "${TITLE}" already exists (id=${existing[0].id}). Nothing to do.`
    );
    return;
  }

  console.log(`→ creating practice round "${TITLE}" with ${QUESTIONS.length} questions`);
  const r = await createRound({
    tournamentId: t.id,
    title: TITLE,
    introProse: INTRO,
    passThreshold: 0.6,
    isPractice: true,
    questions: QUESTIONS.map((q) => ({
      prompt: q.prompt,
      questionType: "multiple_choice",
      options: q.options,
    })),
  });
  console.log(`✓ created practice round id=${r.roundId}, chapterNumber=${r.chapterNumber}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});