// Pre-taped pivot: the finalized show script has three "Sponsor
// break" parts that were narrator transitions into the parody ads.
// Now that the ads are gone, those parts are dead text — they read
// like the hosts are saying "back from a break" with no break.
//
// This script removes those three parts and renumbers the survivors
// so the order is contiguous. NOTHING ELSE is touched — line text,
// stage directions, character assignments, and the parts we keep all
// stay byte-identical.
//
// Dry-run preview (default):
//   npx tsx scripts/remove-script-ad-breaks.ts
//
// Apply for real (when you're happy):
//   APPLY=1 npx tsx scripts/remove-script-ad-breaks.ts

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

// Heuristic: a "sponsor break" part is anything whose title contains
// the word "sponsor" or starts with "Mega sponsor". Belt-and-braces.
function isSponsorBreak(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes("sponsor break") || lower.includes("mega sponsor");
}

async function main() {
  const { db, schema } = await import("@/db");
  const { eq, asc } = await import("drizzle-orm");

  // Find the most recent finalized script. (There's only one right
  // now, but be defensive in case there are drafts hanging around.)
  const scripts = await db
    .select()
    .from(schema.writingScripts)
    .where(eq(schema.writingScripts.status, "finalized"));
  if (scripts.length === 0) throw new Error("no finalized scripts found");
  if (scripts.length > 1) {
    console.log(
      `multiple finalized scripts found (${scripts.length}); picking the most recent by createdAt`
    );
  }
  scripts.sort((a, b) => +b.createdAt - +a.createdAt);
  const script = scripts[0];
  console.log(`Script: ${script.id} — "${script.title}"`);

  const parts = await db
    .select()
    .from(schema.writingScriptParts)
    .where(eq(schema.writingScriptParts.scriptId, script.id))
    .orderBy(asc(schema.writingScriptParts.order));

  const toRemove = parts.filter((p) => isSponsorBreak(p.title));
  const toKeep = parts.filter((p) => !isSponsorBreak(p.title));

  console.log("");
  console.log("Will REMOVE these parts:");
  for (const p of toRemove) {
    console.log(`  · order=${p.order}  title="${p.title}"`);
  }
  console.log("");
  console.log("Will KEEP these parts (with new order):");
  toKeep.forEach((p, newOrder) => {
    console.log(
      `  · order=${p.order} → ${newOrder}  title="${p.title}"`
    );
  });

  const apply = process.env.APPLY === "1";
  if (!apply) {
    console.log("");
    console.log("Dry run — no DB changes. Re-run with APPLY=1 to commit.");
    return;
  }

  console.log("");
  console.log("Applying…");

  // 1. Delete the sponsor-break parts. The schema cascades on parts →
  //    lines, so we don't need to clean lines manually.
  for (const p of toRemove) {
    await db
      .delete(schema.writingScriptParts)
      .where(eq(schema.writingScriptParts.id, p.id));
    console.log(`  ✓ removed part ${p.order} (${p.id})`);
  }

  // 2. Renumber survivors. To avoid violating any composite unique
  //    constraint on (scriptId, order) during the swap, bump them
  //    high first, then assign clean 0-based orders.
  const BUMP_OFFSET = 10000;
  for (const p of toKeep) {
    await db
      .update(schema.writingScriptParts)
      .set({ order: p.order + BUMP_OFFSET })
      .where(eq(schema.writingScriptParts.id, p.id));
  }
  for (let i = 0; i < toKeep.length; i++) {
    const p = toKeep[i];
    await db
      .update(schema.writingScriptParts)
      .set({ order: i })
      .where(eq(schema.writingScriptParts.id, p.id));
    console.log(`  ✓ renumbered "${p.title}" → ${i}`);
  }

  console.log("");
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
