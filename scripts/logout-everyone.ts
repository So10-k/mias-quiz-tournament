// Hard sign-everyone-out. Wipes:
//   • `sessions`             — every Auth.js (player) session
//   • `verification_tokens`  — any unconsumed magic links so they can't be used
//   • `staff_sessions`       — every Duo-backed staff session
//
// User data is untouched: users, enrollments, attempts, predictions, files,
// emails, etc. all stay. Only the cookies-to-DB-row mappings are removed,
// which means the next request from any browser will redirect to /signin.
//
//   npx tsx scripts/logout-everyone.ts          # dry-run, prints counts
//   npx tsx scripts/logout-everyone.ts --do-it  # actually deletes

import { neon } from "@neondatabase/serverless";
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

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const doIt = process.argv.includes("--do-it");

const sqlc = neon(url, { fetchOptions: { cache: "no-store" } });

async function count(table: string): Promise<number> {
  const rows = (await sqlc(`select count(*)::int as c from ${table}`)) as Array<{
    c: number;
  }>;
  return rows[0]?.c ?? 0;
}

async function main() {
  const [s, v, ss] = await Promise.all([
    count("sessions"),
    count("verification_tokens"),
    count("staff_sessions"),
  ]);

  console.log(`current state:`);
  console.log(`  sessions:            ${s}`);
  console.log(`  verification_tokens: ${v}`);
  console.log(`  staff_sessions:      ${ss}`);

  if (!doIt) {
    console.log(`\nDRY RUN. Re-run with --do-it to actually wipe.`);
    return;
  }

  await sqlc(`delete from sessions`);
  await sqlc(`delete from verification_tokens`);
  await sqlc(`delete from staff_sessions`);

  console.log(`\n✓ wiped ${s + v + ss} rows. Everyone is signed out.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
