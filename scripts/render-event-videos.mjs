#!/usr/bin/env node
// Render every event video to public/videos/.
//
//   node scripts/render-event-videos.mjs                 # all 20
//   node scripts/render-event-videos.mjs AdBracketInsurance IntroLosersFinal
//
// Each render takes ~15-60s. To preview without rendering, run
// `npm run video:preview` (Remotion studio) and pick a composition
// by id from the sidebar.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "videos");

// Mirror of EVENT_VIDEOS in remotion/eventVideos.ts. Kept in sync by
// hand — only the id + output filename are needed for rendering.
const VIDEOS = [
  // 8 slides
  ["EventWelcomeIntro", "event-welcome-intro.mp4"],
  ["EventTournamentRecap", "event-tournament-recap.mp4"],
  ["IntroLosersFinal", "intro-losers-final.mp4"],
  ["IntroWinnersFinal", "intro-winners-final.mp4"],
  ["ChampionshipTease", "championship-tease.mp4"],
  ["ChampionCeremony", "champion-ceremony.mp4"],
  ["HotTakesInterlude", "hot-takes-interlude.mp4"],
  ["EventOutro", "event-outro.mp4"],
  // 12 parody ads
  ["AdBracketInsurance", "ad-bracket-insurance.mp4"],
  ["AdTriviaPillow", "ad-trivia-pillow.mp4"],
  ["AdHotTakeHotline", "ad-hot-take-hotline.mp4"],
  ["AdStrikeCream", "ad-strike-cream.mp4"],
  ["AdMiasSchool", "ad-mias-school.mp4"],
  ["AdBracketMate", "ad-bracket-mate.mp4"],
  ["AdQuizVitamins", "ad-quiz-vitamins.mp4"],
  ["AdBuzzerApp", "ad-buzzer-app.mp4"],
  ["AdDiscourseCat", "ad-discourse-cat.mp4"],
  ["AdRewriteHistory", "ad-rewrite-history.mp4"],
  ["AdWrongAnswerInsurance", "ad-wrong-answer-insurance.mp4"],
  ["AdInternalMonologue", "ad-internal-monologue.mp4"],
  ["AdSamMiaAftershow", "ad-sam-mia-aftershow.mp4"],
];

const args = process.argv.slice(2);
const onlyIds = args.length > 0 ? new Set(args) : null;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

let failed = 0;
for (const [id, name] of VIDEOS) {
  if (onlyIds && !onlyIds.has(id)) continue;
  const out = join(OUT_DIR, name);
  console.log(`\n▶ Rendering ${id} → ${name}`);
  const res = spawnSync(
    "npx",
    ["remotion", "render", "remotion/index.ts", id, out, "--concurrency=2"],
    { cwd: ROOT, stdio: "inherit" }
  );
  if (res.status !== 0) {
    failed++;
    console.error(`✗ Failed: ${id}`);
  } else {
    console.log(`✓ Done: ${name}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} render(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll renders complete.");
}
