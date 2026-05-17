// Idempotent migration: creates the support_tickets table + the
// support_ticket_status enum. Safe to run multiple times.
//
// Run:
//   DATABASE_URL='<neon url>' npx tsx scripts/migrate-support-tickets.ts

import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotenv() {
  for (const file of [".env.local", ".env.production.local"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}
loadDotenv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set.");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  // 1. enum
  await sql`
    DO $$ BEGIN
      CREATE TYPE support_ticket_status AS ENUM ('open', 'pending', 'resolved', 'closed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `;
  console.log("✓ enum support_ticket_status");

  // 2. table
  await sql`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id text PRIMARY KEY,
      discourse_topic_id integer NOT NULL,
      discourse_post_id  integer NOT NULL,
      subject text NOT NULL,
      submitter_email text NOT NULL,
      submitter_name text NOT NULL,
      submitter_user_id text REFERENCES users(id) ON DELETE SET NULL,
      topic text,
      status support_ticket_status NOT NULL DEFAULT 'open',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `;
  console.log("✓ table support_tickets");

  // 3. indexes
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_topic_idx
      ON support_tickets (discourse_topic_id);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS support_tickets_user_idx
      ON support_tickets (submitter_user_id);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS support_tickets_email_idx
      ON support_tickets (submitter_email);
  `;
  console.log("✓ indexes");

  console.log("\n✅ migration complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
