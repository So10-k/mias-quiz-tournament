// End-to-end exercise of the engine against the live Neon DB.
// Usage:  DATABASE_URL=... node scripts/e2e.mjs
//
// Creates Mia (author), Alice, Bob; one chapter; Alice passes, Bob fails
// twice and is eliminated. Verifies the tournament auto-completes with
// Alice as the winner.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema.ts";
import { eq } from "drizzle-orm";

import {
  getOrCreateActiveTournament,
  createRound,
  startTournament,
  enroll,
  submitAttempt,
  turnThePage,
  getCast,
} from "../lib/engine.ts";

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

const E_MIA = "e2e-mia@example.com";
const E_ALICE = "e2e-alice@example.com";
const E_BOB = "e2e-bob@example.com";

// Clean any prior e2e state.
async function nuke() {
  // Delete e2e users (cascade handles enrollments, attempts, etc.)
  for (const e of [E_MIA, E_ALICE, E_BOB]) {
    await db.delete(schema.users).where(eq(schema.users.email, e));
  }
  // Delete any active e2e tournaments by slug prefix.
  const ts = await db.select().from(schema.tournaments);
  for (const t of ts) {
    if (t.slug.startsWith("e2e")) {
      await db.delete(schema.tournaments).where(eq(schema.tournaments.id, t.id));
    }
  }
}

async function makeUser(email, name, role = "reader") {
  const [u] = await db
    .insert(schema.users)
    .values({ id: crypto.randomUUID(), email, name, role })
    .returning();
  return u;
}

function pickCorrectFor(round, q) {
  const c = q.options.find((o) => o.isCorrect);
  return c?.id;
}
function pickWrongFor(q) {
  const w = q.options.find((o) => !o.isCorrect);
  return w?.id;
}

async function main() {
  console.log("→ nuke prior e2e data");
  await nuke();

  console.log("→ create users");
  const mia = await makeUser(E_MIA, "Mia", "author");
  const alice = await makeUser(E_ALICE, "Alice");
  const bob = await makeUser(E_BOB, "Bob");

  console.log("→ create tournament");
  const t = await getOrCreateActiveTournament();
  // Force a known slug so nuke can find it.
  await db
    .update(schema.tournaments)
    .set({ slug: "e2e-" + t.slug, strikeLimit: 2 })
    .where(eq(schema.tournaments.id, t.id));

  console.log("→ create two chapters");
  const r1 = await createRound({
    tournamentId: t.id,
    title: "The Riddle Round",
    introProse:
      "In this chapter you will be asked two questions about animals. Begin when ready.",
    passThreshold: 0.6,
    questions: [
      {
        prompt: "What sound does a cow make?",
        questionType: "multiple_choice",
        options: [
          { label: "Moo", isCorrect: true },
          { label: "Meow", isCorrect: false },
          { label: "Bark", isCorrect: false },
        ],
      },
      {
        prompt: "How many legs does a spider have?",
        questionType: "multiple_choice",
        options: [
          { label: "Six", isCorrect: false },
          { label: "Eight", isCorrect: true },
          { label: "Ten", isCorrect: false },
        ],
      },
    ],
  });

  const r2 = await createRound({
    tournamentId: t.id,
    title: "The Counting Round",
    passThreshold: 0.6,
    questions: [
      {
        prompt: "What is two plus two?",
        questionType: "multiple_choice",
        options: [
          { label: "Three", isCorrect: false },
          { label: "Four", isCorrect: true },
          { label: "Five", isCorrect: false },
        ],
      },
      {
        prompt: "Which is bigger?",
        questionType: "multiple_choice",
        options: [
          { label: "Ten", isCorrect: true },
          { label: "Three", isCorrect: false },
        ],
      },
    ],
  });

  console.log("→ enroll Alice & Bob");
  await enroll(alice.id, t.id);
  await enroll(bob.id, t.id);

  console.log("→ begin tournament");
  await startTournament(t.id);

  // Read chapter 1 with options.
  const { getRoundWithQuestions } = await import("../lib/engine.ts");
  const ch1 = await getRoundWithQuestions(r1.roundId);

  console.log("→ Alice answers correctly");
  const alicePicks1 = {};
  for (const q of ch1.questions) alicePicks1[q.id] = pickCorrectFor(ch1, q);
  const aliceR1 = await submitAttempt({
    userId: alice.id,
    roundId: r1.roundId,
    picks: alicePicks1,
  });
  console.log("   →", aliceR1);

  console.log("→ Bob answers incorrectly (strike 1)");
  const bobPicks1 = {};
  for (const q of ch1.questions) bobPicks1[q.id] = pickWrongFor(q);
  const bobR1 = await submitAttempt({
    userId: bob.id,
    roundId: r1.roundId,
    picks: bobPicks1,
  });
  console.log("   →", bobR1);

  console.log("→ turn the page");
  await turnThePage(t.id);

  // Chapter 2.
  const ch2 = await getRoundWithQuestions(r2.roundId);
  console.log("→ Alice answers correctly on chapter 2");
  const alicePicks2 = {};
  for (const q of ch2.questions) alicePicks2[q.id] = pickCorrectFor(ch2, q);
  await submitAttempt({
    userId: alice.id,
    roundId: r2.roundId,
    picks: alicePicks2,
  });

  console.log("→ Bob answers incorrectly on chapter 2 (strike 2 → ELIMINATED)");
  const bobPicks2 = {};
  for (const q of ch2.questions) bobPicks2[q.id] = pickWrongFor(q);
  const bobR2 = await submitAttempt({
    userId: bob.id,
    roundId: r2.roundId,
    picks: bobPicks2,
  });
  console.log("   →", bobR2);

  // Inspect final state.
  const cast = await getCast(t.id);
  const [tNow] = await db
    .select()
    .from(schema.tournaments)
    .where(eq(schema.tournaments.id, t.id))
    .limit(1);

  console.log("\n=== FINAL STATE ===");
  console.log("tournament status:", tNow.status);
  console.log("winnerUserId:", tNow.winnerUserId);
  for (const c of cast) {
    console.log(
      ` - ${c.user.name}: strikes=${c.enrollment.strikeCount} eliminated=${!!c.enrollment.eliminatedAt}`
    );
  }

  // Assertions
  const assert = (cond, msg) => {
    if (!cond) {
      console.error("✗ FAIL:", msg);
      process.exit(1);
    } else console.log("✓", msg);
  };

  assert(bobR2.eliminated === true, "Bob's submission flagged him eliminated");
  assert(tNow.status === "complete", "Tournament auto-completed");
  assert(tNow.winnerUserId === alice.id, "Alice is the winner");

  console.log("\nAll assertions passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
