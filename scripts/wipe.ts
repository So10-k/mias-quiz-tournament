// Wipe EVERYTHING except the author account.
//
// Deletes: all tournaments (cascades → rounds, questions, options, attempts,
// answers, strikes, matchups, enrollments), all verification tokens, and all
// non-author users (which cascades → their sessions and accounts).
//
// Preserves: every user row with role='author' plus their sessions/accounts
// so Mia stays signed in on every device.
//
// Usage:
//   DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/wipe.ts
//
// Add --dry-run to preview what will be deleted without actually deleting.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema.ts";
import { eq, ne, and, not } from "drizzle-orm";

const DRY = process.argv.includes("--dry-run");

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  const before = {
    users: (await db.select().from(schema.users)).length,
    tournaments: (await db.select().from(schema.tournaments)).length,
    rounds: (await db.select().from(schema.rounds)).length,
    attempts: (await db.select().from(schema.attempts)).length,
    matchups: (await db.select().from(schema.matchups)).length,
    enrollments: (await db.select().from(schema.enrollments)).length,
    strikes: (await db.select().from(schema.strikes)).length,
    verificationTokens: (await db.select().from(schema.verificationTokens))
      .length,
  };

  const authors = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.users)
    .where(eq(schema.users.role, "author"));

  console.log("Preserving author accounts:");
  for (const a of authors) {
    console.log(`  · ${a.name ?? "—"}  <${a.email}>`);
  }
  if (authors.length === 0) {
    console.warn(
      "⚠️  No author accounts found. Check AUTHOR_EMAIL + sign in once before wiping, or this will leave you with no host."
    );
  }

  console.log("\nCurrent row counts:");
  for (const [k, v] of Object.entries(before)) console.log(`  ${k}: ${v}`);

  if (DRY) {
    console.log("\n--dry-run — no deletions performed.");
    return;
  }

  console.log("\n→ deleting all tournaments (cascades to rounds, matchups, attempts, enrollments, strikes)");
  await db.delete(schema.tournaments);

  console.log("→ clearing all verification tokens");
  await db.delete(schema.verificationTokens);

  console.log("→ deleting all non-author users (cascades to their sessions and accounts)");
  await db.delete(schema.users).where(ne(schema.users.role, "author"));

  // Belt-and-suspenders: if any orphan sessions/accounts linger (shouldn't,
  // due to cascade), the select-and-delete below wipes them.
  const authorIds = authors.map((a) => a.id);
  if (authorIds.length > 0) {
    const { inArray } = await import("drizzle-orm");
    await db
      .delete(schema.sessions)
      .where(not(inArray(schema.sessions.userId, authorIds)));
    await db
      .delete(schema.accounts)
      .where(not(inArray(schema.accounts.userId, authorIds)));
  }
  void and; // keep import alive for future filtering

  const after = {
    users: (await db.select().from(schema.users)).length,
    tournaments: (await db.select().from(schema.tournaments)).length,
    rounds: (await db.select().from(schema.rounds)).length,
    attempts: (await db.select().from(schema.attempts)).length,
    matchups: (await db.select().from(schema.matchups)).length,
    enrollments: (await db.select().from(schema.enrollments)).length,
    strikes: (await db.select().from(schema.strikes)).length,
    verificationTokens: (await db.select().from(schema.verificationTokens))
      .length,
  };
  console.log("\nAfter wipe:");
  for (const [k, v] of Object.entries(after)) console.log(`  ${k}: ${v}`);
  console.log("\n✓ done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
