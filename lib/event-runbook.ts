// Event runbook for finals night.
//
// The show runs in a fixed sequence of stages. Each stage encodes:
//   - the /watch scene to switch to (question, players, video, etc.)
//   - optional banner/body text overrides
//   - an optional video URL (for ad / interstitial stages)
//   - an optional "side effect" — start or advance a live round
//
// One click on "▶ Advance stage" in the host panel:
//   1. Applies the next stage's scene to /watch
//   2. Runs the side effect (e.g. starts the losers' final)
//   3. Bumps app_settings.event_stage_index so the panel + /watch
//      know where we are.
//
// The full ordered list lives in EVENT_STAGES below. Edit there to
// change running order, add interludes, etc.

import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { setWatchScene, type WatchSceneKind } from "@/lib/watch-scene";
import { launchFinalsRound, type FinalsSlot } from "@/lib/finals-rounds";
import { advanceLiveRound, completeLiveRound } from "@/lib/live";

const STAGE_INDEX_KEY = "event_stage_index";

export type StageRoundAction =
  | { kind: "start"; slot: FinalsSlot }
  | { kind: "advance"; slot: FinalsSlot }
  | { kind: "complete"; slot: FinalsSlot }
  | { kind: "none" };

export type EventStage = {
  id: string;
  /** Group heading shown in the runbook UI. */
  chapter: string;
  label: string;
  /** Short one-liner the UI uses for the next-stage preview. */
  tagline: string;
  /** Which `/watch` scene to switch to when we enter this stage. */
  scene: WatchSceneKind;
  /** Banner text override. Empty string clears the banner. */
  bannerText?: string;
  /** Body text (Text scene). */
  bodyText?: string;
  /** Public URL to play when scene === "video". */
  videoUrl?: string;
  /** Image URL when scene === "image". */
  imageUrl?: string;
  /** Composition id from remotion/eventVideos.ts when scene === "slide". */
  slideId?: string;
  /** Optional side-effect run when entering this stage. */
  roundAction?: StageRoundAction;
  /** When true, the stage is mostly waiting for the human host —
      lengthens the UI hint to "advance when you're ready". */
  holdForHost?: boolean;
};

// ────────────────────────────────────────────────────────────────────
// The show — pre-taped edition. Pre-show + bracket finals +
// championship + closing. Parody-ad sponsor breaks were removed for
// the pre-taped season; if they ever come back, paste them in from
// git history.
// ────────────────────────────────────────────────────────────────────

export const EVENT_STAGES: EventStage[] = [
  // ─── PRE-SHOW ────────────────────────────────────────────────────
  {
    id: "pre-show",
    chapter: "Pre-show",
    label: "Welcome screen + lobby music",
    tagline: "Show banner up while attendees arrive.",
    scene: "intermission",
    bannerText: "🌞 Mia's Quiz Tournament · Pre-taped Finals",
    holdForHost: true,
  },
  {
    id: "welcome",
    chapter: "Pre-show",
    label: "Welcome intro reel",
    tagline: "Plays the welcome slide live — no MP4 needed.",
    scene: "slide",
    slideId: "EventWelcomeIntro",
  },
  {
    id: "hosts-on-cam",
    chapter: "Pre-show",
    label: "Host & cohost greet the audience",
    tagline: "Cut to host & cohost on cam. /watch goes to text panel.",
    scene: "text",
    bannerText: "Recording: Mia's Quiz Tournament",
    bodyText:
      "Three rounds: the losers' bracket final, then the winners' bracket final, then a champion. We're recording each one and editing them together for you.",
    holdForHost: true,
  },
  {
    id: "tournament-recap",
    chapter: "Pre-show",
    label: "Tournament recap reel",
    tagline: "Recap slide live — animates the 8-week journey.",
    scene: "slide",
    slideId: "EventTournamentRecap",
  },
  {
    id: "bracket-reveal",
    chapter: "Pre-show",
    label: "Bracket reveal",
    tagline: "Show both brackets side-by-side.",
    scene: "both-brackets",
    bannerText: "🪜 The road so far",
    holdForHost: true,
  },

  // ─── (Sponsor breaks removed — pre-taped season, no parody ads.) ──

  // ─── LOSERS' FINAL ────────────────────────────────────────────────
  {
    id: "losers-intro",
    chapter: "Losers' Final",
    label: "Introduce the Losers' Final",
    tagline: "Play the losers'-bracket-final intro slide.",
    scene: "slide",
    slideId: "IntroLosersFinal",
  },
  {
    id: "losers-meet",
    chapter: "Losers' Final",
    label: "Meet the contenders (Grandpa vs Sam)",
    tagline: "Players card on /watch.",
    scene: "players",
    bannerText: "🥈 LOSERS' BRACKET FINAL · Grandpa vs Sam",
    holdForHost: true,
  },
  {
    id: "losers-start",
    chapter: "Losers' Final",
    label: "Start the Losers' Final round",
    tagline: "Launches the round, /watch flips to Question.",
    scene: "question",
    bannerText: "🥈 LOSERS' BRACKET FINAL",
    roundAction: { kind: "start", slot: "losers" },
  },
  {
    id: "losers-complete",
    chapter: "Losers' Final",
    label: "Complete the Losers' Final",
    tagline: "Marks the round complete + flips /watch to scoreboard.",
    scene: "players",
    bannerText: "🥈 LOSERS' FINAL · Final Score",
    roundAction: { kind: "complete", slot: "losers" },
    holdForHost: true,
  },

  // ─── WINNERS' FINAL ──────────────────────────────────────────────
  {
    id: "winners-intro",
    chapter: "Winners' Final",
    label: "Introduce the Winners' Final",
    tagline: "Play the winners'-bracket-final intro slide.",
    scene: "slide",
    slideId: "IntroWinnersFinal",
  },
  {
    id: "winners-meet",
    chapter: "Winners' Final",
    label: "Meet the contenders (Karen vs Marc)",
    tagline: "Players card on /watch.",
    scene: "players",
    bannerText: "🏆 WINNERS' BRACKET FINAL · Karen vs Marc",
    holdForHost: true,
  },
  {
    id: "winners-start",
    chapter: "Winners' Final",
    label: "Start the Winners' Final round",
    tagline: "Launches the round, /watch flips to Question.",
    scene: "question",
    bannerText: "🏆 WINNERS' BRACKET FINAL",
    roundAction: { kind: "start", slot: "winners" },
  },
  {
    id: "winners-complete",
    chapter: "Winners' Final",
    label: "Complete the Winners' Final",
    tagline: "Marks the round complete + scoreboard.",
    scene: "players",
    bannerText: "🏆 WINNERS' FINAL · Final Score",
    roundAction: { kind: "complete", slot: "winners" },
    holdForHost: true,
  },

  // ─── CHAMPIONSHIP / OUTRO ────────────────────────────────────────
  {
    id: "championship-tease",
    chapter: "Championship",
    label: "Two champions, one crown",
    tagline: "Tease the championship matchup.",
    scene: "slide",
    slideId: "ChampionshipTease",
  },
  {
    id: "champion-ceremony",
    chapter: "Championship",
    label: "🏆 Champion ceremony",
    tagline: "Crown the champion (manually update standings after).",
    scene: "text",
    bannerText: "🏆 THE CHAMPION",
    bodyText: "Drumroll please…",
    holdForHost: true,
  },
  {
    id: "closing-credits",
    chapter: "Wrap",
    label: "Closing credits",
    tagline: "Roll the outro reel + drop the chat link.",
    scene: "slide",
    slideId: "EventOutro",
  },
];

// ────────────────────────────────────────────────────────────────────
// Persistence helpers
// ────────────────────────────────────────────────────────────────────

export async function getCurrentStageIndex(): Promise<number> {
  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, STAGE_INDEX_KEY))
    .limit(1);
  const raw = row?.value ?? "-1";
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : -1;
}

async function setStageIndex(index: number): Promise<void> {
  await db
    .insert(schema.appSettings)
    .values({ key: STAGE_INDEX_KEY, value: String(index) })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: String(index), updatedAt: new Date() },
    });
}

// Apply the scene-side effects + round actions of the given stage.
async function applyStage(stage: EventStage): Promise<void> {
  await setWatchScene({
    primary: stage.scene,
    bannerText: stage.bannerText ?? "",
    bodyText: stage.bodyText ?? "",
    videoUrl: stage.videoUrl ?? "",
    imageUrl: stage.imageUrl ?? "",
    slideId: stage.slideId ?? "",
  });
  if (!stage.roundAction || stage.roundAction.kind === "none") return;
  const { kind, slot } = stage.roundAction;
  if (kind === "start") {
    await launchFinalsRound(slot);
  } else if (kind === "advance") {
    const { getFinalsRoundSummary } = await import("@/lib/finals-rounds");
    const summary = await getFinalsRoundSummary(slot);
    if (summary.roundId) await advanceLiveRound({ roundId: summary.roundId });
  } else if (kind === "complete") {
    const { getFinalsRoundSummary } = await import("@/lib/finals-rounds");
    const summary = await getFinalsRoundSummary(slot);
    if (summary.roundId)
      await completeLiveRound({ roundId: summary.roundId });
  }
}

export async function advanceEventStage(): Promise<number> {
  const cur = await getCurrentStageIndex();
  const next = Math.min(EVENT_STAGES.length - 1, cur + 1);
  if (next === cur) return cur;
  await applyStage(EVENT_STAGES[next]);
  await setStageIndex(next);
  return next;
}

export async function backEventStage(): Promise<number> {
  const cur = await getCurrentStageIndex();
  const next = Math.max(-1, cur - 1);
  if (next === cur) return cur;
  if (next >= 0) await applyStage(EVENT_STAGES[next]);
  await setStageIndex(next);
  return next;
}

export async function jumpToEventStage(index: number): Promise<number> {
  const clamped = Math.max(
    -1,
    Math.min(EVENT_STAGES.length - 1, Math.floor(index))
  );
  if (clamped >= 0) await applyStage(EVENT_STAGES[clamped]);
  await setStageIndex(clamped);
  return clamped;
}

export async function resetEventRunbook(): Promise<void> {
  await setStageIndex(-1);
}
