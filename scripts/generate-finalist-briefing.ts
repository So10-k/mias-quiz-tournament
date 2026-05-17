// Generate the finalist briefing PDF and upload it as an attachment
// to a Finals Room topic on Discourse. The briefing is intentionally
// VAGUE about the topic — gives the finalists enough context to be
// entertaining without enabling deep study. Strict instructions on
// conduct, joining the live show, and the format.
//
// Output:
//   - /Users/samuelotten/Downloads/miasapp1/finalist-briefing.pdf
//   - One topic per bracket in the Finals Room category, with the
//     PDF attached + an inline summary.
//
// Idempotent: re-running deletes any prior briefing topic the bot
// posted in Finals Room before re-creating.
//
// Run:
//   npx tsx scripts/generate-finalist-briefing.ts

import PDFDocument from "pdfkit";
import { writeFileSync, createReadStream, statSync } from "node:fs";
import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";

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

const DISCOURSE = process.env.DISCOURSE_BASE_URL ?? "https://discuss.miaswebsites.art";
const KEY = process.env.DISCOURSE_BOT_API_KEY;
const BOT = process.env.DISCOURSE_BOT_USERNAME ?? "support_bot";
if (!KEY) {
  console.warn("⚠ DISCOURSE_BOT_API_KEY missing — will generate PDF locally only, skip upload.");
}

const OUT_PATH = resolve(process.cwd(), "finalist-briefing.pdf");

// ── PDF generation ────────────────────────────────────────────────
function generatePdf(): Promise<void> {
  return new Promise((resolveFn, rejectFn) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 64, bottom: 64, left: 64, right: 64 },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => {
      writeFileSync(OUT_PATH, Buffer.concat(chunks));
      resolveFn();
    });
    doc.on("error", rejectFn);

    // Cover header
    doc
      .fillColor("#1B2A4E")
      .font("Helvetica-Bold")
      .fontSize(28)
      .text("THE QUIZ BOOK", { align: "center" })
      .moveDown(0.2);
    doc
      .fontSize(14)
      .fillColor("#C9296A")
      .font("Helvetica")
      .text("FINALIST BRIEFING — CONFIDENTIAL", { align: "center" })
      .moveDown(2);

    doc
      .fontSize(11)
      .fillColor("#1B2A4E")
      .font("Helvetica-Oblique")
      .text(
        "This document is for finalists' eyes only. By reading further you reaffirm the confidentiality terms you agreed to in the forum NDA. Do not share, screenshot, or paraphrase any portion of what follows to anyone who is not a finalist or member of the production team.",
        { align: "justify" }
      )
      .moveDown(1.5);

    function h2(text: string) {
      doc
        .moveDown(1)
        .fillColor("#E94B7E")
        .font("Helvetica-Bold")
        .fontSize(16)
        .text(text)
        .moveDown(0.4);
      doc.fillColor("#1B2A4E").font("Helvetica").fontSize(11);
    }
    function p(text: string) {
      doc.text(text, { align: "justify" }).moveDown(0.6);
    }
    function bullet(items: string[]) {
      doc.list(items, { bulletRadius: 2, indent: 18, lineGap: 4 });
      doc.moveDown(0.4);
    }

    h2("01 · The format");
    p(
      "The finals will be hosted live. Both the winners-bracket final and the losers-bracket final will run in parallel: each finalist will face the other player in their bracket only — you will not be answering the same questions as the people in the other bracket. Both finals are 15 multiple-choice questions, one correct answer per question, untimed within reason. The host will call the start; questions appear; you answer; host advances."
    );
    p(
      "After both bracket finals resolve, the winner of the winners-bracket and the winner of the losers-bracket meet in the championship match. The format of that championship will be announced separately."
    );

    h2("02 · The topic (vague on purpose)");
    p(
      "Both bracket finals share a single broad theme — a familiar, mainstream domain you've encountered for years through everyday life, travel media, or general schooling. The questions are recognition-and-recall format, not trivia-deep-cut format. Expect places, names, and origins. Expect at least a few that involve a globe."
    );
    p(
      "We're keeping the topic vague intentionally. The finals are meant to be a show, not a study session. Show up, react to the questions on camera, be entertaining. If you over-prepare, the magic dies."
    );

    h2("03 · How you'll join");
    bullet([
      "We'll send a calendar invite once the date is locked.",
      "Sign in to discuss.miaswebsites.art at least 24 hours before the show.",
      "If you haven't agreed to the NDA, the forum will redirect you to the agreement PM. Reply with \"yes I agree\" and you're in.",
      "Once agreed, you'll see a category called Finals Room — that's where pre-show coordination happens. Drop a hello in the chat so we know your account is wired up.",
      "On show day, join the live broadcast link 10 minutes early. We'll do a quick mic check.",
    ]);

    h2("04 · Conduct expectations");
    p(
      "This is a family-friendly show. Don't curse, don't trash-talk, don't spoil anything for the audience. React naturally — laughs, groans, dramatic pauses, finger-guns at the camera, all welcome. The audience came for chemistry, so give them chemistry."
    );
    bullet([
      "Camera on, framed at chest-up.",
      "Mic check the night before the show.",
      "If you guess, guess out loud. Silence is poison on a show.",
      "Losing gracefully > winning awkwardly.",
      "If you need a moment, tell the host — we can pause.",
    ]);

    h2("05 · Strict no-go list");
    bullet([
      "Don't tell anyone what bracket you're in or who your opponent is until the host announces it on the broadcast.",
      "Don't research or screenshot any part of this brief.",
      "Don't compare notes with other finalists — including the person in your own bracket.",
      "Don't post in any public forum category about your finals participation. Use Finals Room only.",
      "Don't show this PDF to anyone, ever. Not even after the broadcast.",
    ]);

    h2("06 · What we ship to the audience");
    p(
      "The bracket page, the standings, the live broadcast itself, and the post-show recap will all be public. Everything else — the format details, the question pool's exact composition, the back-and-forth chatter in Finals Room — stays inside the finalist circle. We'll publish a recap blog post after the championship that may quote your live reactions verbatim. If a specific reaction is sensitive, flag it to the host before the broadcast."
    );

    h2("07 · Questions for us");
    p(
      "Use the Finals Room category on the forum. We monitor it. Don't email about logistics — the forum is the source of truth, and we want a single audit trail for everyone."
    );

    doc
      .moveDown(2)
      .fontSize(10)
      .fillColor("#3B4A7E")
      .font("Helvetica-Oblique")
      .text(
        "Generated " +
          new Date().toISOString().slice(0, 10) +
          " · The Quiz Book · Confidential — do not redistribute.",
        { align: "center" }
      );

    doc.end();
  });
}

// ── Discourse upload + topic creation ─────────────────────────────
async function discourseFetch(path: string, init: RequestInit) {
  const res = await fetch(`${DISCOURSE}${path}`, {
    ...init,
    headers: {
      "Api-Key": KEY!,
      "Api-Username": BOT,
      ...(init.headers ?? {}),
    } as any,
  });
  if (!res.ok) {
    throw new Error(`${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

async function uploadPdf(): Promise<{ short_url: string; original_filename: string }> {
  const form = new FormData();
  const buf = readFileSync(OUT_PATH);
  form.append("file", new Blob([buf], { type: "application/pdf" }), "finalist-briefing.pdf");
  form.append("type", "composer");
  form.append("synchronous", "true");
  const res = await fetch(`${DISCOURSE}/uploads.json`, {
    method: "POST",
    headers: {
      "Api-Key": KEY!,
      "Api-Username": BOT,
    },
    body: form as any,
  });
  if (!res.ok) {
    throw new Error(`upload → ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { short_url: string; original_filename: string };
  return json;
}

async function findFinalsRoomCategoryId(): Promise<number> {
  const json = await discourseFetch("/c/finals-room/show.json", { method: "GET" });
  return (json as any).category.id;
}

async function deletePriorBriefingTopics(catId: number) {
  // List topics in the category whose title starts with "📋 Finalist Briefing".
  const json = await discourseFetch(`/c/${catId}.json`, { method: "GET" });
  const topics = (json as any).topic_list?.topics ?? [];
  for (const t of topics) {
    if (typeof t.title === "string" && t.title.startsWith("📋 Finalist Briefing")) {
      try {
        await discourseFetch(`/t/${t.id}.json`, { method: "DELETE" });
        console.log(`  ↺ deleted prior briefing topic #${t.id}`);
      } catch (e) {
        console.warn(`  ⚠ couldn't delete topic ${t.id}: ${e}`);
      }
    }
  }
}

async function createBriefingTopic(catId: number, upload: { short_url: string; original_filename: string }) {
  const sizeKb = Math.round(statSync(OUT_PATH).size / 1024);
  const raw = `# 📋 Finalist Briefing — strict + vague (read this first)

You're seeing this because you've agreed to the finals NDA. Welcome to the back room.

**The PDF below is the canonical briefing.** Read it once, top to bottom, then come back here and drop a "👍 read it" reply so we know you're up to speed.

[finalist-briefing.pdf|attachment](${upload.short_url}) (${sizeKb} KB)

## TL;DR

- Topic is broad and recognition-format. **Don't over-study.** The show works because of your reactions, not your prep.
- Both bracket finals run in parallel with **separate question sets** on the same theme — no info-leak between brackets.
- 15 questions per bracket, multiple choice, host-driven.
- Sign in to the forum 24h before, post in Finals Room so we know you're wired up, join the broadcast 10 min early.
- Don't share, don't screenshot, don't compare notes with anyone — including the other finalist in your bracket.

If you have questions, post in this category. Don't email. We want one audit trail.`;

  const result = (await discourseFetch("/posts.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "📋 Finalist Briefing — strict + vague (read this first)",
      raw,
      category: catId,
      archetype: "regular",
    }),
  })) as { topic_id: number; topic_slug: string };
  console.log(`  ✓ posted briefing topic #${result.topic_id} in Finals Room`);
  return result;
}

async function main() {
  console.log("→ Generating PDF…");
  await generatePdf();
  console.log(`  ✓ wrote ${OUT_PATH} (${Math.round(statSync(OUT_PATH).size / 1024)} KB)`);
  if (!KEY) {
    console.log("  ⏭️  skipping Discourse upload (no DISCOURSE_BOT_API_KEY).");
    return;
  }
  console.log("→ Uploading to Discourse…");
  const upload = await uploadPdf();
  console.log(`  ✓ short_url: ${upload.short_url}`);
  console.log("→ Locating Finals Room category…");
  const catId = await findFinalsRoomCategoryId();
  console.log(`  ✓ category id: ${catId}`);
  console.log("→ Cleaning up prior briefing topics…");
  await deletePriorBriefingTopics(catId);
  console.log("→ Posting briefing topic…");
  await createBriefingTopic(catId, upload);
  console.log("\n✅ Briefing PDF is live in Finals Room.");
}

main().catch((e) => { console.error(e); process.exit(1); });
