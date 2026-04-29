// One-shot health check: for every question in the currently-active
// round (or the latest round if none active), print which option is
// flagged as correct. Catches the failure mode where seed/edit forgot to
// mark an answer and every player auto-fails.
//
// Usage:
//   npx tsx scripts/check-correct-options.ts             # active/latest round
//   npx tsx scripts/check-correct-options.ts <roundId>   # a specific round

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema.ts";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function pickRound(arg: string | undefined) {
  if (arg) {
    const [r] = await db
      .select()
      .from(schema.rounds)
      .where(eq(schema.rounds.id, arg))
      .limit(1);
    return r ?? null;
  }
  // Active rounds first, then most recent of any status.
  const [active] = await db
    .select()
    .from(schema.rounds)
    .where(
      and(
        eq(schema.rounds.status, "active"),
        eq(schema.rounds.isPractice, false)
      )
    )
    .orderBy(desc(schema.rounds.createdAt))
    .limit(1);
  if (active) return active;
  const [latest] = await db
    .select()
    .from(schema.rounds)
    .orderBy(desc(schema.rounds.createdAt))
    .limit(1);
  return latest ?? null;
}

async function main() {
  const arg = process.argv[2];
  const round = await pickRound(arg);
  if (!round) {
    console.error("No rounds found.");
    process.exit(1);
  }

  console.log(
    `\nRound: "${round.title}" · chapter ${round.chapterNumber} · status=${round.status} · practice=${round.isPractice} · pass≥${round.passThreshold}\n`
  );

  const qs = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.roundId, round.id))
    .orderBy(asc(schema.questions.order));

  if (qs.length === 0) {
    console.log("⚠️  No questions in this round.\n");
    process.exit(0);
  }

  const allOpts =
    qs.length === 0
      ? []
      : await db
          .select()
          .from(schema.options)
          .where(
            inArray(
              schema.options.questionId,
              qs.map((q) => q.id)
            )
          )
          .orderBy(asc(schema.options.order));

  const optsByQ = new Map<string, typeof allOpts>();
  for (const o of allOpts) {
    if (!optsByQ.has(o.questionId)) optsByQ.set(o.questionId, []);
    optsByQ.get(o.questionId)!.push(o);
  }

  let bad = 0;
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    const opt = optsByQ.get(q.id) ?? [];
    const correct = opt.filter((o) => o.isCorrect);
    const flag =
      correct.length === 0
        ? "❌ NO CORRECT OPTION"
        : correct.length > 1
        ? `⚠️ ${correct.length} CORRECT OPTIONS (more than one!)`
        : "✓";
    if (correct.length !== 1) bad += 1;
    console.log(
      `${flag}  Q${i + 1}: ${q.prompt}\n   options: ${opt
        .map((o) => `${o.isCorrect ? "★" : " "} ${o.label}`)
        .join(" | ")}\n   roundId=${round.id}  questionId=${q.id}`
    );
  }

  console.log("");
  if (bad > 0) {
    console.log(
      `❌ ${bad} of ${qs.length} questions have a problem with their correct-option flag.`
    );
    console.log(
      "   Fix in the host panel (Round → Edit) — set the right option's isCorrect to true."
    );
    process.exit(2);
  } else {
    console.log(`✅ All ${qs.length} questions have exactly one correct option.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
