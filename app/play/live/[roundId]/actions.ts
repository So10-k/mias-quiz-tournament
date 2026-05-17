"use server";

// Finalist-only Server Action for submitting an answer to the current
// live question. The server enforces all gates (round running, viewer
// is a finalist, question is current, time hasn't expired) inside
// `submitLiveAnswer` so a stale or replayed client request can't sneak
// past the timer.

import { requireUser } from "@/lib/session";
import { submitLiveAnswer } from "@/lib/live";

export async function submitLiveAnswerAction(formData: FormData): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  const user = await requireUser();
  const roundId = String(formData.get("roundId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  const optionId = String(formData.get("optionId") ?? "");
  if (!roundId || !questionId || !optionId) {
    return { ok: false, reason: "missing fields" };
  }
  return submitLiveAnswer({
    roundId,
    userId: user.id,
    questionId,
    optionId,
  });
}
