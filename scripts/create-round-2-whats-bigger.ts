// Create Round 2: "What's Bigger?" — 15 size-comparison questions designed
// to be age-neutral (works as well for a 7-year-old as a 90-year-old).
// Inserts as a DRAFT (status="draft", isPractice=false). The host has to
// click "Start Round" on /staff/control to publish it.
//
//   npx tsx scripts/create-round-2-whats-bigger.ts          # dry-run
//   npx tsx scripts/create-round-2-whats-bigger.ts --do-it  # actually inserts

import { readFileSync } from "node:fs";
function loadEnvFile(path: string, override: boolean) {
  try {
    const t = readFileSync(path, "utf8");
    for (const line of t.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const i = s.indexOf("=");
      if (i === -1) continue;
      const k = s.slice(0, i).trim();
      let v = s.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      )
        v = v.slice(1, -1);
      if (override || !(k in process.env)) process.env[k] = v;
    }
  } catch {}
}
loadEnvFile(".env.production.local", true);
loadEnvFile(".env.local", false);

const QUESTIONS: Array<{ prompt: string; a: string; b: string; correct: "a" | "b" }> = [
  {
    prompt: "What's bigger?",
    a: "A blue whale 🐋",
    b: "A Tyrannosaurus rex 🦖",
    correct: "a", // blue whale ~30m vs T-Rex ~12m
  },
  {
    prompt: "What's bigger?",
    a: "The Sun ☀️",
    b: "The Earth 🌍",
    correct: "a", // Sun is 109× Earth's diameter
  },
  {
    prompt: "What's bigger?",
    a: "Saturn 🪐",
    b: "Earth 🌍",
    correct: "a", // Saturn is ~9× Earth's diameter
  },
  {
    prompt: "Which continent has more land area?",
    a: "South America",
    b: "Africa",
    correct: "b", // Africa ~30M km² vs South America ~18M km²
  },
  {
    prompt: "Which is the bigger distance from sea level?",
    a: "The height of Mount Everest",
    b: "The depth of the Mariana Trench",
    correct: "b", // Trench ~11,000 m vs Everest ~8,849 m
  },
  {
    prompt: "What's bigger by area?",
    a: "All of Earth's land combined",
    b: "The Pacific Ocean",
    correct: "b", // Pacific ~165M km² vs all land ~149M km²
  },
  {
    prompt: "Which is taller?",
    a: "The Eiffel Tower",
    b: "The Statue of Liberty",
    correct: "a", // Eiffel ~330m vs Statue ~93m
  },
  {
    prompt: "Which is taller (to the tip)?",
    a: "The Empire State Building",
    b: "The Eiffel Tower",
    correct: "a", // Empire State 443m vs Eiffel 330m
  },
  {
    prompt: "What's bigger?",
    a: "An ostrich egg 🥚",
    b: "A tennis ball 🎾",
    correct: "a", // ostrich egg ~15cm vs tennis ball ~6.7cm
  },
  {
    prompt: "What weighs more?",
    a: "An African elephant 🐘",
    b: "A small car 🚗",
    correct: "a", // elephant ~6 tons vs small car ~1 ton
  },
  {
    prompt: "Which shark is longer?",
    a: "A great white shark",
    b: "A whale shark",
    correct: "b", // whale shark ~12m vs great white ~6m
  },
  {
    prompt: "Which has more land area?",
    a: "Australia",
    b: "Greenland",
    correct: "a", // Australia 7.69M vs Greenland 2.17M km²
  },
  {
    prompt: "Which is bigger by area?",
    a: "An American football field",
    b: "A soccer (football) field",
    correct: "b", // soccer ~7,140 m² vs American ~5,400 m²
  },
  {
    prompt: "What's bigger?",
    a: "The Milky Way galaxy 🌌",
    b: "Our entire solar system",
    correct: "a", // Milky Way ~100,000 light-years vs solar system tiny
  },
  {
    prompt: "Which continent has more land area?",
    a: "Asia",
    b: "Africa",
    correct: "a", // Asia 44.6M vs Africa 30.4M km²
  },
];

const INTRO = `Round Two: What's Bigger?

Fifteen tiny showdowns. One thing on the left, another on the right. Pick the one that's bigger — by size, weight, distance, area, whichever makes sense. No tricks: every answer is the obvious-when-you-think-about-it choice.

Good luck — and don't trust your gut on the surprising ones. 🌍`;

const doIt = process.argv.includes("--do-it");

async function main() {
  // Dynamic import — static `import` of "../lib/engine.ts" gets hoisted
  // above loadEnvFile, which means db/index.ts evaluates before
  // DATABASE_URL is in process.env and throws.
  const { createRound, getActiveTournament, getLatestTournament } = await import(
    "../lib/engine.ts"
  );

  const t = (await getActiveTournament()) ?? (await getLatestTournament());
  if (!t) {
    console.error("No tournament found.");
    process.exit(1);
  }

  console.log(`Tournament: ${t.title} (${t.id})`);
  console.log(`Will create draft round with ${QUESTIONS.length} questions:`);
  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const correctText = q.correct === "a" ? q.a : q.b;
    console.log(`  ${i + 1}. ${q.prompt} ${q.a} vs ${q.b}  →  ${correctText}`);
  }

  if (!doIt) {
    console.log(`\nDRY RUN. Re-run with --do-it to actually insert.`);
    return;
  }

  const result = await createRound({
    tournamentId: t.id,
    title: "What's Bigger?",
    introProse: INTRO,
    passThreshold: 0.6,
    closesAt: null,
    isPractice: false,
    questions: QUESTIONS.map((q) => ({
      prompt: q.prompt,
      questionType: "multiple_choice" as const,
      options: [
        { label: q.a, isCorrect: q.correct === "a" },
        { label: q.b, isCorrect: q.correct === "b" },
      ],
    })),
  });

  console.log(`\n✓ Created draft round ${result.chapterNumber} (id: ${result.roundId}).`);
  console.log(`  Title: "What's Bigger?"`);
  console.log(`  Status: draft — go to /staff/control to start it when ready.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
