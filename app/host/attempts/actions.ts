"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") redirect("/play");
}

// Silent score correction. The host flips an answer's `isCorrect` flag,
// and we recompute the attempt's score / passed flag and adjust strikes
// + bracket-resolution accordingly. Nothing is logged, no email is sent;
// the player only sees the change if they revisit the review screen.
export async function correctAnswerAction(formData: FormData) {
  await requireHost();
  const answerId = String(formData.get("answerId") ?? "");
  const setTo = String(formData.get("isCorrect") ?? "") === "true";
  if (!answerId) return;

  const [answer] = await db
    .select()
    .from(schema.answers)
    .where(eq(schema.answers.id, answerId))
    .limit(1);
  if (!answer) return;

  // Flip the answer.
  await db
    .update(schema.answers)
    .set({ isCorrect: setTo })
    .where(eq(schema.answers.id, answerId));

  // Recompute the attempt totals.
  const [attempt] = await db
    .select()
    .from(schema.attempts)
    .where(eq(schema.attempts.id, answer.attemptId))
    .limit(1);
  if (!attempt) return;

  const allAnswers = await db
    .select()
    .from(schema.answers)
    .where(eq(schema.answers.attemptId, attempt.id));
  const total = allAnswers.length;
  const correct = allAnswers.filter((a) => a.isCorrect).length;
  const score = total === 0 ? 0 : correct / total;

  const [round] = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.id, attempt.roundId))
    .limit(1);
  const threshold = Number(round?.passThreshold ?? "0.6");
  const passed = score >= threshold;

  await db
    .update(schema.attempts)
    .set({ score: score.toFixed(2), passed })
    .where(eq(schema.attempts.id, attempt.id));

  // Strike + elimination cascade — only matters for real, non-practice
  // rounds. We add or remove a strike based on the new pass status.
  if (round && !round.isPractice) {
    const [enrollment] = await db
      .select()
      .from(schema.enrollments)
      .where(
        and(
          eq(schema.enrollments.userId, attempt.userId),
          eq(schema.enrollments.tournamentId, round.tournamentId)
        )
      )
      .limit(1);

    if (enrollment) {
      const existingStrikes = await db
        .select()
        .from(schema.strikes)
        .where(
          and(
            eq(schema.strikes.enrollmentId, enrollment.id),
            eq(schema.strikes.roundId, round.id)
          )
        );
      if (passed && existingStrikes.length > 0) {
        // Remove the strike(s) for this round + decrement count.
        await db
          .delete(schema.strikes)
          .where(
            and(
              eq(schema.strikes.enrollmentId, enrollment.id),
              eq(schema.strikes.roundId, round.id)
            )
          );
        await db
          .update(schema.enrollments)
          .set({
            strikeCount: Math.max(
              0,
              enrollment.strikeCount - existingStrikes.length
            ),
            // If they had been eliminated specifically by this round,
            // bring them back.
            ...(enrollment.eliminatedInRoundId === round.id
              ? { eliminatedAt: null, eliminatedInRoundId: null }
              : {}),
          })
          .where(eq(schema.enrollments.id, enrollment.id));
      } else if (!passed && existingStrikes.length === 0) {
        // Add a strike.
        const { id: idGen } = await import("@/lib/ids");
        await db.insert(schema.strikes).values({
          id: idGen(),
          enrollmentId: enrollment.id,
          roundId: round.id,
          reason: "failed_chapter",
        });
        await db
          .update(schema.enrollments)
          .set({ strikeCount: enrollment.strikeCount + 1 })
          .where(eq(schema.enrollments.id, enrollment.id));
      }

      // Re-run elimination + bracket auto-resolve for the round.
      const { processEliminations } = await import("@/lib/engine");
      await processEliminations(round.tournamentId, round.id);
      const { autoResolveByScore } = await import("@/lib/bracket");
      await autoResolveByScore(round.tournamentId, round.chapterNumber);
    }
  }

  revalidatePath("/host/attempts");
  revalidatePath(`/host/attempts/${attempt.id}`);
}
