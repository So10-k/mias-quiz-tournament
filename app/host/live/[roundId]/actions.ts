"use server";

// Host-only Server Actions for driving a live round. Every action checks
// `requireUser()` AND that the user is the author (Sam). All actions
// revalidate `/host/live/[roundId]` so the panel re-reads after each
// mutation; players poll separately so they see updates within ~1s.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
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
  if (u.role !== "author") {
    throw new Error("forbidden — host only");
  }
  return u;
}

export async function startAction(formData: FormData) {
  await requireHost();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) throw new Error("missing roundId");
  await startLiveRound({ roundId });
  revalidatePath(`/host/live/${roundId}`);
}

export async function advanceAction(formData: FormData) {
  await requireHost();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) throw new Error("missing roundId");
  await advanceLiveRound({ roundId });
  revalidatePath(`/host/live/${roundId}`);
}

export async function lockAction(formData: FormData) {
  await requireHost();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) throw new Error("missing roundId");
  await lockCurrentLiveQuestion({ roundId });
  revalidatePath(`/host/live/${roundId}`);
}

export async function completeAction(formData: FormData) {
  await requireHost();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) throw new Error("missing roundId");
  await completeLiveRound({ roundId });
  revalidatePath(`/host/live/${roundId}`);
}

export async function resetAction(formData: FormData) {
  await requireHost();
  // Destructive — confirmation gate via a separate field.
  const confirm = String(formData.get("confirm") ?? "");
  if (confirm !== "RESET") {
    throw new Error("reset requires confirm=RESET");
  }
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) throw new Error("missing roundId");
  await resetLiveRound({ roundId });
  revalidatePath(`/host/live/${roundId}`);
}

export async function effectAction(formData: FormData) {
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
  revalidatePath(`/host/live/${roundId}`);
}

export async function clearEffectAction(formData: FormData) {
  await requireHost();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) throw new Error("missing roundId");
  await clearLiveEffect({ roundId });
  revalidatePath(`/host/live/${roundId}`);
}
