"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { submitAttempt } from "@/lib/engine";

export async function submitPractice(formData: FormData) {
  const user = await requireUser();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) redirect("/play");

  const [round] = await db
    .select()
    .from(schema.rounds)
    .where(
      and(eq(schema.rounds.id, roundId), eq(schema.rounds.isPractice, true))
    )
    .limit(1);
  if (!round) redirect("/play");

  // Refuse direct writes to a live practice round; live mode owns its
  // own timer + per-question lock.
  if (round.isLive) {
    redirect(`/play/live/${round.id}`);
  }

  const picks: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("q:")) {
      picks[k.slice(2)] = String(v);
    }
  }

  const result = (await submitAttempt({
    userId: user.id,
    roundId: round.id,
    picks,
  })) as { passed?: boolean };

  const tag = result.passed ? "passed" : "struck";
  revalidatePath(`/play/practice/${round.id}`);
  redirect(`/play/practice/${round.id}?just=${tag}`);
}
