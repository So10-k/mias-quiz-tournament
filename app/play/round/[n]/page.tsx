import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Stage } from "@/components/Stage";
import { ChapterRunner } from "@/components/ChapterRunner";
import { ChapterReview } from "@/components/ChapterReview";
import { currentUser } from "@/lib/session";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import {
  getActiveTournament,
  getLatestTournament,
  getRoundWithQuestions,
  getEnrollment,
  getAttemptWithAnswers,
} from "@/lib/engine";

export const dynamic = "force-dynamic";

export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ n: string }>;
  searchParams: Promise<{ just?: string }>;
}) {
  const { n } = await params;
  const { just } = await searchParams;
  const chapterNumber = Number(n);
  if (!Number.isFinite(chapterNumber)) notFound();

  const user = await currentUser();
  if (!user) redirect("/signin");

  const tournament =
    (await getActiveTournament()) ?? (await getLatestTournament());
  if (!tournament) redirect("/play");

  const [round] = await db
    .select()
    .from(schema.rounds)
    .where(
      and(
        eq(schema.rounds.tournamentId, tournament.id),
        eq(schema.rounds.chapterNumber, chapterNumber),
        eq(schema.rounds.isPractice, false)
      )
    )
    .limit(1);
  if (!round) notFound();

  const data = await getRoundWithQuestions(round.id);
  if (!data) notFound();

  const enrollment = await getEnrollment(user.id, tournament.id);
  const myAttempt = await getAttemptWithAnswers(user.id, round.id);
  const submitted = !!myAttempt?.attempt.submittedAt;

  // Locked: not active OR already submitted OR eliminated.
  const showReview = submitted;
  const livesLeft = (tournament.strikeLimit ?? 2) - (enrollment?.strikeCount ?? 0);

  if (round.status !== "active" && !submitted) {
    return (
      <Stage>
        <div className="h-[calc(100vh-128px)] flex items-center justify-center px-4">
          <div className="card px-7 py-7 text-center max-w-md">
            <div className="text-6xl">🔒</div>
            <h1 className="font-display text-3xl text-navy mt-3">
              This round isn&rsquo;t open right now.
            </h1>
            <p className="font-body text-lg text-navy-soft mt-3">
              Head back to see what is.
            </p>
            <Link href="/play" className="pop pop-coral mt-7">
              ← Play
            </Link>
          </div>
        </div>
      </Stage>
    );
  }

  if (enrollment?.eliminatedAt && !submitted) {
    return (
      <Stage>
        <div className="h-[calc(100vh-128px)] flex items-center justify-center px-4">
          <div className="card px-7 py-7 text-center max-w-md">
            <div className="text-6xl">💔</div>
            <h1 className="font-display text-3xl text-navy mt-3">
              You&rsquo;re out of the game!
            </h1>
            <p className="font-body text-lg text-navy-soft mt-3">
              You can still watch the others. Cheer them on!
            </p>
            <div className="mt-7 flex items-center justify-center gap-3">
              <Link href="/players" className="pop pop-yellow">
                See the players →
              </Link>
              <Link href="/play" className="pop pop-coral">
                ← Play
              </Link>
            </div>
          </div>
        </div>
      </Stage>
    );
  }

  if (showReview) {
    const reveal: "passed" | "struck" | "eliminated" | null =
      just === "passed"
        ? "passed"
        : just === "struck"
        ? "struck"
        : just === "eliminated"
        ? "eliminated"
        : null;
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
          title={round.title}
          intro={round.introProse}
          questions={reviewQs}
          score={Number(myAttempt?.attempt.score ?? "0")}
          passed={!!myAttempt?.attempt.passed}
          reveal={reveal}
          livesLeft={Math.max(0, livesLeft)}
          strikeLimit={tournament.strikeLimit}
        />
      </Stage>
    );
  }

  // Active, not yet submitted — show runner.
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
        tournamentId={tournament.id}
        chapterNumber={round.chapterNumber}
        title={round.title}
        intro={round.introProse}
        questions={runnerQs}
      />
    </Stage>
  );
}
