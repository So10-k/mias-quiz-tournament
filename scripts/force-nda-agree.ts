// Stamp finals_nda_agreed_at for a specific user email. Used to
// unstick a finalist who needs Finals Room access for a demo NOW.
//
// Run:
//   npx tsx scripts/force-nda-agree.ts samuel.otten@greenwichschools.org

import { neon } from "@neondatabase/serverless";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function load(p: string) {
  const a = resolve(process.cwd(), p);
  if (!existsSync(a)) return;
  for (const line of readFileSync(a, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
load(".env.local");
load(".env.production.local");

const email = process.argv[2];
if (!email) {
  console.error("usage: tsx scripts/force-nda-agree.ts <email>");
  process.exit(1);
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const before = (await sql`
    SELECT id, email, name, finals_nda_agreed_at
    FROM users
    WHERE lower(email) = lower(${email})
  `) as Array<{ id: string; email: string; name: string | null; finals_nda_agreed_at: string | null }>;
  if (before.length === 0) {
    console.error(`No user with email ${email}`);
    process.exit(2);
  }
  console.log("BEFORE:", JSON.stringify(before[0], null, 2));
  const after = await sql`
    UPDATE users
    SET finals_nda_agreed_at = now()
    WHERE lower(email) = lower(${email})
    RETURNING id, email, finals_nda_agreed_at
  `;
  console.log("AFTER:", JSON.stringify(after[0], null, 2));
  console.log("✓ NDA stamped — next SSO login will grant finalists group.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
