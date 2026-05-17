"use server";

// Host actions for the live-rounds index. Currently just one — create a
// new practice live round, with questions auto-pulled from the question
// library so Sam doesn't have to author content for a rehearsal.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { id as makeId } from "@/lib/ids";
import { requireUser } from "@/lib/session";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") throw new Error("forbidden — host only");
  return u;
}

export async function createPracticeLiveRoundAction(formData: FormData) {
  await requireHost();
  const title = String(formData.get("title") ?? "Practice Live Round").trim();
  const questionCountRaw = Number(formData.get("questionCount") ?? "10");
  const questionCount = Math.max(
    1,
    Math.min(20, Math.floor(questionCountRaw) || 10)
  );
  const seconds = Math.max(
    10,
    Math.min(120, Math.floor(Number(formData.get("seconds") ?? "30")) || 30)
  );

  const tournament =
    (await getActiveTournament()) ?? (await getLatestTournament());
  if (!tournament) throw new Error("no tournament — create one first");

  // Pull random library questions. We use ORDER BY RANDOM() because the
  // library is small (a few hundred rows tops); for larger libraries
  // we'd want a tablesample or precomputed shuffle key.
  const libRows = await db
    .select()
    .from(schema.libraryQuestions)
    .orderBy(sql`random()`)
    .limit(questionCount);
  if (libRows.length === 0) {
    throw new Error("library is empty — seed it first");
  }

  // Compute a chapterNumber that won't collide with existing rounds in
  // this tournament. We just take max+1; live practice rounds end up
  // higher than real rounds and are filtered from the public listing
  // anyway since they're isPractice=true.
  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${schema.rounds.chapterNumber}), 0)` })
    .from(schema.rounds)
    .where(sql`${schema.rounds.tournamentId} = ${tournament.id}`);
  const nextChapter = (maxRow?.max ?? 0) + 1;

  const roundId = makeId();
  await db.insert(schema.rounds).values({
    id: roundId,
    tournamentId: tournament.id,
    chapterNumber: nextChapter,
    title: title || "Practice Live Round",
    isPractice: true,
    isLive: true,
    liveStatus: "pre_start",
    liveQuestionSeconds: seconds,
    status: "draft",
  });

  // Insert the picked questions + options.
  for (let qi = 0; qi < libRows.length; qi++) {
    const lib = libRows[qi];
    const qid = makeId();
    await db.insert(schema.questions).values({
      id: qid,
      roundId,
      order: qi,
      prompt: lib.prompt,
      questionType: "multiple_choice",
      points: 1,
    });
    const opts = lib.options ?? [];
    for (let oi = 0; oi < opts.length; oi++) {
      await db.insert(schema.options).values({
        id: makeId(),
        questionId: qid,
        order: oi,
        label: opts[oi].label,
        isCorrect: opts[oi].isCorrect,
      });
    }
  }

  revalidatePath("/host/live");
  redirect(`/host/live/${roundId}`);
}

export async function deleteLiveRoundAction(formData: FormData) {
  await requireHost();
  const roundId = String(formData.get("roundId") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!roundId) throw new Error("missing roundId");
  if (confirm !== "DELETE") {
    throw new Error("delete requires confirm=DELETE");
  }
  // Only allow deleting practice live rounds — real rounds shouldn't
  // be wiped from this UI.
  const [round] = await db
    .select()
    .from(schema.rounds)
    .where(sql`${schema.rounds.id} = ${roundId}`)
    .limit(1);
  if (!round) throw new Error("round not found");
  if (!round.isPractice || !round.isLive) {
    throw new Error("can only delete practice live rounds from this page");
  }
  await db
    .delete(schema.rounds)
    .where(sql`${schema.rounds.id} = ${roundId}`);
  revalidatePath("/host/live");
}
