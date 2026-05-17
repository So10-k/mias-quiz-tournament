"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { submitAttempt } from "@/lib/engine";

export async function submitChapter(formData: FormData) {
  const user = await requireUser();
  const chapterNumber = Number(formData.get("chapter"));
  const tournamentId = String(formData.get("tournamentId"));
  if (!tournamentId || !Number.isFinite(chapterNumber)) {
    redirect("/play");
  }

  const [round] = await db
    .select()
    .from(schema.rounds)
    .where(
      and(
        eq(schema.rounds.tournamentId, tournamentId),
        eq(schema.rounds.chapterNumber, chapterNumber)
      )
    )
    .limit(1);
  if (!round) redirect("/play");

  // Refuse to write to a live round via the regular submit path. The
  // live mode owns its own server-enforced timer + finalist gate; if
  // submitChapter went through, a player could front-load their answer
  // key before "Start Round" ever fires.
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
  })) as { passed?: boolean; eliminated?: boolean };

  const tag = result.eliminated
    ? "eliminated"
    : result.passed
    ? "passed"
    : "struck";

  revalidatePath(`/play/round/${chapterNumber}`);
  redirect(`/play/round/${chapterNumber}?just=${tag}`);
}
