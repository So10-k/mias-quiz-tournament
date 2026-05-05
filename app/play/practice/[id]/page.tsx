import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Stage } from "@/components/Stage";
import { ChapterRunner } from "@/components/ChapterRunner";
import { ChapterReview } from "@/components/ChapterReview";
import { currentUser } from "@/lib/session";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import {
  getRoundWithQuestions,
  getAttemptWithAnswers,
  getEnrollment,
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";

export const dynamic = "force-dynamic";

export default async function PracticeRoundPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ just?: string }>;
}) {
  const { id } = await params;
  const { just } = await searchParams;

  const user = await currentUser();
  if (!user) redirect("/signin");

  const [round] = await db
    .select()
    .from(schema.rounds)
    .where(and(eq(schema.rounds.id, id), eq(schema.rounds.isPractice, true)))
    .limit(1);
  if (!round) notFound();

  // Tiebreaker access gate — only the two players in the linked matchup
  // (and the host, for previewing) can take it. Everyone else gets a 404
  // so the URL doesn't leak the round's existence.
  if (round.tiebreakerMatchupId && user.role !== "author") {
    const [m] = await db
      .select()
      .from(schema.matchups)
      .where(eq(schema.matchups.id, round.tiebreakerMatchupId))
      .limit(1);
    const allowed =
      !!m &&
      (m.playerAUserId === user.id || m.playerBUserId === user.id);
    if (!allowed) notFound();
  }

  // Pure practice (no tiebreaker link) is gated by elimination status —
  // out of the bracket = spectator, no quizzes (including the warm-ups).
  // Tiebreaker / make-up rounds are exempt: the whole point is letting
  // eliminated players play their way back in.
  if (!round.tiebreakerMatchupId && user.role !== "author") {
    const tournament =
      (await getActiveTournament()) ?? (await getLatestTournament());
    if (tournament) {
      const enrollment = await getEnrollment(user.id, tournament.id);
      if (enrollment?.eliminatedAt) {
        return (
          <Stage>
            <div className="h-[calc(100vh-128px)] flex items-center justify-center px-4">
              <div className="card px-7 py-7 text-center max-w-md">
                <div className="text-6xl">👀</div>
                <h1 className="font-display text-3xl text-navy mt-3">
                  You&rsquo;re in spectator mode.
                </h1>
                <p className="font-body text-base text-navy-soft mt-3">
                  Practice rounds are for active players. You&rsquo;re still
                  welcome to watch the bracket and cheer the others on.
                </p>
                <div className="mt-7 flex items-center justify-center gap-3">
                  <Link href="/bracket" className="pop pop-coral">
                    🏆 Bracket
                  </Link>
                  <Link href="/play" className="pop pop-white">
                    ← Back
                  </Link>
                </div>
              </div>
            </div>
          </Stage>
        );
      }
    }
  }

  const data = await getRoundWithQuestions(round.id);
  if (!data) notFound();

  const myAttempt = await getAttemptWithAnswers(user.id, round.id);
  const submitted = !!myAttempt?.attempt.submittedAt;

  if (round.status === "closed" && !submitted) {
    return (
      <Stage>
        <div className="h-[calc(100vh-128px)] flex items-center justify-center px-4">
          <div className="card px-7 py-7 text-center max-w-md">
            <div className="text-6xl">📕</div>
            <h1 className="font-display text-3xl text-navy mt-3">
              This practice round is closed.
            </h1>
            <Link href="/play" className="pop pop-coral mt-7">
              ← Play
            </Link>
          </div>
        </div>
      </Stage>
    );
  }

  if (submitted) {
    const reveal: "passed" | "struck" | null =
      just === "passed" ? "passed" : just === "struck" ? "struck" : null;
    const reviewQs = data.questions.map((q) => {
      const myAnswer = myAttempt?.answers.find((a) => a.questionId === q.id);
      return {
        id: q.id,
        prompt: q.prompt,
        options: q.options.map((o) => ({
          id: o.id,
          label: o.label,
          isCorrect: o.isCorrect,
        })),
        myOptionId: myAnswer?.optionId ?? null,
        myWasCorrect: !!myAnswer?.isCorrect,
      };
    });
    return (
      <Stage scrollable>
        <ChapterReview
          chapterNumber={round.chapterNumber}
          title={`🎯 ${round.title}`}
          intro={round.introProse}
          questions={reviewQs}
          score={Number(myAttempt?.attempt.score ?? "0")}
          passed={!!myAttempt?.attempt.passed}
          reveal={reveal}
          livesLeft={1}
          strikeLimit={1}
          isPractice
        />
      </Stage>
    );
  }

  const runnerQs = data.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: q.options.map((o) => ({
      id: o.id,
      label: o.label,
      isCorrect: o.isCorrect,
    })),
  }));

  return (
    <Stage scrollable>
      <ChapterRunner
        tournamentId=""
        chapterNumber={round.chapterNumber}
        title={`🎯 ${round.title}`}
        intro={round.introProse ?? "This is a practice round — it doesn't count toward your lives."}
        questions={runnerQs}
        mode="practice"
        roundId={round.id}
      />
    </Stage>
  );
}
