// Finals readiness audit. Reads the active/latest tournament and
// reports:
//   - bracket size, current round, who's still alive
//   - which matchups are the WINNERS-bracket final + LOSERS-bracket final
//   - whether both finalists are seated for each
//   - whether finals rounds (or tiebreaker-style gated rounds) exist
//
// No mutations. Run with:
//   DATABASE_URL='<neon>' npx tsx scripts/finals-audit.ts

import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

async function main() {
  const [t] = await sql`
    SELECT * FROM tournaments ORDER BY created_at DESC LIMIT 1
  `;
  if (!t) { console.error("no tournament"); process.exit(1); }
  console.log(`▶ Tournament: ${t.title} (${t.slug}) · status=${t.status}`);

  const matchups = await sql`
    SELECT
      m.id, m.bracket, m.round_index, m.slot,
      m.player_a_user_id, m.player_b_user_id,
      m.winner_user_id, m.resolved_via, m.resolved_at,
      a.name AS player_a_name, b.name AS player_b_name, w.name AS winner_name
    FROM matchups m
    LEFT JOIN users a ON a.id = m.player_a_user_id
    LEFT JOIN users b ON b.id = m.player_b_user_id
    LEFT JOIN users w ON w.id = m.winner_user_id
    WHERE m.tournament_id = ${t.id}
    ORDER BY m.bracket, m.round_index, m.slot
  `;
  if (matchups.length === 0) { console.error("no bracket"); process.exit(1); }
  const main = matchups.filter((m: any) => m.bracket === "main");
  const losers = matchups.filter((m: any) => m.bracket === "losers");
  const maxMain = Math.max(...main.map((m: any) => m.round_index));
  const maxLosers = losers.length ? Math.max(...losers.map((m: any) => m.round_index)) : 0;
  console.log(`  main bracket rounds: 1..${maxMain} (${main.length} matchups)`);
  console.log(`  losers bracket rounds: 1..${maxLosers} (${losers.length} matchups)`);

  const winnersFinal = main.find((m: any) => m.round_index === maxMain);
  const losersFinal = losers.find((m: any) => m.round_index === maxLosers);
  console.log("\n=== WINNERS BRACKET FINAL ===");
  if (winnersFinal) {
    console.log(`  matchup id: ${winnersFinal.id}`);
    console.log(`  Player A: ${winnersFinal.player_a_name ?? "(empty)"} · ${winnersFinal.player_a_user_id ?? ""}`);
    console.log(`  Player B: ${winnersFinal.player_b_name ?? "(empty)"} · ${winnersFinal.player_b_user_id ?? ""}`);
    console.log(`  Winner:   ${winnersFinal.winner_name ?? "(undecided)"}`);
    if (!winnersFinal.player_a_user_id || !winnersFinal.player_b_user_id) {
      console.log("  ⚠️  not both players seated yet");
    }
  } else { console.log("  ⚠️  no winners final found"); }

  console.log("\n=== LOSERS BRACKET FINAL ===");
  if (losersFinal) {
    console.log(`  matchup id: ${losersFinal.id}`);
    console.log(`  Player A: ${losersFinal.player_a_name ?? "(empty)"} · ${losersFinal.player_a_user_id ?? ""}`);
    console.log(`  Player B: ${losersFinal.player_b_name ?? "(empty)"} · ${losersFinal.player_b_user_id ?? ""}`);
    console.log(`  Winner:   ${losersFinal.winner_name ?? "(undecided)"}`);
    if (!losersFinal.player_a_user_id || !losersFinal.player_b_user_id) {
      console.log("  ⚠️  not both players seated yet");
    }
  } else { console.log("  ⚠️  no losers final found"); }

  // Check for any rounds gated to either finals matchup.
  const gatedRounds = await sql`
    SELECT id, title, chapter_number, status, tiebreaker_matchup_id, losers_matchup_id
    FROM rounds
    WHERE tournament_id = ${t.id}
      AND (
        tiebreaker_matchup_id = ${winnersFinal?.id ?? "__none__"} OR
        losers_matchup_id     = ${winnersFinal?.id ?? "__none__"} OR
        tiebreaker_matchup_id = ${losersFinal?.id ?? "__none__"} OR
        losers_matchup_id     = ${losersFinal?.id ?? "__none__"}
      )
  `;
  console.log("\n=== EXISTING FINALS-GATED ROUNDS ===");
  if (gatedRounds.length === 0) {
    console.log("  (none — finals question sets need to be created)");
  } else {
    gatedRounds.forEach((r: any) => {
      console.log(`  - "${r.title}" chapter=${r.chapter_number} status=${r.status} (${r.id})`);
    });
  }

  // Roster broken into still-in vs eliminated for the email audience targeting.
  const enrollments = await sql`
    SELECT e.user_id, e.eliminated_at, u.name, u.email
    FROM enrollments e
    JOIN users u ON u.id = e.user_id
    WHERE e.tournament_id = ${t.id}
  `;
  const stillIn = enrollments.filter((e: any) => e.eliminated_at === null);
  const eliminated = enrollments.filter((e: any) => e.eliminated_at !== null);
  console.log("\n=== ROSTER ===");
  console.log(`  still in: ${stillIn.length}`);
  stillIn.forEach((e: any) => console.log(`    - ${e.name} <${e.email}>`));
  console.log(`  eliminated: ${eliminated.length}`);
  eliminated.forEach((e: any) => console.log(`    - ${e.name} <${e.email}>`));
}

main().catch((e) => { console.error(e); process.exit(1); });
