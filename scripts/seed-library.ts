// Seed (or re-seed) the question library with the built-in pack.
// Idempotent for the seed source: deletes everything with source='seed' and
// re-inserts the current bank. Host-added questions are left alone.
//
//   DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/seed-library.ts

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema.ts";
import { eq, sql as sqlBuilder } from "drizzle-orm";
import { getSeedQuestions } from "../lib/seed-bank.ts";
import { customAlphabet } from "nanoid";

const id = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  console.log("→ wiping seed-source rows");
  await db
    .delete(schema.libraryQuestions)
    .where(eq(schema.libraryQuestions.source, "seed"));

  const seeds = getSeedQuestions();
  console.log(`→ inserting ${seeds.length} seed questions`);

  // Insert in chunks to respect the Neon HTTP driver's payload size.
  const CHUNK = 100;
  for (let i = 0; i < seeds.length; i += CHUNK) {
    const slice = seeds.slice(i, i + CHUNK);
    await db.insert(schema.libraryQuestions).values(
      slice.map((q) => ({
        id: id(),
        prompt: q.prompt,
        options: q.options,
        subject: q.subject as any,
        ageMin: q.ageMin,
        ageMax: q.ageMax,
        difficulty: q.difficulty,
        source: "seed" as const,
      }))
    );
    console.log(`  · inserted ${Math.min(i + CHUNK, seeds.length)} / ${seeds.length}`);
  }

  const [{ n }] = await db
    .select({ n: sqlBuilder<number>`cast(count(*) as int)` })
    .from(schema.libraryQuestions);
  console.log(`✓ done. Library now has ${n} total questions.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
