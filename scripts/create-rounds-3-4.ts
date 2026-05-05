// Create Round 3 (Food Origins) and Round 4 (The Gauntlet — for the smartest
// players standing). Both are inserted as DRAFTS (status="draft",
// isPractice=false). The host has to click "Start Round" on /staff/control
// to publish them. Questions are 4-option multiple-choice.
//
//   npx tsx scripts/create-rounds-3-4.ts          # dry-run preview
//   npx tsx scripts/create-rounds-3-4.ts --do-it  # actually inserts both

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

type Q = { prompt: string; options: string[]; correctIndex: number };

// ── Round 3 — Food Origins ────────────────────────────────────────────────
// Country/region of origin. Mix of obvious (pizza/Italy, tacos/Mexico) and
// surprising (croissant/Austria, apples/Kazakhstan) so it rewards the
// people who actually know food history. Age-neutral — every food on the
// list has been around for centuries.
const R3_QUESTIONS: Q[] = [
  {
    prompt: "Where was pizza invented? 🍕",
    options: ["France", "Italy", "Greece", "Spain"],
    correctIndex: 1,
  },
  {
    prompt: "Where does sushi come from? 🍣",
    options: ["China", "Korea", "Japan", "Vietnam"],
    correctIndex: 2,
  },
  {
    prompt: "Where did chocolate (the cacao bean) originate?",
    options: ["West Africa", "Mexico / Central America", "India", "Brazil"],
    correctIndex: 1,
  },
  {
    prompt: "Where did tomatoes first grow as a plant? 🍅",
    options: ["Italy", "Spain", "Peru / the Andes", "Mexico"],
    correctIndex: 2,
  },
  {
    prompt: "Where do coffee plants come from? ☕",
    options: ["Brazil", "Yemen", "Ethiopia", "Colombia"],
    correctIndex: 2,
  },
  {
    prompt: "Where was tea first cultivated? 🍵",
    options: ["India", "China", "Japan", "Sri Lanka"],
    correctIndex: 1,
  },
  {
    prompt: "Where was the croissant invented? 🥐",
    options: ["France", "Belgium", "Austria", "Italy"],
    correctIndex: 2,
  },
  {
    prompt: "Where do bagels come from? 🥯",
    options: ["Israel", "Russia", "Poland", "United States"],
    correctIndex: 2,
  },
  {
    prompt: "Where did the pretzel originate? 🥨",
    options: ["Germany", "France", "Switzerland", "Czech Republic"],
    correctIndex: 0,
  },
  {
    prompt: "Where does curry come from? 🍛",
    options: ["Thailand", "China", "India", "Persia"],
    correctIndex: 2,
  },
  {
    prompt: "Where does maple syrup come from? 🍁",
    options: ["Canada / Northeast USA", "Norway", "Germany", "Russia"],
    correctIndex: 0,
  },
  {
    prompt: "Where does vanilla come from? 🌸",
    options: ["Madagascar", "Mexico", "Tahiti", "India"],
    correctIndex: 1,
  },
  {
    prompt: "Where do tacos come from? 🌮",
    options: ["Spain", "Mexico", "Peru", "Cuba"],
    correctIndex: 1,
  },
  {
    prompt: "Where does cinnamon originally come from?",
    options: ["India", "Indonesia", "Sri Lanka", "Egypt"],
    correctIndex: 2,
  },
  {
    prompt: "Where do apples originally come from? 🍎",
    options: ["England", "Kazakhstan / Central Asia", "United States", "Italy"],
    correctIndex: 1,
  },
];

const R3_INTRO = `Round Three: Food Origins

Fifteen questions, each one is "where did this food come from?" Some are obvious. Some are sneaky (a few of these were invented somewhere you'd never guess). No tricks — just famous foods and the country/region they actually started in.

Trust your instincts on the obvious ones. Slow down on the surprises.`;

// ── Round 4 — The Gauntlet ────────────────────────────────────────────────
// Pure brain-benders: lateral thinking, math traps, classic logic puzzles.
// "Only the smartest will make it." Calibrated so a clever 7-year-old has a
// shot at half of these and a clever 90-year-old has a shot at the other
// half — no era-specific knowledge required, only thinking.
const R4_QUESTIONS: Q[] = [
  {
    prompt:
      "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?",
    options: ["$0.10", "$0.05", "$0.55", "$1.00"],
    correctIndex: 1,
  },
  {
    prompt:
      "If 5 machines make 5 widgets in 5 minutes, how long would 100 machines take to make 100 widgets?",
    options: ["100 minutes", "20 minutes", "5 minutes", "1 hour"],
    correctIndex: 2,
  },
  {
    prompt:
      "A patch of lily pads doubles in size every day. On day 48 the pond is fully covered. On what day was the pond half-covered?",
    options: ["Day 24", "Day 47", "Day 36", "Day 12"],
    correctIndex: 1,
  },
  {
    prompt:
      "How many times do the hour hand and the minute hand of a clock overlap in 12 hours?",
    options: ["12", "11", "13", "10"],
    correctIndex: 1,
  },
  {
    prompt:
      "What number comes next in the sequence?  1, 11, 21, 1211, 111221, ?",
    options: ["312211", "122212", "1112122", "211221"],
    correctIndex: 0,
  },
  {
    prompt:
      "You're in a race. You pass the person in 2nd place. What place are you in now?",
    options: ["1st", "2nd", "3rd", "Tied for 1st"],
    correctIndex: 1,
  },
  {
    prompt:
      "A clock takes 5 seconds to chime 6 times. How long does it take to chime 12 times?",
    options: ["10 seconds", "11 seconds", "12 seconds", "9 seconds"],
    correctIndex: 1,
  },
  {
    prompt:
      "You have 8 coins. One is a fake — slightly lighter than the others. Using a balance scale, what is the FEWEST number of weighings needed to guarantee finding the fake?",
    options: ["1", "2", "3", "4"],
    correctIndex: 1,
  },
  {
    prompt: "What number comes next?  2, 6, 12, 20, 30, ?",
    options: ["40", "42", "44", "38"],
    correctIndex: 1,
  },
  {
    prompt:
      "A snail at the bottom of a 10-foot pole climbs 3 feet up each day, but slides 2 feet back down each night. How many days does it take to reach the top?",
    options: ["10", "9", "8", "7"],
    correctIndex: 2,
  },
  {
    prompt:
      "100 lockers in a row, all closed. Person #1 opens every locker. Person #2 toggles every 2nd. Person #3 toggles every 3rd. And so on, all the way to person #100. After all 100 people, how many lockers are OPEN?",
    options: ["50", "10", "25", "100"],
    correctIndex: 1,
  },
  {
    prompt:
      "A man looks at a portrait and says: \"Brothers and sisters I have none, but this man's father is my father's son.\" Who is in the portrait?",
    options: ["His father", "His son", "His brother", "Himself"],
    correctIndex: 1,
  },
  {
    prompt:
      "Two coins add up to 30 cents. One of them is NOT a nickel. What are the two coins?",
    options: [
      "Two dimes and a dime",
      "Three dimes",
      "A quarter and a nickel",
      "Six nickels",
    ],
    correctIndex: 2,
  },
  {
    prompt:
      "A man builds a house with all four walls facing south. A bear walks past. What color is the bear?",
    options: ["Brown", "Black", "White", "Grey"],
    correctIndex: 2,
  },
  {
    prompt:
      "Three friends split a hotel bill. Each pays $10 (total $30). The clerk realizes the rooms only cost $25 and sends $5 back via the bellhop. The bellhop pockets $2 and gives each friend $1 back. So each friend paid $9 ($27 total) and the bellhop has $2 — that's $29. Where's the missing dollar?",
    options: [
      "It went to taxes",
      "There is no missing dollar — the math adds the bellhop's $2 to the wrong side",
      "The bellhop stole it",
      "It's still in the till",
    ],
    correctIndex: 1,
  },
];

const R4_INTRO = `Round Four: The Gauntlet 🧠

This one's hard. Not "did you grow up with this trivia" hard — actually hard. Brain teasers, lateral thinking, sneaky math. No special knowledge required, only thinking.

Some of these are classics that smart people have wrestled with for a hundred years. Some have answers that feel obviously wrong until you check the math. Take your time. Read each question twice. Trust the answer that feels weird.

Only the smartest make it through.`;

const doIt = process.argv.includes("--do-it");

async function main() {
  // Dynamic import — see scripts/create-round-2-whats-bigger.ts for why.
  const { createRound, getActiveTournament, getLatestTournament } = await import(
    "../lib/engine.ts"
  );
  const t = (await getActiveTournament()) ?? (await getLatestTournament());
  if (!t) {
    console.error("No tournament found.");
    process.exit(1);
  }
  console.log(`Tournament: ${t.title} (${t.id})\n`);

  function preview(label: string, qs: Q[]) {
    console.log(`── ${label} (${qs.length} questions) ──`);
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i];
      console.log(`  ${i + 1}. ${q.prompt}`);
      for (let oi = 0; oi < q.options.length; oi++) {
        const mark = oi === q.correctIndex ? "✓" : " ";
        console.log(`       ${mark} ${q.options[oi]}`);
      }
    }
    console.log();
  }
  preview("Round 3 — Food Origins", R3_QUESTIONS);
  preview("Round 4 — The Gauntlet", R4_QUESTIONS);

  if (!doIt) {
    console.log(`DRY RUN. Re-run with --do-it to actually insert both rounds.`);
    return;
  }

  function toEngineQs(qs: Q[]) {
    return qs.map((q) => ({
      prompt: q.prompt,
      questionType: "multiple_choice" as const,
      options: q.options.map((label, idx) => ({
        label,
        isCorrect: idx === q.correctIndex,
      })),
    }));
  }

  const r3 = await createRound({
    tournamentId: t.id,
    title: "Food Origins",
    introProse: R3_INTRO,
    passThreshold: 0.6,
    closesAt: null,
    isPractice: false,
    questions: toEngineQs(R3_QUESTIONS),
  });
  console.log(`✓ Created draft Round ${r3.chapterNumber}: "Food Origins" (${r3.roundId})`);

  const r4 = await createRound({
    tournamentId: t.id,
    title: "The Gauntlet",
    introProse: R4_INTRO,
    passThreshold: 0.6,
    closesAt: null,
    isPractice: false,
    questions: toEngineQs(R4_QUESTIONS),
  });
  console.log(`✓ Created draft Round ${r4.chapterNumber}: "The Gauntlet" (${r4.roundId})`);
  console.log(`\nBoth drafts. Activate from /staff/control when ready.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
