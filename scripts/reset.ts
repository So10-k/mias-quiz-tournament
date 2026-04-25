// Wipes ALL tournament data (tournaments, rounds, attempts, enrollments,
// strikes) and removes e2e test users. Leaves real users and sessions intact.
//
// Usage:  DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/reset.ts

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema.ts";
import { eq, like } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  console.log("→ deleting all tournaments (cascade -> rounds, enrollments, strikes, attempts, answers, options, questions)");
  await db.delete(schema.tournaments);

  console.log("→ deleting e2e test users");
  for (const e of [
    "e2e-mia@example.com",
    "e2e-alice@example.com",
    "e2e-bob@example.com",
  ]) {
    await db.delete(schema.users).where(eq(schema.users.email, e));
  }

  // Optional: clear stale verification tokens
  console.log("→ clearing verification tokens");
  await db.delete(schema.verificationTokens);

  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
