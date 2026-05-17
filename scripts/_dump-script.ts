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

async function main() {
  const { db, schema } = await import("@/db");
  const { eq, asc } = await import("drizzle-orm");
  const scriptId = process.argv[2];
  if (!scriptId) throw new Error("usage: tsx scripts/_dump-script.ts <scriptId>");

  const parts = await db
    .select()
    .from(schema.writingScriptParts)
    .where(eq(schema.writingScriptParts.scriptId, scriptId))
    .orderBy(asc(schema.writingScriptParts.order));
  for (const p of parts) {
    console.log(`\n## ${p.order + 1}. ${p.title}`);
    if (p.notes) console.log(`   (notes: ${p.notes})`);
    const lines = await db
      .select()
      .from(schema.writingScriptLines)
      .where(eq(schema.writingScriptLines.partId, p.id))
      .orderBy(asc(schema.writingScriptLines.order));
    for (const l of lines) {
      console.log(`    [${l.character}] ${l.text}${l.stageDirection ? ` (${l.stageDirection})` : ""}`);
    }
  }
}

main().then(() => process.exit(0));
