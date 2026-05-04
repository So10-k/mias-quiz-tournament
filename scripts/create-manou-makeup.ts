// Build a one-off make-up quiz for Manou. She missed Chapter 2's deadline
// while traveling, so she got auto-zeroed and Karen advanced. This script
// clones Chapter 2's questions into a new round, gates it to her user
// only via tiebreakerMatchupId pointing at her R2 matchup, and prints
// the URL to send her.
//
// After she submits, run `scripts/manou-decide.ts` (created below) to
// compare her score to Karen's. If hers is HIGHER → host can flip the
// matchup winner manually from /staff/control. Same fairness handicap
// we agreed on for Patou: she has to actually beat the score.
//
//   npx tsx scripts/create-manou-makeup.ts          # dry-run
//   npx tsx scripts/create-manou-makeup.ts --do-it  # actually create

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
const MATCHUP_ID = "6oeko591i678"; // main R2 slot 1, Karen vs Manou
const SOURCE_CHAPTER = 2; // What's Bigger?
const ORIGIN =
  process.env.SITE_ORIGIN ?? "https://quiz.miaswebsites.art";

const doIt = process.argv.includes("--do-it");

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!, {
    fetchOptions: { cache: "no-store" },
  });

  // 1. Find the source chapter 2 round and its questions.
  const [src] = (await sql(
    `select id, tournament_id, chapter_number, title, intro_prose, pass_threshold from rounds where chapter_number = $1 and is_practice = false limit 1`,
    [SOURCE_CHAPTER]
  )) as Array<{
    id: string;
    tournament_id: string;
    chapter_number: number;
    title: string;
    intro_prose: string | null;
    pass_threshold: string;
  }>;
  if (!src) throw new Error(`No non-practice round found at chapter ${SOURCE_CHAPTER}`);
  console.log(`Source: chapter ${src.chapter_number} "${src.title}" (${src.id})`);

  const qs = (await sql(
    `select id, prompt, "order", question_type, points from questions where round_id = $1 order by "order"`,
    [src.id]
  )) as Array<{
    id: string;
    prompt: string;
    order: number;
    question_type: string;
    points: number;
  }>;
  console.log(`Found ${qs.length} questions to clone.`);

  // 2. Verify Manou + matchup exist.
  const [manou] = (await sql(
    `select id, name, email from users where id = $1`,
    [MANOU_ID]
  )) as Array<{ id: string; name: string; email: string }>;
  if (!manou) throw new Error("Manou not found");
  console.log(`Player: ${manou.name} <${manou.email}>`);

  const [matchup] = (await sql(
    `select m.id, m.player_a_user_id, m.player_b_user_id, m.winner_user_id, m.bracket, m.round_index, m.slot,
      ua.name as a_name, ub.name as b_name
    from matchups m
    left join users ua on ua.id=m.player_a_user_id
    left join users ub on ub.id=m.player_b_user_id
    where m.id = $1`,
    [MATCHUP_ID]
  )) as Array<{
    id: string;
    player_a_user_id: string | null;
    player_b_user_id: string | null;
    winner_user_id: string | null;
    bracket: string;
    round_index: number;
    slot: number;
    a_name: string | null;
    b_name: string | null;
  }>;
  if (!matchup) throw new Error("Matchup not found");
  console.log(
    `Matchup: ${matchup.bracket} R${matchup.round_index} slot ${matchup.slot} — ${matchup.a_name} vs ${matchup.b_name}, winner=${matchup.winner_user_id ?? "(none)"}`
  );
  if (
    MANOU_ID !== matchup.player_a_user_id &&
    MANOU_ID !== matchup.player_b_user_id
  ) {
    throw new Error("Manou isn't in this matchup — abort");
  }

  if (!doIt) {
    console.log(`\nDRY RUN. Re-run with --do-it to actually create the make-up round.`);
    console.log(`Will:`);
    console.log(`  • Insert a new rounds row (chapter 105, isPractice=true, tiebreakerMatchupId=${MATCHUP_ID})`);
    console.log(`  • Clone ${qs.length} questions + their options`);
    console.log(`  • Print the play URL for Manou`);
    return;
  }

  // Pick a chapter number high enough to not collide. The other tiebreakers
  // sit at 102/103/104. Use the next free slot.
  const [{ next_chapter }] = (await sql(
    `select coalesce(max(chapter_number), 100) + 1 as next_chapter from rounds where tournament_id = $1 and is_practice = true`,
    [src.tournament_id]
  )) as Array<{ next_chapter: number }>;

  // Generate IDs the same way the engine does — 12-char nanoid alphabet.
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const makeId = () => {
    let s = "";
    for (let i = 0; i < 12; i++) {
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return s;
  };

  const newRoundId = makeId();
  await sql(
    `insert into rounds (id, tournament_id, chapter_number, title, intro_prose, pass_threshold, status, is_practice, tiebreaker_matchup_id, opens_at, closes_at)
     values ($1, $2, $3, $4, $5, $6, 'active', true, $7, now(), null)`,
    [
      newRoundId,
      src.tournament_id,
      next_chapter,
      `Make-up · ${src.title} · for ${manou.name}`,
      `${src.intro_prose ?? ""}\n\nThis is your make-up window for the round you missed while traveling. Same questions, same scoring. Karen's score is the bar — you have to BEAT it (ties don't count) for the bracket to flip. Take your time.`,
      src.pass_threshold,
      MATCHUP_ID,
    ]
  );

  // Clone questions + options.
  for (const q of qs) {
    const newQId = makeId();
    await sql(
      `insert into questions (id, round_id, "order", prompt, question_type, points) values ($1, $2, $3, $4, $5, $6)`,
      [newQId, newRoundId, q.order, q.prompt, q.question_type, q.points]
    );
    const opts = (await sql(
      `select id, "order", label, is_correct from options where question_id = $1 order by "order"`,
      [q.id]
    )) as Array<{
      id: string;
      order: number;
      label: string;
      is_correct: boolean;
    }>;
    for (const o of opts) {
      await sql(
        `insert into options (id, question_id, "order", label, is_correct) values ($1, $2, $3, $4, $5)`,
        [makeId(), newQId, o.order, o.label, o.is_correct]
      );
    }
  }

  console.log(`\n✓ Created make-up round at chapter ${next_chapter}`);
  console.log(`  Round id: ${newRoundId}`);
  console.log(`  Title: Make-up · ${src.title} · for ${manou.name}`);
  console.log(`  Gated to matchup: ${MATCHUP_ID}`);
  console.log(`  Questions cloned: ${qs.length}`);
  console.log(`\nSend Manou this URL:`);
  console.log(`  ${ORIGIN}/play/practice/${newRoundId}`);
  console.log(`\nAfter she submits, run scripts/manou-decide.ts to see if her score beat Karen's.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
