// Push the workflow_runs table. Idempotent — CREATE IF NOT EXISTS.

import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "node:fs";
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

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`create table if not exists workflow_runs (
    id text primary key,
    workflow_id text not null,
    triggered_by_user_id text references users(id) on delete set null,
    started_at timestamp not null default now(),
    completed_at timestamp,
    status text not null default 'running',
    summary text,
    result_json jsonb,
    emails_sent integer not null default 0,
    error text
  )`;
  await sql`create index if not exists workflow_runs_workflow_idx
    on workflow_runs (workflow_id)`;
  await sql`create index if not exists workflow_runs_started_idx
    on workflow_runs (started_at)`;
  console.log("✓ workflow_runs ready");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
