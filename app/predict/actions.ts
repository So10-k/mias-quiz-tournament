"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  getPredictionsSettings,
  upsertPrediction,
} from "@/lib/predictions";

// Throws on failure so the client can react. Earlier this returned silently
// on bad input, which combined with optimistic UI meant picks would appear
// saved client-side but never persist — the bug we just hunted down.
export async function submitPredictionAction(
  formData: FormData
): Promise<{ ok: true }> {
  const me = await requireUser();
  const settings = await getPredictionsSettings();
  if (!settings.enabled && me.role !== "author") {
    redirect("/play");
  }
  const matchupId = String(formData.get("matchupId") ?? "");
  const predictedWinnerUserId = String(
    formData.get("predictedWinnerUserId") ?? ""
  );
  if (!matchupId || !predictedWinnerUserId) {
    throw new Error("missing matchupId or predictedWinnerUserId");
  }
  const result = await upsertPrediction({
    userId: me.id,
    matchupId,
    predictedWinnerUserId,
  });
  if (!result.ok) {
    throw new Error(result.reason ?? "prediction save failed");
  }
  revalidatePath("/predict");
  revalidatePath("/predict/leaderboard");
  return { ok: true };
}
