// Creates a practice round titled "Warm-up: Science!" with the 8 questions
// the host requested. Idempotent: skips if a practice round with that exact
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

const TITLE = "Warm-up: Science!";
const INTRO =
  "These don't count for anything — they're just to get the hang of how the game works. Have fun!";

const QUESTIONS: Array<{
  prompt: string;
  options: Array<{ label: string; isCorrect: boolean }>;
}> = [
  {
    prompt: "How many days in a week?",
    options: [
      { label: "7", isCorrect: true },
      { label: "5", isCorrect: false },
      { label: "6", isCorrect: false },
      { label: "10", isCorrect: false },
    ],
  },
  {
    prompt: "What gas do plants breathe in?",
    options: [
      { label: "Carbon dioxide", isCorrect: true },
      { label: "Oxygen", isCorrect: false },
      { label: "Helium", isCorrect: false },
      { label: "Methane", isCorrect: false },
    ],
  },
  {
    prompt: "What do plants need to make food?",
    options: [
      { label: "Sunlight", isCorrect: true },
      { label: "Darkness", isCorrect: false },
      { label: "Cold", isCorrect: false },
      { label: "Salt", isCorrect: false },
    ],
  },
  {
    prompt: "Which organ filters blood?",
    options: [
      { label: "Kidney", isCorrect: true },
      { label: "Brain", isCorrect: false },
      { label: "Lung", isCorrect: false },
      { label: "Heart", isCorrect: false },
    ],
  },
  {
    prompt: "What's the freezing point of water (Celsius)?",
    options: [
      { label: "0", isCorrect: true },
      { label: "32", isCorrect: false },
      { label: "100", isCorrect: false },
      { label: "-10", isCorrect: false },
    ],
  },
  {
    prompt: "The brightest star in our sky is…?",
    options: [
      { label: "The Sun", isCorrect: true },
      { label: "Sirius", isCorrect: false },
      { label: "Polaris", isCorrect: false },
      { label: "Betelgeuse", isCorrect: false },
    ],
  },
  {
    prompt: "What was the first artificial satellite?",
    options: [
      { label: "Sputnik 1", isCorrect: true },
      { label: "Hubble", isCorrect: false },
      { label: "Apollo 11", isCorrect: false },
      { label: "Voyager", isCorrect: false },
    ],
  },
  {
    prompt: "Which planet has the strongest gravity?",
    options: [
      { label: "Jupiter", isCorrect: true },
      { label: "Earth", isCorrect: false },
      { label: "Mercury", isCorrect: false },
      { label: "Mars", isCorrect: false },
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
