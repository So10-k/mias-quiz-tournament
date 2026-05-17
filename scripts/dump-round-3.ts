// Dump round 3 questions to a CSV (opens in Excel directly).
// Output: round-3-questions.csv in the current dir.
//
//   DATABASE_URL='<neon url>' npx tsx scripts/dump-round-3.ts

import { neon } from "@neondatabase/serverless";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotenv() {
  for (const f of [".env.local", ".env.production.local"]) {
    const p = resolve(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      const k = t.slice(0, eq).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
loadDotenv();

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL missing"); process.exit(1); }
const sql = neon(url);

function csvCell(s: unknown): string {
  const v = String(s ?? "");
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

async function main() {
  // Pick the most-recent non-practice round 3 (chapter 3) of the
  // most-recent tournament — bias toward what's currently being run.
  const rows = await sql`
    SELECT
      r.id          AS round_id,
      r.title       AS round_title,
      r.chapter_number,
      t.title       AS tournament_title,
      q.id          AS question_id,
      q."order"     AS q_order,
      q.prompt      AS prompt,
      o."order"     AS o_order,
      o.label       AS option_label,
      o.is_correct  AS is_correct
    FROM rounds r
    JOIN tournaments t ON t.id = r.tournament_id
    JOIN questions q   ON q.round_id = r.id
    JOIN options   o   ON o.question_id = q.id
    WHERE r.chapter_number = 3
      AND r.is_practice = false
      AND r.tiebreaker_matchup_id IS NULL
      AND r.losers_matchup_id IS NULL
    ORDER BY t.created_at DESC, q."order" ASC, o."order" ASC
  `;

  if (rows.length === 0) {
    console.error("no round 3 questions found");
    process.exit(1);
  }

  // Group rows by question to find which option is correct + build columns.
  type Row = {
    round_title: string;
    tournament_title: string;
    question_id: string;
    q_order: number;
    prompt: string;
    o_order: number;
    option_label: string;
    is_correct: boolean;
  };
  const byQuestion = new Map<string, Row[]>();
  for (const r of rows as Row[]) {
    if (!byQuestion.has(r.question_id)) byQuestion.set(r.question_id, []);
    byQuestion.get(r.question_id)!.push(r);
  }

  const sortedQuestions = [...byQuestion.values()].sort(
    (a, b) => a[0].q_order - b[0].q_order
  );

  const headers = [
    "Q#",
    "Question",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "Correct",
    "Karen's answer",
    "✓/✗",
  ];

  const lines: string[] = [headers.map(csvCell).join(",")];

  for (const opts of sortedQuestions) {
    const sortedOpts = opts.sort((a, b) => a.o_order - b.o_order);
    const labels = sortedOpts.map((o) => o.option_label);
    const correctIdx = sortedOpts.findIndex((o) => o.is_correct);
    const correctLetter =
      correctIdx >= 0 ? String.fromCharCode(65 + correctIdx) : "";
    const padded = [...labels, "", "", "", "", "", ""].slice(0, 6);

    lines.push(
      [
        opts[0].q_order + 1,
        opts[0].prompt,
        ...padded,
        correctLetter,
        "",
        "",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  // Top header row with metadata.
  const meta = sortedQuestions[0][0];
  const out =
    `Tournament,${csvCell(meta.tournament_title)}\n` +
    `Round,${csvCell(`Chapter ${3} — ${meta.round_title}`)}\n` +
    `Player,Karen Liss\n` +
    `\n` +
    lines.join("\n");

  const outPath = resolve(process.cwd(), "round-3-questions.csv");
  writeFileSync(outPath, out, "utf8");
  console.log(`✅ wrote ${sortedQuestions.length} questions → ${outPath}`);
  console.log(`Open it: open ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
