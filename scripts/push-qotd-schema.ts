// Push QOTD tables to prod. Idempotent.

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
function load(p: string, override: boolean) {
  try {
    const t = readFileSync(p, "utf8");
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
load(".env.production.local", true);
load(".env.local", false);

async function main() {
  const sqlc = neon(process.env.DATABASE_URL!);

  await sqlc(`create table if not exists qotd_recommendations (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    topic text not null,
    status text not null default 'pending',
    rejection_reason text,
    picked_for_question_id text,
    created_at timestamp not null default now()
  );`);
  await sqlc(`create index if not exists qotd_recs_user_idx on qotd_recommendations(user_id);`);
  await sqlc(`create index if not exists qotd_recs_status_idx on qotd_recommendations(status);`);

  await sqlc(`create table if not exists qotd_questions (
    id text primary key,
    for_date text not null unique,
    prompt text not null,
    options jsonb not null,
    based_on_recommendation_id text references qotd_recommendations(id) on delete set null,
    context text,
    audio_url text,
    created_at timestamp not null default now()
  );`);

  await sqlc(`create table if not exists qotd_responses (
    id text primary key,
    question_id text not null references qotd_questions(id) on delete cascade,
    user_id text references users(id) on delete set null,
    choice text not null,
    other_text_raw text,
    other_text_clean text,
    hidden boolean not null default false,
    created_at timestamp not null default now()
  );`);
  await sqlc(`create index if not exists qotd_responses_question_idx on qotd_responses(question_id);`);
  await sqlc(`create index if not exists qotd_responses_user_idx on qotd_responses(user_id);`);
  await sqlc(`create unique index if not exists qotd_responses_user_question_uniq on qotd_responses(user_id, question_id);`);

  console.log("✓ QOTD schema pushed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
