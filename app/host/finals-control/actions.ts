"use server";

// Server actions backing the comprehensive finals-control panel.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { launchFinalsRound, type FinalsSlot } from "@/lib/finals-rounds";
import { setZohoWebinar } from "@/lib/zoho-webinar";
import { setCohostUserIds } from "@/lib/finals-access";
import {
  setWatchScene,
  type WatchSceneKind,
} from "@/lib/watch-scene";
import {
  advanceEventStage,
  backEventStage,
  jumpToEventStage,
  resetEventRunbook,
} from "@/lib/event-runbook";
import {
  startLiveRound,
  advanceLiveRound,
  lockCurrentLiveQuestion,
  completeLiveRound,
  resetLiveRound,
  triggerLiveEffect,
  clearLiveEffect,
  LIVE_EFFECTS,
  type LiveEffect,
} from "@/lib/live";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") throw new Error("forbidden — host only");
  return u;
}

const SLOTS = new Set<FinalsSlot>([
  "rehearsal",
  "winners",
  "losers",
  "championship",
]);

export async function launchFinalsRoundAction(formData: FormData) {
  await requireHost();
  const slot = String(formData.get("slot") ?? "");
  if (!SLOTS.has(slot as FinalsSlot)) {
    throw new Error(`unknown slot: ${slot}`);
  }
  const { roundId } = await launchFinalsRound(slot as FinalsSlot);
  revalidatePath("/host/finals-control");
  redirect(`/host/finals-control#round-${roundId}`);
}

export async function saveZohoWebinarAction(formData: FormData) {
  await requireHost();
  const joinUrl = String(formData.get("joinUrl") ?? "").trim();
  const embedUrl = String(formData.get("embedUrl") ?? "").trim();
  await setZohoWebinar({ joinUrl, embedUrl });
  revalidatePath("/host/finals-control");
  revalidatePath("/live");
}

export async function saveCohostAction(formData: FormData) {
  await requireHost();
  const raw = String(formData.get("cohostUserIds") ?? "");
  const ids = raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  await setCohostUserIds(ids);
  revalidatePath("/host/finals-control");
  revalidatePath("/live");
}

const SCENE_KINDS = new Set<WatchSceneKind>([
  "question",
  "players",
  "bracket-main",
  "bracket-losers",
  "both-brackets",
  "video",
  "image",
  "slide",
  "text",
  "intermission",
]);

export async function switchSceneAction(formData: FormData) {
  await requireHost();
  const primary = String(formData.get("primary") ?? "");
  if (!SCENE_KINDS.has(primary as WatchSceneKind)) {
    throw new Error(`unknown scene: ${primary}`);
  }
  await setWatchScene({ primary: primary as WatchSceneKind });
  revalidatePath("/host/finals-control");
}

export async function saveSceneContentAction(formData: FormData) {
  await requireHost();
  const patch: Parameters<typeof setWatchScene>[0] = {};
  const bannerText = formData.get("bannerText");
  if (bannerText !== null) patch.bannerText = String(bannerText);
  const bodyText = formData.get("bodyText");
  if (bodyText !== null) patch.bodyText = String(bodyText);
  const videoUrl = formData.get("videoUrl");
  if (videoUrl !== null) patch.videoUrl = String(videoUrl).trim();
  const imageUrl = formData.get("imageUrl");
  if (imageUrl !== null) patch.imageUrl = String(imageUrl).trim();
  const slideId = formData.get("slideId");
  if (slideId !== null) patch.slideId = String(slideId).trim();
  patch.showLowerThird = formData.get("showLowerThird") === "on";
  patch.showQuestionOverlay = formData.get("showQuestionOverlay") === "on";
  await setWatchScene(patch);
  revalidatePath("/host/finals-control");
}

// ─── Event runbook actions ───────────────────────────────────────

export async function advanceStageAction() {
  await requireHost();
  await advanceEventStage();
  revalidatePath("/host/finals-control");
}

export async function backStageAction() {
  await requireHost();
  await backEventStage();
  revalidatePath("/host/finals-control");
}

export async function jumpStageAction(formData: FormData) {
  await requireHost();
  const idx = parseInt(String(formData.get("index") ?? "0"), 10);
  await jumpToEventStage(idx);
  revalidatePath("/host/finals-control");
}

export async function resetRunbookAction(formData: FormData) {
  await requireHost();
  if (String(formData.get("confirm") ?? "") !== "RESET") {
    throw new Error("reset requires confirm=RESET");
  }
  await resetEventRunbook();
  revalidatePath("/host/finals-control");
}

// ─── Inline live-round controls (mirrors host/live/[roundId]/actions) ─

export async function startRoundAction(formData: FormData) {
  await requireHost();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) throw new Error("missing roundId");
  await startLiveRound({ roundId });
  revalidatePath("/host/finals-control");
}

export async function advanceRoundAction(formData: FormData) {
  await requireHost();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) throw new Error("missing roundId");
  await advanceLiveRound({ roundId });
  revalidatePath("/host/finals-control");
}

export async function lockRoundAction(formData: FormData) {
  await requireHost();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) throw new Error("missing roundId");
  await lockCurrentLiveQuestion({ roundId });
  revalidatePath("/host/finals-control");
}

export async function completeRoundAction(formData: FormData) {
  await requireHost();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) throw new Error("missing roundId");
  await completeLiveRound({ roundId });
  revalidatePath("/host/finals-control");
}

export async function resetRoundAction(formData: FormData) {
  await requireHost();
  if (String(formData.get("confirm") ?? "") !== "RESET") {
    throw new Error("reset requires confirm=RESET");
  }
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) throw new Error("missing roundId");
  await resetLiveRound({ roundId });
  revalidatePath("/host/finals-control");
}

export async function triggerEffectAction(formData: FormData) {
  await requireHost();
  const roundId = String(formData.get("roundId") ?? "");
  const effectRaw = String(formData.get("effect") ?? "");
  if (!roundId) throw new Error("missing roundId");
  if (!(LIVE_EFFECTS as readonly string[]).includes(effectRaw)) {
    throw new Error(`unknown effect: ${effectRaw}`);
  }
  const message = String(formData.get("message") ?? "").trim();
  await triggerLiveEffect({
    roundId,
    effect: effectRaw as LiveEffect,
    message: message || null,
  });
  revalidatePath("/host/finals-control");
}

export async function clearEffectInlineAction(formData: FormData) {
  await requireHost();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) throw new Error("missing roundId");
  await clearLiveEffect({ roundId });
  revalidatePath("/host/finals-control");
}
