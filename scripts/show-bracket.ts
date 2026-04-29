// Print the live bracket — every round, every matchup, with player names
// and matchup IDs. Useful for grabbing the right --matchup value to pass
// to scripts/resolve-tiebreaker.ts.
//
//   npx tsx scripts/show-bracket.ts

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { readFileSync } from "node:fs";
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

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL not set");
    process.exit(2);
  }
  const sql = neon(dbUrl, { fetchOptions: { cache: "no-store" } });
  const db = drizzle(sql, { schema });

  const [tournament] = await db
    .select()
    .from(schema.tournaments)
    .orderBy(desc(schema.tournaments.createdAt))
    .limit(1);
  if (!tournament) {
    console.error("❌ No tournament found.");
    process.exit(1);
  }
  console.log(`Tournament: ${tournament.title} (${tournament.id})\n`);

  const matchups = await db
    .select()
    .from(schema.matchups)
    .where(eq(schema.matchups.tournamentId, tournament.id))
    .orderBy(asc(schema.matchups.roundIndex), asc(schema.matchups.slot));

  const userIds = [
    ...new Set(
      matchups
        .flatMap((m) => [m.playerAUserId, m.playerBUserId, m.winnerUserId])
        .filter((x): x is string => !!x)
    ),
  ];
  const users =
    userIds.length === 0
      ? []
      : await db
          .select()
          .from(schema.users)
          .where(inArray(schema.users.id, userIds));
  const nameOf = (id: string | null) => {
    if (!id) return "—";
    const u = users.find((x) => x.id === id);
    return u?.name ?? u?.email ?? id.slice(0, 6) + "…";
  };

  let curRound = -1;
  for (const m of matchups) {
    if (m.roundIndex !== curRound) {
      curRound = m.roundIndex;
      console.log(`\n── Round ${curRound} ──`);
    }
    const a = nameOf(m.playerAUserId).padEnd(22);
    const b = nameOf(m.playerBUserId).padEnd(22);
    const winner = m.winnerUserId
      ? `→ ${nameOf(m.winnerUserId)} (${m.resolvedVia ?? "?"})`
      : "(undecided)";
    console.log(
      `  slot ${String(m.slot).padStart(2)}  ${a} vs ${b}  ${winner}`
    );
    console.log(`     matchupId: ${m.id}`);
  }
  console.log("");

  // Recent practice/tiebreaker rounds for round-id reference too.
  const practice = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.tournamentId, tournament.id))
    .orderBy(desc(schema.rounds.createdAt))
    .limit(8);
  console.log("── Recent rounds ──");
  for (const r of practice) {
    console.log(
      `  ch ${r.chapterNumber}  ${r.isPractice ? "🎯 practice" : "        real"}  status=${r.status}  ${r.title}`
    );
    console.log(`     roundId: ${r.id}`);
  }
}

main().catch((e) => {
  console.error("\n❌ Failed:", e);
  process.exit(1);
});
