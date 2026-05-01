// For every answer row that is flagged correct (is_correct = true) but whose
// option_id points to a non-correct option (or is null), rewrite option_id
// to that question's flagged-correct option. Used after the host bumps
// answers via /host/attempts/[id] so the review screen no longer
// contradicts itself.
//
// Run dry-run first:
//   npx tsx scripts/sync-corrected-picks.ts
// Apply for real:
//   npx tsx scripts/sync-corrected-picks.ts --apply

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

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
  const apply = process.argv.includes("--apply");
  const sql = neon(dbUrl);

  const rows = await sql`
    SELECT a.id,
           a.attempt_id,
           a.question_id,
           a.option_id,
           o_picked.label  AS picked_label,
           o_picked.is_correct AS picked_was_correct,
           o_correct.id    AS correct_id,
           o_correct.label AS correct_label,
           u.name          AS user_name,
           u.email         AS user_email,
           q.prompt        AS prompt
    FROM answers a
    JOIN attempts at  ON at.id = a.attempt_id
    JOIN users    u   ON u.id  = at.user_id
    JOIN questions q  ON q.id  = a.question_id
    LEFT JOIN options o_picked  ON o_picked.id = a.option_id
    JOIN options o_correct
      ON o_correct.question_id = a.question_id
     AND o_correct.is_correct  = true
    WHERE a.is_correct = true
      AND (o_picked.is_correct IS NOT TRUE)
  `;

  if (rows.length === 0) {
    console.log("✓ Nothing to sync — every is_correct=true answer already points at a correct option.");
    return;
  }

  console.log(
    `Found ${rows.length} answer row(s) where is_correct=true but option_id is wrong:\n`
  );
  for (const r of rows) {
    console.log(
      `  • ${r.user_name ?? r.user_email} — Q: "${(r.prompt as string).slice(0, 60)}…"\n` +
        `       picked: ${r.picked_label ?? "(none)"}\n` +
        `       would rewrite to: ${r.correct_label}`
    );
  }

  if (!apply) {
    console.log(
      "\n(dry run — re-run with --apply to actually rewrite option_id)"
    );
    return;
  }

  const upd = await sql`
    UPDATE answers a
    SET option_id = oc.id
    FROM options oc
    WHERE oc.question_id = a.question_id
      AND oc.is_correct  = true
      AND a.is_correct   = true
      AND (a.option_id IS NULL OR a.option_id <> oc.id)
    RETURNING a.id
  `;
  console.log(`\n✓ Rewrote option_id on ${upd.length} answer row(s).`);
}

main().catch((e) => {
  console.error("❌ Failed:", e);
  process.exit(1);
});
