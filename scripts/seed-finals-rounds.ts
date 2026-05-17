// Create the two finals quiz rounds — one gated to the WINNERS-bracket
// finals matchup, one gated to the LOSERS-bracket finals matchup.
// Each is its own question set on the same topic ("Wonders of the
// World") so the two finals can run in parallel without players
// seeing each other's questions.
//
// Idempotent — re-running deletes any existing rounds with the
// same title prefix and re-inserts. Safe.
//
// Run:
//   DATABASE_URL='<neon>' npx tsx scripts/seed-finals-rounds.ts

import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { customAlphabet } from "nanoid";

function loadDotenv() {
  for (const f of [".env.local", ".env.production.local"]) {
    const p = resolve(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      const k = t.slice(0, eq).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
loadDotenv();
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL missing"); process.exit(1); }
const sql = neon(url);
const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

// Same topic, different questions per bracket. Each MC question
// has 4 options; mark the correct one.
type Q = { prompt: string; options: [string, string, string, string]; correctIndex: 0 | 1 | 2 | 3 };

const WINNERS_QUESTIONS: Q[] = [
  { prompt: "In which country would you find the Pyramids of Giza? 🏜️", options: ["Sudan", "Egypt", "Morocco", "Libya"], correctIndex: 1 },
  { prompt: "The Great Wall is in which country? 🐉", options: ["Mongolia", "Japan", "China", "Korea"], correctIndex: 2 },
  { prompt: "Where is the Eiffel Tower? 🗼", options: ["London", "Paris", "Madrid", "Rome"], correctIndex: 1 },
  { prompt: "Machu Picchu sits high in which mountain range? ⛰️", options: ["The Andes", "The Rockies", "The Alps", "The Atlas Mountains"], correctIndex: 0 },
  { prompt: "The Colosseum was built in which ancient city?", options: ["Athens", "Rome", "Cairo", "Constantinople"], correctIndex: 1 },
  { prompt: "Which natural wonder is the largest coral reef on Earth? 🐠", options: ["Belize Barrier Reef", "Red Sea Reef", "Great Barrier Reef", "New Caledonia Reef"], correctIndex: 2 },
  { prompt: "The Taj Mahal is found in which country? 🕌", options: ["Pakistan", "Iran", "India", "Bangladesh"], correctIndex: 2 },
  { prompt: "Mount Everest is on the border of Nepal and which other country?", options: ["India", "Bhutan", "China", "Pakistan"], correctIndex: 2 },
  { prompt: "Which African landmark is the tallest waterfall in the world? 💦", options: ["Niagara Falls", "Angel Falls", "Iguazú Falls", "Victoria Falls"], correctIndex: 1 },
  { prompt: "Wait — Angel Falls is actually in which country?", options: ["Brazil", "Venezuela", "Colombia", "Peru"], correctIndex: 1 },
  { prompt: "Stonehenge is located in which country? 🪨", options: ["Ireland", "Scotland", "England", "Wales"], correctIndex: 2 },
  { prompt: "Which desert is home to the Pyramids?", options: ["Sahara", "Gobi", "Atacama", "Kalahari"], correctIndex: 0 },
  { prompt: "The Statue of Liberty was a gift from which country? 🗽", options: ["United Kingdom", "France", "Spain", "Italy"], correctIndex: 1 },
  { prompt: "Petra, the rose-red rock city, is in which country?", options: ["Egypt", "Jordan", "Syria", "Israel"], correctIndex: 1 },
  { prompt: "The Northern Lights are best seen near which pole? ✨", options: ["Equator", "South Pole", "North Pole", "Both poles equally"], correctIndex: 2 },
];

const LOSERS_QUESTIONS: Q[] = [
  { prompt: "Which European city is famous for its canals? 🛶", options: ["Rotterdam", "Venice", "Bruges", "Hamburg"], correctIndex: 1 },
  { prompt: "Mount Fuji is in which country? 🗻", options: ["South Korea", "China", "Vietnam", "Japan"], correctIndex: 3 },
  { prompt: "The Sahara Desert covers parts of which continent? 🐪", options: ["Asia", "Africa", "Australia", "South America"], correctIndex: 1 },
  { prompt: "The Amazon River flows through which continent? 🌳", options: ["Africa", "Asia", "South America", "North America"], correctIndex: 2 },
  { prompt: "Which country is home to kangaroos and koalas? 🦘", options: ["South Africa", "Australia", "New Zealand", "Argentina"], correctIndex: 1 },
  { prompt: "Mount Kilimanjaro is the highest mountain in which continent?", options: ["Asia", "Africa", "Europe", "South America"], correctIndex: 1 },
  { prompt: "The Sydney Opera House is on which body of water?", options: ["Pacific Ocean", "Tasman Sea", "Sydney Harbour", "Indian Ocean"], correctIndex: 2 },
  { prompt: "Which country has more lakes than the rest of the world combined? 💧", options: ["Russia", "United States", "Canada", "Finland"], correctIndex: 2 },
  { prompt: "Christ the Redeemer overlooks which city? ✝️", options: ["Buenos Aires", "Rio de Janeiro", "Lima", "São Paulo"], correctIndex: 1 },
  { prompt: "Which sea is the saltiest natural body of water on Earth? 🧂", options: ["Mediterranean Sea", "Caspian Sea", "Dead Sea", "Red Sea"], correctIndex: 2 },
  { prompt: "The Sphinx guards the pyramids in which city?", options: ["Cairo / Giza", "Luxor", "Alexandria", "Aswan"], correctIndex: 0 },
  { prompt: "Which country owns Easter Island and its famous stone heads? 🗿", options: ["Peru", "Chile", "Argentina", "Polynesia"], correctIndex: 1 },
  { prompt: "Niagara Falls sits between which two countries?", options: ["USA & Canada", "USA & Mexico", "Canada & Greenland", "Brazil & Argentina"], correctIndex: 0 },
  { prompt: "Which body of water separates Europe from Africa? 🌊", options: ["English Channel", "Mediterranean Sea", "Black Sea", "Atlantic Ocean"], correctIndex: 1 },
  { prompt: "The Galápagos Islands belong to which country? 🐢", options: ["Mexico", "Ecuador", "Costa Rica", "Peru"], correctIndex: 1 },
];

async function createRound(args: {
  tournamentId: string;
  title: string;
  intro: string;
  chapter: number;
  matchupId: string;
  questions: Q[];
}) {
  // Wipe any prior round with this exact title for this tournament
  // so re-running is clean.
  const existing = await sql`
    SELECT id FROM rounds WHERE tournament_id = ${args.tournamentId} AND title = ${args.title}
  `;
  for (const r of existing as any[]) {
    await sql`DELETE FROM rounds WHERE id = ${r.id}`;
  }

  const roundId = id();
  await sql`
    INSERT INTO rounds (
      id, tournament_id, chapter_number, title, intro_prose,
      pass_threshold, status, is_practice, tiebreaker_matchup_id,
      live_status, live_question_seconds, created_at
    ) VALUES (
      ${roundId}, ${args.tournamentId}, ${args.chapter}, ${args.title},
      ${args.intro}, '0.6', 'draft', false, ${args.matchupId},
      'pre_start', 30, NOW()
    )
  `;
  for (let qi = 0; qi < args.questions.length; qi++) {
    const q = args.questions[qi];
    const qId = id();
    await sql`
      INSERT INTO questions (id, round_id, "order", prompt, question_type, points)
      VALUES (${qId}, ${roundId}, ${qi}, ${q.prompt}, 'multiple_choice', 1)
    `;
    for (let oi = 0; oi < q.options.length; oi++) {
      await sql`
        INSERT INTO options (id, question_id, "order", label, is_correct)
        VALUES (${id()}, ${qId}, ${oi}, ${q.options[oi]}, ${oi === q.correctIndex})
      `;
    }
  }
  console.log(`  ✓ ${args.title} (${args.questions.length} questions) [${roundId}]`);
  return roundId;
}

async function main() {
  const [t] = await sql`SELECT * FROM tournaments ORDER BY created_at DESC LIMIT 1`;
  if (!t) throw new Error("no tournament");

  // Find the two finals matchups again at runtime so this script
  // can be safely re-run after bracket reshuffles.
  const main_ = await sql`
    SELECT * FROM matchups WHERE tournament_id = ${t.id} AND bracket = 'main' ORDER BY round_index DESC LIMIT 1
  `;
  const losers = await sql`
    SELECT * FROM matchups WHERE tournament_id = ${t.id} AND bracket = 'losers' ORDER BY round_index DESC LIMIT 1
  `;
  const winnersFinal = main_[0];
  const losersFinal = losers[0];
  if (!winnersFinal || !losersFinal) throw new Error("finals matchups missing");

  console.log(`Topic: Wonders of the World 🌍`);
  console.log(`Tournament: ${t.title}\n`);

  await createRound({
    tournamentId: t.id,
    title: "🏆 The Finals — Winners Bracket",
    intro: "It all comes down to this. Two players, fifteen questions about the wonders of our world. The winner advances to the championship.",
    chapter: 4,
    matchupId: winnersFinal.id,
    questions: WINNERS_QUESTIONS,
  });

  await createRound({
    tournamentId: t.id,
    title: "🥈 Last Stand — Losers Bracket Final",
    intro: "One last chance to fight your way up. Survive these fifteen questions about the wonders of our world and you live to face the winners-bracket champion.",
    chapter: 4,
    matchupId: losersFinal.id,
    questions: LOSERS_QUESTIONS,
  });

  console.log(`\n✅ Finals rounds seeded. Open /host to schedule + open them when ready.`);
  console.log(`   Winners gated to matchup: ${winnersFinal.id}`);
  console.log(`   Losers  gated to matchup: ${losersFinal.id}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
