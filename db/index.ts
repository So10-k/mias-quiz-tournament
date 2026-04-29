import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

// Neon's HTTP driver uses native fetch under the hood, and Next 15 caches
// every server fetch by default — which means once we read "no attempt for
// this user" the result sticks across requests even after a submit commits.
// Force-disable the cache so reads always reflect current DB state.
const sql = neon(url, {
  fetchOptions: { cache: "no-store" },
});
export const db = drizzle(sql, { schema });
export { schema };
export type DB = typeof db;
