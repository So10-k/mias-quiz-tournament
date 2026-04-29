// Resolve a bracket matchup from the scores of a tiebreaker practice
// round. Picks the higher-scoring player as winner; if scores are tied or
// only one player has submitted, refuses to act.
//
// Two ways to identify the matchup:
//   --matchup <matchupId>         (explicit)
//   --p1 <name-or-email> --p2 <name-or-email>   (we look up the bracket
//                                                row where those two are
//                                                paired)
//
// And one way to identify the round:
//   --round <roundId>             (explicit, copy from create-tiebreaker
//                                  output)
//
// Examples:
//   npx tsx scripts/resolve-tiebreaker.ts --round abc123 --matchup def456
//   npx tsx scripts/resolve-tiebreaker.ts --round abc123 --p1 rhonda --p2 juliette

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, asc, desc, eq, ilike, inArray, isNotNull, or } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import * as schema from "../db/schema.ts";

function loadEnvLocal() {
  try {
    const t = readFileSync(".env.local", "utf8");
    for (const line of t.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const eq = s.indexOf("=");
      if (eq === -1) continue;
      const k = s.slice(0, eq).trim();
      let v = s.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      )
        v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {}
}
loadEnvLocal();

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

async function findUserId(db: any, q: string): Promise<string | null> {
  const trimmed = q.trim();
  if (!trimmed) return null;
  const rows = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(
      or(
        ilike(schema.users.name, `%${trimmed}%`),
        ilike(schema.users.email, `%${trimmed}%`)
      )
    );
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    console.error(
      `Ambiguous match for "${q}" — got ${rows.length} users:`
    );
    for (const r of rows) console.error(`   ${r.name} <${r.email}>`);
    return null;
  }
  return rows[0].id as string;
}

async function main() {
  const roundId = arg("--round");
  let matchupId = arg("--matchup");
  const p1 = arg("--p1");
  const p2 = arg("--p2");
  const auto = process.argv.includes("--yes") || process.argv.includes("-y");
  if (!roundId) {
    console.error(
      "❌ Usage:\n" +
        "   --round <roundId>                                            (auto if round was created via create-tiebreaker)\n" +
        "   --round <roundId> --matchup <matchupId>\n" +
        "   --round <roundId> --p1 <name-or-email> --p2 <name-or-email>"
    );
    process.exit(2);
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL not set");
    process.exit(2);
  }
  const sql = neon(dbUrl, { fetchOptions: { cache: "no-store" } });
  const db = drizzle(sql, { schema });

  const [round] = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.id, roundId))
    .limit(1);
  if (!round) {
    console.error(`❌ Round ${roundId} not found.`);
    process.exit(1);
  }

  // If the round is linked to a tiebreaker matchup, just use that — no
  // need for the host to pass --matchup or --p1/--p2 manually.
  if (!matchupId && (round as any).tiebreakerMatchupId) {
    matchupId = (round as any).tiebreakerMatchupId as string;
    console.log(
      `Using matchup linked to this tiebreaker round: ${matchupId}`
    );
  }

  // Resolve matchup by player lookup if we still don't have the explicit ID.
  if (!matchupId && p1 && p2) {
    const u1 = await findUserId(db, p1);
    const u2 = await findUserId(db, p2);
    if (!u1 || !u2) process.exit(1);
    const allMatchups = await db
      .select()
      .from(schema.matchups)
      .where(eq(schema.matchups.tournamentId, round.tournamentId))
      .orderBy(asc(schema.matchups.roundIndex), asc(schema.matchups.slot));
    const found = allMatchups.find(
      (m: any) =>
        (m.playerAUserId === u1 && m.playerBUserId === u2) ||
        (m.playerAUserId === u2 && m.playerBUserId === u1)
    );
    if (!found) {
      console.error(
        `❌ No bracket matchup pairs those two players in this tournament.`
      );
      process.exit(1);
    }
    matchupId = found.id as string;
    console.log(
      `Found matchup ${matchupId} (round ${found.roundIndex}, slot ${found.slot}).`
    );
  }
  const [matchup] = await db
    .select()
    .from(schema.matchups)
    .where(eq(schema.matchups.id, matchupId!))
    .limit(1);
  if (!matchup) {
    console.error(`❌ Matchup ${matchupId} not found.`);
    process.exit(1);
  }
  const candidates = [
    matchup.playerAUserId,
    matchup.playerBUserId,
  ].filter((x): x is string => !!x);
  if (candidates.length !== 2) {
    console.error(
      `❌ Matchup must have both players set. A=${matchup.playerAUserId} B=${matchup.playerBUserId}`
    );
    process.exit(1);
  }

  const attempts = await db
    .select()
    .from(schema.attempts)
    .where(
      and(
        eq(schema.attempts.roundId, roundId),
        inArray(schema.attempts.userId, candidates),
        isNotNull(schema.attempts.submittedAt)
      )
    );

  console.log(`\nRound: ${round.title}`);
  console.log(`Matchup: ${matchup.id}`);
  const users = await db
    .select()
    .from(schema.users)
    .where(inArray(schema.users.id, candidates));
  const nameOf = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u?.name ?? u?.email ?? id;
  };
  for (const cid of candidates) {
    const a = attempts.find((x) => x.userId === cid);
    if (!a) {
      console.log(`  ${nameOf(cid)}: NOT YET SUBMITTED`);
    } else {
      console.log(
        `  ${nameOf(cid)}: score = ${a.score} · passed=${a.passed} · submittedAt=${a.submittedAt}`
      );
    }
  }
  if (attempts.length < 2) {
    console.error(
      `\n❌ Both players need to have submitted before resolving. (${attempts.length}/2)`
    );
    process.exit(1);
  }

  const sa = Number(attempts.find((x) => x.userId === candidates[0])?.score ?? "0");
  const sb = Number(attempts.find((x) => x.userId === candidates[1])?.score ?? "0");
  const aName = nameOf(candidates[0]);
  const bName = nameOf(candidates[1]);

  if (sa === sb) {
    console.error(
      `\n❌ Scores are tied at ${sa}. Resolve manually in the host bracket UI.`
    );
    process.exit(1);
  }
  const winnerId = sa > sb ? candidates[0] : candidates[1];
  const loserId = sa > sb ? candidates[1] : candidates[0];
  const winnerName = nameOf(winnerId);
  const loserName = nameOf(loserId);

  console.log(`\n→ Winner: ${winnerName}  (loser: ${loserName})`);
  if (!auto) {
    const rl = createInterface({ input, output });
    const yn = await rl.question("Apply to bracket? (yes/no) > ");
    rl.close();
    if (yn.trim().toLowerCase() !== "yes") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  const { resolveMatchup } = await import("../lib/bracket.ts");
  await resolveMatchup(matchupId, winnerId, "manual");
  console.log(`✅ Bracket matchup resolved — ${winnerName} advances.`);
}

main().catch((e) => {
  console.error("\n❌ Failed:", e);
  process.exit(1);
});
