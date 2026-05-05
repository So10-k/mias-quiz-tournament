// Push the new forms tables to prod. Idempotent — uses CREATE IF NOT EXISTS.

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

  // Enum first.
  await sqlc(`do $$ begin
    if not exists (select 1 from pg_type where typname = 'form_question_type') then
      create type form_question_type as enum (
        'short_text','long_text','email','single_select','multi_select','yes_no','scale','statement'
      );
    end if;
  end $$;`);

  await sqlc(`create table if not exists forms (
    id text primary key,
    slug text not null unique,
    title text not null,
    intro text,
    outro text,
    status text not null default 'draft',
    require_auth boolean not null default false,
    one_submission_per_user boolean not null default false,
    created_by_staff_id text references staff_users(id) on delete set null,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
  );`);

  await sqlc(`create table if not exists form_questions (
    id text primary key,
    form_id text not null references forms(id) on delete cascade,
    "order" integer not null,
    type form_question_type not null,
    prompt text not null,
    helper_text text,
    required boolean not null default true,
    options jsonb,
    config jsonb
  );`);
  await sqlc(`create index if not exists form_questions_form_order_idx on form_questions(form_id, "order");`);

  await sqlc(`create table if not exists form_submissions (
    id text primary key,
    form_id text not null references forms(id) on delete cascade,
    user_id text references users(id) on delete set null,
    submitted_at timestamp not null default now(),
    ip text,
    user_agent text,
    answers_json jsonb
  );`);
  await sqlc(`create index if not exists form_submissions_form_idx on form_submissions(form_id);`);
  await sqlc(`create index if not exists form_submissions_user_idx on form_submissions(user_id);`);

  await sqlc(`create table if not exists form_answers (
    id text primary key,
    submission_id text not null references form_submissions(id) on delete cascade,
    question_id text not null references form_questions(id) on delete cascade,
    value jsonb
  );`);
  await sqlc(`create index if not exists form_answers_submission_idx on form_answers(submission_id);`);
  await sqlc(`create index if not exists form_answers_question_idx on form_answers(question_id);`);

  console.log("✓ forms schema pushed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
