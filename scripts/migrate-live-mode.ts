// Idempotent migration: adds the columns that drizzle-kit push couldn't
// apply because of an interactive prompt on an unrelated table. Safe to
// run multiple times (every ALTER uses IF NOT EXISTS).
//
// Run with the local .env.local already loaded:
//   DATABASE_URL='<neon url>' npx tsx scripts/migrate-live-mode.ts
//
// Or, if you have direnv / a shell alias loading .env.local:
//   npx tsx scripts/migrate-live-mode.ts
//
// To target production Neon, paste the prod URL inline.

import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Auto-load .env.local so `npm run db:migrate-live` works without a
// shell alias. Same shim as drizzle.config.ts.
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
      if (process.env[key] == null) process.env[key] = val;
    }
  }
}
loadDotenv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set. Pass it inline:");
  console.error(
    "  DATABASE_URL='<your neon url>' npx tsx scripts/migrate-live-mode.ts"
  );
  process.exit(1);
}

const sql = neon(url);

const STATEMENTS: { label: string; ddl: string }[] = [
  // ─── live mode columns ─────────────────────────────────────────────
  {
    label: "rounds.is_live",
    ddl: `ALTER TABLE rounds ADD COLUMN IF NOT EXISTS is_live boolean NOT NULL DEFAULT false`,
  },
  {
    label: "rounds.live_status",
    ddl: `ALTER TABLE rounds ADD COLUMN IF NOT EXISTS live_status text NOT NULL DEFAULT 'pre_start'`,
  },
  {
    label: "rounds.live_current_question_index",
    ddl: `ALTER TABLE rounds ADD COLUMN IF NOT EXISTS live_current_question_index integer`,
  },
  {
    label: "rounds.live_current_question_started_at",
    ddl: `ALTER TABLE rounds ADD COLUMN IF NOT EXISTS live_current_question_started_at timestamp`,
  },
  {
    label: "rounds.live_question_seconds",
    ddl: `ALTER TABLE rounds ADD COLUMN IF NOT EXISTS live_question_seconds integer NOT NULL DEFAULT 30`,
  },
  {
    label: "rounds.live_started_at",
    ddl: `ALTER TABLE rounds ADD COLUMN IF NOT EXISTS live_started_at timestamp`,
  },
  // ─── effects columns ───────────────────────────────────────────────
  {
    label: "rounds.live_effect",
    ddl: `ALTER TABLE rounds ADD COLUMN IF NOT EXISTS live_effect text`,
  },
  {
    label: "rounds.live_effect_at",
    ddl: `ALTER TABLE rounds ADD COLUMN IF NOT EXISTS live_effect_at timestamp`,
  },
  {
    label: "rounds.live_effect_message",
    ddl: `ALTER TABLE rounds ADD COLUMN IF NOT EXISTS live_effect_message text`,
  },
  // ─── articles + newsletter ─────────────────────────────────────────
  {
    label: "enum article_status",
    ddl: `DO $$ BEGIN
      CREATE TYPE article_status AS ENUM ('draft','published','archived');
    EXCEPTION WHEN duplicate_object THEN null; END $$`,
  },
  {
    label: "enum article_visibility",
    ddl: `DO $$ BEGIN
      CREATE TYPE article_visibility AS ENUM ('public','subscribers_only','unlisted');
    EXCEPTION WHEN duplicate_object THEN null; END $$`,
  },
  {
    label: "enum subscription_frequency",
    ddl: `DO $$ BEGIN
      CREATE TYPE subscription_frequency AS ENUM ('daily','weekly','monthly');
    EXCEPTION WHEN duplicate_object THEN null; END $$`,
  },
  {
    label: "table articles",
    ddl: `CREATE TABLE IF NOT EXISTS articles (
      id text PRIMARY KEY,
      slug text NOT NULL UNIQUE,
      title text NOT NULL,
      subtitle text,
      dek text,
      cover_image_url text,
      body_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      body_text text NOT NULL DEFAULT '',
      read_minutes integer NOT NULL DEFAULT 1,
      status article_status NOT NULL DEFAULT 'draft',
      visibility article_visibility NOT NULL DEFAULT 'public',
      author_user_id text REFERENCES users(id) ON DELETE SET NULL,
      author_staff_id text REFERENCES staff_users(id) ON DELETE SET NULL,
      author_name text NOT NULL,
      author_avatar_url text,
      published_at timestamp,
      digest_eligible boolean NOT NULL DEFAULT true,
      view_count integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: "index articles_status_idx",
    ddl: `CREATE INDEX IF NOT EXISTS articles_status_idx ON articles(status)`,
  },
  {
    label: "index articles_published_idx",
    ddl: `CREATE INDEX IF NOT EXISTS articles_published_idx ON articles(published_at)`,
  },
  {
    label: "table newsletter_subscriptions",
    ddl: `CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
      id text PRIMARY KEY,
      email text NOT NULL,
      user_id text REFERENCES users(id) ON DELETE SET NULL,
      frequency subscription_frequency NOT NULL DEFAULT 'weekly',
      confirmation_token text NOT NULL UNIQUE,
      confirmed_at timestamp,
      unsubscribe_token text NOT NULL UNIQUE,
      unsubscribed_at timestamp,
      last_sent_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: "index newsletter_subs_email_idx",
    ddl: `CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subs_email_idx ON newsletter_subscriptions(email)`,
  },
  // ─── forum group grants ───────────────────────────────────────────
  {
    label: "table forum_group_grants",
    ddl: `CREATE TABLE IF NOT EXISTS forum_group_grants (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_name text NOT NULL,
      granted_at timestamp NOT NULL DEFAULT now(),
      granted_by_user_id text REFERENCES users(id) ON DELETE SET NULL
    )`,
  },
  {
    label: "uniq forum_group_grants(user_id, group_name)",
    ddl: `CREATE UNIQUE INDEX IF NOT EXISTS forum_group_grants_user_group_idx ON forum_group_grants(user_id, group_name)`,
  },
  {
    label: "index forum_group_grants(user_id)",
    ddl: `CREATE INDEX IF NOT EXISTS forum_group_grants_user_idx ON forum_group_grants(user_id)`,
  },
  // Bootstrap: every user with role='author' on the quiz site gets
  // the `authors` forum grant. Without this seed, the SSO flow would
  // remove Sam from `authors` on his next login because grants is
  // empty. Idempotent — uses ON CONFLICT DO NOTHING.
  {
    label: "bootstrap authors grant for users.role='author'",
    ddl: `INSERT INTO forum_group_grants (id, user_id, group_name, granted_at)
          SELECT
            substr(md5(random()::text), 1, 16),
            id,
            'authors',
            now()
          FROM users
          WHERE role = 'author'
          ON CONFLICT (user_id, group_name) DO NOTHING`,
  },
];

async function run() {
  console.log(`Connecting to ${url!.replace(/:[^:@/]+@/, ":***@")}`);
  for (const { label, ddl } of STATEMENTS) {
    process.stdout.write(`→ ${label} … `);
    try {
      // neon-http executes raw SQL via the .query method — passing the DDL
      // through a tagged template gives proper typing for parameterized
      // statements, but here we just need raw DDL.
      await sql(ddl);
      process.stdout.write("ok\n");
    } catch (e) {
      process.stdout.write("FAILED\n");
      console.error(`   ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
  }
  console.log("\n✅ All columns present. You can now reload /host/live.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
