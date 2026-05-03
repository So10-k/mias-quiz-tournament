// Companion to scripts/create-manou-makeup.ts. Compares Manou's make-up
// score against Karen's chapter 2 score and prints the verdict. The
// fairness rule we agreed on: Manou's score has to BEAT Karen's. Ties
// go to Karen (clean win, on time).
//
// This script doesn't change any DB state — it just tells you what to
// do. If Manou wins, flip the matchup at /staff/control by setting the
// winner manually (and propagateWinners cascades the rest).
//
//   npx tsx scripts/manou-decide.ts

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

const MANOU_ID = "7cuzkrdoj5cx";
const KAREN_ID = "zajgtj5kxwj9";
const SOURCE_CHAPTER = 2;
const MATCHUP_ID = "6oeko591i678";

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!, {
    fetchOptions: { cache: "no-store" },
  });

  // Karen's chapter 2 score (the bar to beat).
  const [src] = (await sql(
    `select id from rounds where chapter_number = $1 and is_practice = false limit 1`,
    [SOURCE_CHAPTER]
  )) as Array<{ id: string }>;
  if (!src) {
    console.error("No chapter 2 round.");
    process.exit(1);
  }
  const [kAtt] = (await sql(
    `select score, submitted_at, passed from attempts where user_id = $1 and round_id = $2 limit 1`,
    [KAREN_ID, src.id]
  )) as Array<{ score: string | null; submitted_at: Date | null; passed: boolean }>;
  const karenScore = Number(kAtt?.score ?? "0");
  console.log(`Karen's chapter 2 score: ${karenScore.toFixed(2)} (passed=${kAtt?.passed ?? false})`);

  // Manou's most recent make-up attempt across any tiebreaker round
  // gated to the Karen-vs-Manou matchup.
  const [mAtt] = (await sql(
    `select a.score, a.submitted_at, a.passed, r.id as round_id, r.title as round_title, r.chapter_number
    from attempts a
    join rounds r on r.id = a.round_id
    where a.user_id = $1 and r.tiebreaker_matchup_id = $2
    order by a.submitted_at desc nulls last
    limit 1`,
    [MANOU_ID, MATCHUP_ID]
  )) as Array<{
    score: string | null;
    submitted_at: Date | null;
    passed: boolean;
    round_id: string;
    round_title: string;
    chapter_number: number;
  }>;

  if (!mAtt || !mAtt.submitted_at) {
    console.log("\nManou hasn't submitted her make-up yet. No verdict to give.");
    return;
  }

  const manouScore = Number(mAtt.score ?? "0");
  console.log(
    `Manou's make-up score: ${manouScore.toFixed(2)} (round "${mAtt.round_title}", chapter ${mAtt.chapter_number}, submitted ${mAtt.submitted_at.toISOString()})`
  );

  console.log("\n─── verdict ───");
  if (manouScore > karenScore) {
    console.log(
      `🎉 Manou WINS. ${manouScore.toFixed(2)} > ${karenScore.toFixed(2)}.`
    );
    console.log(`   → Go to /staff/control and set the winner of matchup ${MATCHUP_ID} to Manou.`);
    console.log(`   → propagateWinners + syncEliminationFromBracket will cascade the bracket.`);
  } else if (manouScore === karenScore) {
    console.log(
      `🤝 Tie at ${karenScore.toFixed(2)}. Per the rule we set, Karen keeps the win (on-time submission breaks ties).`
    );
  } else {
    console.log(
      `Karen keeps the win. ${karenScore.toFixed(2)} ≥ ${manouScore.toFixed(2)}.`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
