// Sanity test: generate a bracket with 5 fake players, propagate byes,
// resolve the rest manually, confirm one champion emerges.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema.ts";
import { eq } from "drizzle-orm";
import {
  generateBracket,
  resolveMatchup,
  getBracket,
  getBracketChampionId,
  clearBracket,
} from "../lib/bracket.ts";
import { getOrCreateActiveTournament, enroll } from "../lib/engine.ts";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  console.log("→ wiping bracket-test users + tournaments");
  for (const e of [
    "bt-1@example.com",
    "bt-2@example.com",
    "bt-3@example.com",
    "bt-4@example.com",
    "bt-5@example.com",
  ]) {
    await db.delete(schema.users).where(eq(schema.users.email, e));
  }
  // Reuse current tournament if it exists, otherwise create.
  const t = await getOrCreateActiveTournament();
  await clearBracket(t.id);

  console.log("→ creating 5 fake players and enrolling");
  const ids: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const [u] = await db
      .insert(schema.users)
      .values({
        id: crypto.randomUUID(),
        email: `bt-${i}@example.com`,
        name: `Player ${i}`,
      })
      .returning();
    ids.push(u.id);
    await enroll(u.id, t.id);
  }

  console.log("→ generating bracket from", ids.length, "seeds");
  await generateBracket(t.id, ids);

  let rounds = await getBracket(t.id);
  console.log("rounds:", rounds.length);
  for (const r of rounds) {
    console.log(
      `  round ${r.roundIndex}:`,
      r.matchups.map(
        (m) =>
          `(slot ${m.slot}: A=${m.playerAUserId?.slice(0, 4) ?? "·"} B=${m.playerBUserId?.slice(0, 4) ?? "·"} W=${m.winnerUserId?.slice(0, 4) ?? "·"} via=${m.resolvedVia ?? "—"})`
      )
    );
  }

  // Resolve round-by-round, re-fetching after each so propagation is visible.
  console.log("→ resolving all matchups manually");
  const totalRounds = rounds.length;
  for (let ri = 1; ri <= totalRounds; ri++) {
    const fresh = await getBracket(t.id);
    const r = fresh.find((x) => x.roundIndex === ri)!;
    for (const m of r.matchups) {
      if (m.winnerUserId) continue;
      const winner = m.playerAUserId ?? m.playerBUserId;
      if (!winner) continue;
      await resolveMatchup(m.id, winner, "manual");
    }
  }

  rounds = await getBracket(t.id);
  console.log("→ post-resolution:");
  for (const r of rounds) {
    console.log(
      `  round ${r.roundIndex}:`,
      r.matchups.map(
        (m) =>
          `(slot ${m.slot}: W=${m.playerAUserId === m.winnerUserId ? "A" : m.playerBUserId === m.winnerUserId ? "B" : "—"})`
      )
    );
  }

  const champ = await getBracketChampionId(t.id);
  console.log("→ champion:", champ?.slice(0, 8) ?? "none");
  if (!champ) {
    console.error("✗ FAIL: no champion");
    process.exit(1);
  }

  // Cleanup
  for (const e of [
    "bt-1@example.com",
    "bt-2@example.com",
    "bt-3@example.com",
    "bt-4@example.com",
    "bt-5@example.com",
  ]) {
    await db.delete(schema.users).where(eq(schema.users.email, e));
  }
  await clearBracket(t.id);
  console.log("✓ bracket sanity test passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
