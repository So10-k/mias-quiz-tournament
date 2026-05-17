// Push the writing-session tables. Idempotent — CREATE IF NOT EXISTS.

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

  // Enums.
  await sqlc(`do $$ begin
    if not exists (select 1 from pg_type where typname = 'writing_script_status') then
      create type writing_script_status as enum (
        'draft','delegating','editing','finalized'
      );
    end if;
  end $$;`);
  await sqlc(`do $$ begin
    if not exists (select 1 from pg_type where typname = 'writing_script_character') then
      create type writing_script_character as enum (
        'narrator','host','cohost','sam','mia','juliette','both'
      );
    end if;
  end $$;`);

  await sqlc(`create table if not exists writing_scripts (
    id text primary key,
    title text not null,
    brief text not null default '',
    status writing_script_status not null default 'draft',
    created_by_user_id text references users(id) on delete set null,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    finalized_at timestamp
  )`);

  await sqlc(`create table if not exists writing_script_parts (
    id text primary key,
    script_id text not null references writing_scripts(id) on delete cascade,
    "order" integer not null,
    title text not null,
    description text
  )`);
  await sqlc(`create index if not exists writing_script_parts_script_order_idx
    on writing_script_parts (script_id, "order")`);

  await sqlc(`create table if not exists writing_script_lines (
    id text primary key,
    part_id text not null references writing_script_parts(id) on delete cascade,
    "order" integer not null,
    character writing_script_character not null,
    text text not null,
    cue text,
    assigned_to text,
    last_edited_by text,
    last_edited_at timestamp
  )`);
  await sqlc(`create index if not exists writing_script_lines_part_order_idx
    on writing_script_lines (part_id, "order")`);

  await sqlc(`create table if not exists writing_script_pins (
    id text primary key,
    script_id text not null references writing_scripts(id) on delete cascade,
    pin text not null,
    for_person text not null,
    created_at timestamp not null default now(),
    expires_at timestamp,
    revoked_at timestamp
  )`);
  await sqlc(`create unique index if not exists writing_script_pins_pin_idx
    on writing_script_pins (pin)`);
  await sqlc(`create index if not exists writing_script_pins_script_idx
    on writing_script_pins (script_id)`);

  console.log("✓ writing-session schema pushed");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
