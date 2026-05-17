// Idempotent migration: adds the finals_nda_agreed_at column on
// users. Set to non-null when a finalist has agreed to the
// confidentiality terms via the Discourse NDA PM.
//
// Run:
//   DATABASE_URL='<neon>' npx tsx scripts/migrate-finals-nda.ts

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
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS finals_nda_agreed_at timestamp
  `;
  console.log("✓ users.finals_nda_agreed_at");
}
main().catch((e) => { console.error(e); process.exit(1); });
