// Re-run syncEliminationFromBracket against the active tournament. Useful
// after the bracket structure changes outside the normal "host sets winner"
// flow — e.g. when the losers bracket was retrofitted, players who lost in
// main R1 didn't get their eliminated flag flipped back to "still in".
//
//   npx tsx scripts/resync-eliminations.ts

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

async function main() {
  const { syncEliminationFromBracket } = await import("../lib/bracket.ts");
  const { getActiveTournament, getLatestTournament, getCast } = await import(
    "../lib/engine.ts"
  );

  const t = (await getActiveTournament()) ?? (await getLatestTournament());
  if (!t) {
    console.error("No tournament found.");
    process.exit(1);
  }

  console.log(`Tournament: ${t.title} (${t.id})`);

  const before = await getCast(t.id);
  console.log("\nBefore:");
  for (const row of before) {
    const name = row.user.name ?? row.user.email ?? "—";
    const status = row.enrollment.eliminatedAt ? "OUT" : "in ";
    console.log(`  ${status}  ${name}`);
  }

  await syncEliminationFromBracket(t.id);

  const after = await getCast(t.id);
  console.log("\nAfter:");
  const changes: string[] = [];
  for (const row of after) {
    const name = row.user.name ?? row.user.email ?? "—";
    const status = row.enrollment.eliminatedAt ? "OUT" : "in ";
    console.log(`  ${status}  ${name}`);
    const beforeRow = before.find((b) => b.user.id === row.user.id);
    if (
      beforeRow &&
      !!beforeRow.enrollment.eliminatedAt !== !!row.enrollment.eliminatedAt
    ) {
      changes.push(
        `${name}: ${beforeRow.enrollment.eliminatedAt ? "OUT" : "in"} → ${
          row.enrollment.eliminatedAt ? "OUT" : "in"
        }`
      );
    }
  }
  if (changes.length === 0) {
    console.log("\nNo changes.");
  } else {
    console.log(`\n${changes.length} change(s):`);
    for (const c of changes) console.log(`  • ${c}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
