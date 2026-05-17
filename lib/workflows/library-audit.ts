// Read-only audit on libraryQuestions: count, age-range balance,
// difficulty distribution, duplicate detection by prompt.

import { db, schema } from "@/db";
import { sql } from "drizzle-orm";
import type { WorkflowDef, WorkflowResult, WorkflowCheck } from "./types";

export const libraryAuditWorkflow: WorkflowDef = {
  id: "library-audit",
  name: "Question library audit",
  description:
    "Read-only health check on libraryQuestions: total count, subject and difficulty distribution, age-range balance, and duplicate-prompt detection. Use before seeding new rounds.",
  emoji: "📚",
  sideEffects: "None.",
  async run(): Promise<WorkflowResult> {
    const checks: WorkflowCheck[] = [];
    const [{ c: total }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.libraryQuestions);
    checks.push({
      id: "total",
      label: "Library populated",
      severity: total >= 100 ? "ok" : total >= 30 ? "warn" : "fail",
      detail: `${total} questions in library.`,
      remedy:
        total < 30
          ? "Run scripts/seed-library.ts or add manually from /host/library."
          : undefined,
    });

    // Subject distribution. Aim for at least 5 per major subject.
    const subjects = await db
      .select({
        subject: schema.libraryQuestions.subject,
        c: sql<number>`count(*)::int`,
      })
      .from(schema.libraryQuestions)
      .groupBy(schema.libraryQuestions.subject);
    const subjectMap = new Map<string, number>(
      subjects.map((s) => [s.subject as string, s.c])
    );
    for (const subj of [
      "general",
      "math",
      "reading",
      "science",
      "history",
      "geography",
      "animals",
      "words",
      "riddles",
      "logic",
      "art",
      "music",
      "sports",
    ]) {
      const c = subjectMap.get(subj) ?? 0;
      checks.push({
        id: `subj-${subj}`,
        label: `Subject · ${subj}`,
        severity: c >= 5 ? "ok" : c >= 1 ? "warn" : "fail",
        detail: `${c} questions.`,
      });
    }

    // Difficulty distribution.
    const diffs = await db
      .select({
        difficulty: schema.libraryQuestions.difficulty,
        c: sql<number>`count(*)::int`,
      })
      .from(schema.libraryQuestions)
      .groupBy(schema.libraryQuestions.difficulty);
    const diffMap = new Map(diffs.map((d) => [d.difficulty, d.c]));
    for (let d = 1; d <= 5; d++) {
      const c = diffMap.get(d) ?? 0;
      checks.push({
        id: `diff-${d}`,
        label: `Difficulty ${d}`,
        severity: c >= 3 ? "ok" : "warn",
        detail: `${c} questions.`,
      });
    }

    // Duplicates by normalized prompt.
    const dupRows = await db.execute(sql<{ prompt: string; c: number }>`
      select lower(trim(${schema.libraryQuestions.prompt})) as prompt,
             count(*)::int as c
      from ${schema.libraryQuestions}
      group by 1
      having count(*) > 1
      order by c desc
      limit 10
    `);
    const dupArr = dupRows as unknown as Array<{ prompt: string; c: number }>;
    checks.push({
      id: "duplicates",
      label: "Duplicate prompts",
      severity: dupArr.length === 0 ? "ok" : "warn",
      detail:
        dupArr.length === 0
          ? "No exact duplicate prompts."
          : `${dupArr.length} duplicate prompt(s) found — top: "${dupArr[0].prompt.slice(0, 60)}" (${dupArr[0].c} copies).`,
    });

    // Age-range balance — questions with ageMin <= 8 should be plentiful
    // since Mia is 7.
    const [{ c: kidFriendly }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.libraryQuestions)
      .where(sql`${schema.libraryQuestions.ageMin} <= 8`);
    checks.push({
      id: "kid-friendly",
      label: "Kid-friendly (ageMin ≤ 8)",
      severity: kidFriendly >= 30 ? "ok" : kidFriendly >= 10 ? "warn" : "fail",
      detail: `${kidFriendly} kid-friendly questions.`,
    });

    const overall = checks.reduce<"ok" | "warn" | "fail">(
      (acc, c) =>
        c.severity === "fail"
          ? "fail"
          : c.severity === "warn" && acc !== "fail"
            ? "warn"
            : acc,
      "ok"
    );

    return {
      ok: overall !== "fail",
      summary: `📚 Library has ${total} questions across ${subjects.length} subjects.`,
      targets: [
        {
          targetId: "library",
          name: "Question library",
          status: overall,
          tasksRemaining: checks.filter((c) => c.severity === "fail").length,
          checks,
          emailSent: false,
        },
      ],
      effects: ["Read-only."],
    };
  },
};
