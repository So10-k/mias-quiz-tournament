// One-shot: run propagateWinners + syncEliminationFromBracket against the
// active tournament. Useful after the bracket has been hand-edited
// outside the normal resolveMatchup flow (e.g. host flipped a winner via
// a script, or older state never fully cascaded). Read-only-then-write:
// shows the diff before/after.

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
  const { propagateWinners, syncEliminationFromBracket } = await import(
    "../lib/bracket.ts"
  );
  const { getActiveTournament, getLatestTournament } = await import(
    "../lib/engine.ts"
  );

  const t = (await getActiveTournament()) ?? (await getLatestTournament());
  if (!t) {
    console.error("No tournament.");
    process.exit(1);
  }
  console.log(`Tournament: ${t.title} (${t.id})\n`);

  console.log("Running propagateWinners…");
  await propagateWinners(t.id);
  console.log("Running syncEliminationFromBracket…");
  await syncEliminationFromBracket(t.id);
  console.log("\nDone. Run scripts/resync-eliminations.ts to see the new still-in/out list.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
