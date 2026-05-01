// Spin up a 5-question "law" tiebreaker as a practice round in the live
// tournament. Practice rounds don't give strikes or auto-feed the bracket
// — we leave the bracket auto-resolution to scripts/resolve-tiebreaker.ts
// after both contestants have submitted.
//
// Pass --matchup <matchupId> (run scripts/show-bracket.ts to find it) to
// link the round to a specific bracket pairing. When linked:
//   - only those two players (and the author) can access the round URL
//   - it's hidden from the public practice list on /play
//   - the resolver script can auto-detect the matchup from the round
//
//   npx tsx scripts/create-tiebreaker.ts --matchup apacit4pw0u0

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, asc, desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import * as schema from "../db/schema.ts";

const TARGET_ORIGIN =
  process.env.SITE_ORIGIN ?? "https://quiz.miaswebsites.art";

function loadEnvLocal() {
  try {
    const t = readFileSync(".env.local", "utf8");
    for (const line of t.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const eq = s.indexOf("=");
      if (eq === -1) continue;
      const k = s.slice(0, eq).trim();
      let v = s.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      )
        v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {}
}
loadEnvLocal();

function makeId(): string {
  const alpha = "0123456789abcdefghijklmnopqrstuvwxyz";
  const b = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += alpha[b[i] % 36];
  return out;
}

type Topic = {
  title: string;
  intro: string;
  questions: Array<{
    prompt: string;
    options: Array<{ label: string; isCorrect: boolean }>;
  }>;
};

const TOPICS: Record<string, Topic> = {
  law: {
    title: "Tiebreaker · 5 questions on The Law",
    intro:
      "You're here because of a tie. Five questions on U.S. law — pitched between civics-class and bar-exam-prep. Whoever scores higher takes the bracket slot. Take your time, but no looking things up.",
    questions: [
      {
        prompt:
          "The Miranda warning (“you have the right to remain silent…”) protects rights guaranteed by which amendment to the U.S. Constitution?",
        options: [
          { label: "4th Amendment", isCorrect: false },
          { label: "5th Amendment", isCorrect: true },
          { label: "6th Amendment", isCorrect: false },
          { label: "14th Amendment", isCorrect: false },
        ],
      },
      {
        prompt:
          "The 1803 Supreme Court case Marbury v. Madison is best known for establishing the principle of:",
        options: [
          { label: "Federalism", isCorrect: false },
          { label: "Judicial review", isCorrect: true },
          { label: "Separation of powers", isCorrect: false },
          { label: "Habeas corpus", isCorrect: false },
        ],
      },
      {
        prompt:
          "In a U.S. criminal trial, the prosecution must prove the defendant’s guilt to what standard?",
        options: [
          { label: "Preponderance of the evidence", isCorrect: false },
          { label: "Clear and convincing evidence", isCorrect: false },
          { label: "Beyond a reasonable doubt", isCorrect: true },
          { label: "Probable cause", isCorrect: false },
        ],
      },
      {
        prompt: "The legal writ of “habeas corpus” essentially guarantees that:",
        options: [
          { label: "Defendants can confront their accusers in court", isCorrect: false },
          {
            label:
              "A person held by the government must be brought before a court to test the legality of the detention",
            isCorrect: true,
          },
          { label: "Witnesses must testify under oath", isCorrect: false },
          { label: "Searches by police require a warrant", isCorrect: false },
        ],
      },
      {
        prompt:
          "The Latin phrase “stare decisis” refers to the legal principle that:",
        options: [
          { label: "Defendants are presumed innocent until proven guilty", isCorrect: false },
          { label: "Courts should generally follow established precedent", isCorrect: true },
          { label: "No one is above the law", isCorrect: false },
          { label: "Trials must be conducted in public", isCorrect: false },
        ],
      },
    ],
  },
  elections: {
    title: "Tiebreaker · 5 questions on election politics",
    intro:
      "You're here because of a tie. Five questions on election politics — three on the French system, two on voting theory. Pitched hard. Whoever scores higher takes the bracket slot. No looking things up.",
    questions: [
      // ── French election politics (3) ─────────────────────────────────────
      {
        prompt:
          "In a French legislative election (Assemblée nationale), what is the minimum threshold a first-round candidate must reach to qualify for the second round?",
        options: [
          { label: "10% of votes cast", isCorrect: false },
          { label: "12.5% of registered voters in the constituency", isCorrect: true },
          { label: "15% of votes cast", isCorrect: false },
          { label: "5% of registered voters in the constituency", isCorrect: false },
        ],
      },
      {
        prompt:
          "The “quinquennat” — reducing the French presidential term from seven years to five — was approved by referendum in which year?",
        options: [
          { label: "1995", isCorrect: false },
          { label: "2000", isCorrect: true },
          { label: "2002", isCorrect: false },
          { label: "1981", isCorrect: false },
        ],
      },
      {
        prompt:
          "“Cohabitation” in French politics refers to:",
        options: [
          { label: "A coalition government inside the National Assembly", isCorrect: false },
          {
            label:
              "The President and the Prime Minister belonging to opposing political camps",
            isCorrect: true,
          },
          { label: "The merger of two political parties", isCorrect: false },
          { label: "A President serving two consecutive terms", isCorrect: false },
        ],
      },
      // ── General election theory (2) ─────────────────────────────────────
      {
        prompt:
          "In voting theory, the Condorcet paradox describes a situation where:",
        options: [
          { label: "A single candidate dominates every possible election", isCorrect: false },
          {
            label:
              "Majority preferences cycle, so no candidate beats all others one-on-one",
            isCorrect: true,
          },
          { label: "Voters strategically misrepresent their true preferences", isCorrect: false },
          { label: "A small minority can always overrule the majority", isCorrect: false },
        ],
      },
      {
        prompt:
          "Duverger's Law is the political-science observation that:",
        options: [
          {
            label:
              "Plurality (first-past-the-post) elections tend to produce two-party systems",
            isCorrect: true,
          },
          {
            label:
              "Proportional representation tends to produce two-party systems",
            isCorrect: false,
          },
          { label: "Voter turnout decreases with each successive election", isCorrect: false },
          { label: "Incumbents always have a structural electoral advantage", isCorrect: false },
        ],
      },
    ],
  },
};

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL not set");
    process.exit(2);
  }
  const matchupArgIdx = process.argv.indexOf("--matchup");
  const matchupId =
    matchupArgIdx === -1 ? null : process.argv[matchupArgIdx + 1] ?? null;
  const topicArgIdx = process.argv.indexOf("--topic");
  const topicKey =
    topicArgIdx === -1 ? "law" : process.argv[topicArgIdx + 1] ?? "law";
  const topic = TOPICS[topicKey];
  if (!topic) {
    console.error(
      `❌ Unknown --topic "${topicKey}". Available: ${Object.keys(TOPICS).join(", ")}`
    );
    process.exit(2);
  }
  const sql = neon(dbUrl, { fetchOptions: { cache: "no-store" } });
  const db = drizzle(sql, { schema });

  if (matchupId) {
    const [m] = await db
      .select()
      .from(schema.matchups)
      .where(eq(schema.matchups.id, matchupId))
      .limit(1);
    if (!m) {
      console.error(`❌ Matchup ${matchupId} not found.`);
      process.exit(1);
    }
    if (!m.playerAUserId || !m.playerBUserId) {
      console.error(
        `❌ Matchup ${matchupId} doesn't have both players set yet (A=${m.playerAUserId} B=${m.playerBUserId}).`
      );
      process.exit(1);
    }
  }

  const [tournament] = await db
    .select()
    .from(schema.tournaments)
    .orderBy(desc(schema.tournaments.createdAt))
    .limit(1);
  if (!tournament) {
    console.error("❌ No tournament found.");
    process.exit(1);
  }

  // Pick the next chapter number that's free in this tournament.
  const existing = await db
    .select({ chapterNumber: schema.rounds.chapterNumber })
    .from(schema.rounds)
    .where(
      and(
        eq(schema.rounds.tournamentId, tournament.id),
        eq(schema.rounds.isPractice, true)
      )
    )
    .orderBy(asc(schema.rounds.chapterNumber));
  const nextChapter = (existing[existing.length - 1]?.chapterNumber ?? 99) + 1;

  const roundId = makeId();
  await db.insert(schema.rounds).values({
    id: roundId,
    tournamentId: tournament.id,
    chapterNumber: nextChapter,
    title: topic.title,
    introProse: topic.intro,
    passThreshold: "0.0",
    status: "active",
    isPractice: true,
    tiebreakerMatchupId: matchupId,
  });

  for (let i = 0; i < topic.questions.length; i++) {
    const q = topic.questions[i];
    const qId = makeId();
    await db.insert(schema.questions).values({
      id: qId,
      roundId,
      order: i,
      prompt: q.prompt,
      questionType: "multiple_choice",
      points: 1,
    });
    for (let j = 0; j < q.options.length; j++) {
      const o = q.options[j];
      await db.insert(schema.options).values({
        id: makeId(),
        questionId: qId,
        order: j,
        label: o.label,
        isCorrect: o.isCorrect,
      });
    }
  }

  const url = `${TARGET_ORIGIN}/play/practice/${roundId}`;
  console.log("\n✅ Tiebreaker round created.");
  console.log(`   roundId: ${roundId}`);
  console.log(`   chapter: ${nextChapter}`);
  console.log(`   url:     ${url}`);
  console.log(
    `\nPaste that URL into the "tiebreaker-quiz" email template's "Take it"` +
      `\nbutton URL field, then send to Rhonda + Juliette via the "Hand-picked` +
      `\nplayers" audience.`
  );
  console.log(
    `\nWhen both have submitted, run:\n   npx tsx scripts/resolve-tiebreaker.ts --round ${roundId} --matchup <bracketMatchupId>\n`
  );
}

main().catch((e) => {
  console.error("\n❌ Failed:", e);
  process.exit(1);
});
