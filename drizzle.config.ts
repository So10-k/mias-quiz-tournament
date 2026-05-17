import { defineConfig } from "drizzle-kit";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// drizzle-kit doesn't auto-load .env.local, so we shim it here. Tries
// .env.local first (dev), then .env.production.local. Silent if neither
// exists — caller can still pass DATABASE_URL inline.
function loadDotenv() {
  const candidates = [".env.local", ".env.production.local"];
  for (const file of candidates) {
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
      // Don't clobber explicit env (so an inline DATABASE_URL=… wins).
      if (process.env[key] == null) process.env[key] = val;
    }
  }
}
loadDotenv();

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
