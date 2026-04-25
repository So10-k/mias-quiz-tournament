// Server-only module. (We removed the literal `import "server-only"`
// because it pulls in a Next-specific shim that doesn't exist in plain Node;
// Next still treats this as server code because every importer is a server
// component or server action.)
import { db, schema } from "@/db";
import {
  and,
  desc,
  eq,
  isNull,
  or,
  sql,
  inArray,
  asc,
} from "drizzle-orm";
import { id as makeId, slug as makeSlug } from "./ids";

const {
  tournaments,
  enrollments,
  rounds,
  questions,
  options,
  attempts,
  answers,
  strikes,
  users,
} = schema;

// ─── tournament lookup ──────────────────────────────────────────────────────

export async function getActiveTournament() {
  const [t] = await db
    .select()
    .from(tournaments)
    .where(
      or(
        eq(tournaments.status, "registration"),
        eq(tournaments.status, "in_progress")
      )
    )
    .orderBy(desc(tournaments.createdAt))
    .limit(1);
  return t ?? null;
}

export async function getLatestTournament() {
  const [t] = await db
    .select()
    .from(tournaments)
    .orderBy(desc(tournaments.createdAt))
    .limit(1);
  return t ?? null;
}

export async function getOrCreateActiveTournament() {
  const existing = await getActiveTournament();
  if (existing) return existing;
  const [created] = await db
    .insert(tournaments)
    .values({
      id: makeId(),
      slug: makeSlug(),
      title: "The Quiz Book",
      subtitle: "A tournament for readers brave and curious.",
      registrationOpen: true,
      status: "registration",
      strikeLimit: 2,
    })
    .returning();
  return created;
}

// ─── chapters & questions ───────────────────────────────────────────────────

export async function getRoundsForTournament(tournamentId: string) {
  return db
    .select()
    .from(rounds)
    .where(eq(rounds.tournamentId, tournamentId))
    .orderBy(asc(rounds.chapterNumber));
}

export async function getRoundWithQuestions(roundId: string) {
  const [round] = await db
    .select()
    .from(rounds)
    .where(eq(rounds.id, roundId))
    .limit(1);
  if (!round) return null;
  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.roundId, roundId))
    .orderBy(asc(questions.order));
  type OptRow = typeof options.$inferSelect;
  type QWithOpts = (typeof questions.$inferSelect) & { options: OptRow[] };
  if (qs.length === 0) {
    return { round, questions: [] as QWithOpts[] };
  }
  const opts: OptRow[] = await db
    .select()
    .from(options)
    .where(
      inArray(
        options.questionId,
        qs.map((q) => q.id)
      )
    )
    .orderBy(asc(options.order));
  const grouped: QWithOpts[] = qs.map((q) => ({
    ...q,
    options: opts.filter((o) => o.questionId === q.id),
  }));
  return { round, questions: grouped };
}

// ─── enrollment ─────────────────────────────────────────────────────────────

export async function getEnrollment(userId: string, tournamentId: string) {
  const [e] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, userId),
        eq(enrollments.tournamentId, tournamentId)
      )
    )
    .limit(1);
  return e ?? null;
}

export async function enroll(userId: string, tournamentId: string) {
  const existing = await getEnrollment(userId, tournamentId);
  if (existing) return existing;
  const [created] = await db
    .insert(enrollments)
    .values({
      id: makeId(),
      userId,
      tournamentId,
    })
    .returning();
  return created;
}

export async function getCast(tournamentId: string) {
  const rows = await db
    .select({
      enrollment: enrollments,
      user: users,
    })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .where(eq(enrollments.tournamentId, tournamentId))
    .orderBy(asc(enrollments.registeredAt));
  return rows;
}

// ─── attempts ───────────────────────────────────────────────────────────────

export async function getAttempt(userId: string, roundId: string) {
  const [a] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.roundId, roundId)))
    .limit(1);
  return a ?? null;
}

export async function getAttemptWithAnswers(userId: string, roundId: string) {
  const a = await getAttempt(userId, roundId);
  if (!a) return null;
  const ans = await db
    .select()
    .from(answers)
    .where(eq(answers.attemptId, a.id));
  return { attempt: a, answers: ans };
}

type SubmitInput = {
  userId: string;
  roundId: string;
  // Map of questionId -> optionId
  picks: Record<string, string>;
};

export async function submitAttempt({ userId, roundId, picks }: SubmitInput) {
  const round = await getRoundWithQuestions(roundId);
  if (!round) throw new Error("Round not found");
  if (round.round.status !== "active") {
    throw new Error("This round is not open.");
  }

  // Idempotent: if an attempt exists, return it.
  const existing = await getAttempt(userId, roundId);
  if (existing && existing.submittedAt) {
    return existing;
  }

  const isPractice = round.round.isPractice === true;

  // For real rounds we require enrollment and not-eliminated. Practice
  // rounds skip both — anyone signed in can take them.
  let enrollment = await getEnrollment(userId, round.round.tournamentId);
  if (!isPractice) {
    if (!enrollment) throw new Error("Not enrolled in this tournament.");
    if (enrollment.eliminatedAt) {
      throw new Error("This player has been eliminated.");
    }
  }

  let total = 0;
  let correct = 0;
  const answerInserts: (typeof answers.$inferInsert)[] = [];

  for (const q of round.questions) {
    total += 1;
    const pickedOptionId = picks[q.id];
    const picked = q.options.find((o) => o.id === pickedOptionId);
    const wasCorrect = !!picked && !!picked.isCorrect;
    if (wasCorrect) correct += 1;
    answerInserts.push({
      id: makeId(),
      attemptId: "", // filled below
      questionId: q.id,
      optionId: picked?.id ?? null,
      isCorrect: wasCorrect,
    });
  }

  const score = total === 0 ? 0 : correct / total;
  const threshold = Number(round.round.passThreshold);
  const passed = score >= threshold;

  const attemptId = existing?.id ?? makeId();
  if (!existing) {
    await db.insert(attempts).values({
      id: attemptId,
      userId,
      roundId,
      submittedAt: new Date(),
      score: score.toFixed(2),
      passed,
    });
  } else {
    await db
      .update(attempts)
      .set({
        submittedAt: new Date(),
        score: score.toFixed(2),
        passed,
      })
      .where(eq(attempts.id, attemptId));
  }

  await db
    .insert(answers)
    .values(answerInserts.map((a) => ({ ...a, attemptId })))
    .onConflictDoNothing();

  // Strike + elimination logic — REAL rounds only. Practice attempts are
  // recorded for the player's own review but never give strikes, never
  // eliminate, and never feed the bracket.
  let nowEliminated = false;
  if (!isPractice && !passed && enrollment) {
    await db.insert(strikes).values({
      id: makeId(),
      enrollmentId: enrollment.id,
      roundId,
      reason: "failed_chapter",
    });
    await db
      .update(enrollments)
      .set({ strikeCount: sql`${enrollments.strikeCount} + 1` })
      .where(eq(enrollments.id, enrollment.id));

    // Mark eliminated if at-or-over the strike limit. Tournament does NOT
    // auto-end — the host decides when the tournament is over.
    await processEliminations(round.round.tournamentId, roundId);
    const updated = await getEnrollment(userId, round.round.tournamentId);
    nowEliminated = !!updated?.eliminatedAt;
  }

  return { id: attemptId, score, passed, eliminated: nowEliminated, isPractice };
}

// ─── close round + eliminations ─────────────────────────────────────────────

// Strikes every enrolled, non-eliminated reader who didn't submit;
// strikes failed submissions whose strike wasn't recorded yet (idempotent),
// then runs the elimination cascade.
export async function closeRound(roundId: string) {
  const [round] = await db
    .select()
    .from(rounds)
    .where(eq(rounds.id, roundId))
    .limit(1);
  if (!round) throw new Error("Round not found");
  if (round.status === "closed") return;
  // Practice rounds aren't part of the tournament loop — closing them just
  // flips the status without strikes or eliminations.
  if (round.isPractice) {
    await db
      .update(rounds)
      .set({ status: "closed" })
      .where(eq(rounds.id, roundId));
    return;
  }

  // Active enrollments for the tournament.
  const active = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.tournamentId, round.tournamentId),
        isNull(enrollments.eliminatedAt)
      )
    );

  for (const e of active) {
    const att = await getAttempt(e.userId, roundId);
    const hasStrikeForThisRound =
      (
        await db
          .select({ id: strikes.id })
          .from(strikes)
          .where(
            and(
              eq(strikes.enrollmentId, e.id),
              eq(strikes.roundId, roundId)
            )
          )
          .limit(1)
      ).length > 0;

    if (!att || !att.submittedAt) {
      // Did not submit. Auto-attempt with score 0 + strike (idempotent).
      if (!att) {
        await db.insert(attempts).values({
          id: makeId(),
          userId: e.userId,
          roundId,
          submittedAt: new Date(),
          score: "0.00",
          passed: false,
        });
      } else {
        await db
          .update(attempts)
          .set({
            submittedAt: new Date(),
            score: "0.00",
            passed: false,
          })
          .where(eq(attempts.id, att.id));
      }
      if (!hasStrikeForThisRound) {
        await db.insert(strikes).values({
          id: makeId(),
          enrollmentId: e.id,
          roundId,
          reason: "did_not_submit",
        });
        await db
          .update(enrollments)
          .set({ strikeCount: sql`${enrollments.strikeCount} + 1` })
          .where(eq(enrollments.id, e.id));
      }
    }
    // If the attempt exists and is failed but the strike wasn't recorded
    // (e.g., legacy data), submitAttempt has already handled it. No-op.
  }

  await db
    .update(rounds)
    .set({ status: "closed" })
    .where(eq(rounds.id, roundId));

  await processEliminations(round.tournamentId, roundId);

  // If a bracket exists, auto-resolve this round's matchups by score.
  const { autoResolveByScore } = await import("./bracket");
  await autoResolveByScore(round.tournamentId, round.chapterNumber);
}

// Marks players who reached the strike limit as eliminated. Does NOT
// auto-end the tournament — the host decides that with endTournament.
export async function processEliminations(
  tournamentId: string,
  forRoundId?: string
) {
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) return;
  const limit = tournament.strikeLimit;

  const overLimit = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.tournamentId, tournamentId),
        isNull(enrollments.eliminatedAt),
        sql`${enrollments.strikeCount} >= ${limit}`
      )
    );
  for (const e of overLimit) {
    await db
      .update(enrollments)
      .set({
        eliminatedAt: new Date(),
        eliminatedInRoundId: forRoundId ?? null,
      })
      .where(eq(enrollments.id, e.id));
  }
}

// ─── advancement ────────────────────────────────────────────────────────────

// Close the current round. Does NOT auto-open a next round and does NOT
// auto-end the tournament. Mia adds rounds one at a time (one per week)
// and chooses when to start the next one.
export async function closeCurrentRound(tournamentId: string) {
  const all = await db
    .select()
    .from(rounds)
    .where(eq(rounds.tournamentId, tournamentId))
    .orderBy(asc(rounds.chapterNumber));
  // Only the real (non-practice) active round counts for this control.
  const active = all.find((r) => r.status === "active" && !r.isPractice);
  if (active) {
    await closeRound(active.id);
  }
}

// Promote the next-in-line REAL draft round to active. Idempotent.
// Practice rounds are skipped here — they live outside the tournament loop.
export async function startNextRound(tournamentId: string) {
  const all = await db
    .select()
    .from(rounds)
    .where(eq(rounds.tournamentId, tournamentId))
    .orderBy(asc(rounds.chapterNumber));
  if (all.some((r) => r.status === "active" && !r.isPractice)) return; // one at a time
  const next = all.find((r) => r.status === "draft" && !r.isPractice);
  if (!next) {
    throw new Error("No round drafted yet. Write one first.");
  }
  await db
    .update(rounds)
    .set({ status: "active", opensAt: new Date() })
    .where(eq(rounds.id, next.id));
  // Make sure the tournament is in 'in_progress' if registration was open.
  const [t] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (t && t.status !== "in_progress") {
    await db
      .update(tournaments)
      .set({
        status: "in_progress",
        registrationOpen: false,
        startedAt: t.startedAt ?? new Date(),
      })
      .where(eq(tournaments.id, tournamentId));
  }
}

// Mia explicitly ends the tournament. She must pick a winner from the
// players who are still standing (or any player — to recover from mistakes).
export async function endTournament(
  tournamentId: string,
  winnerUserId: string | null
) {
  // Close any still-active round so its scores get recorded as the round's
  // final state.
  await closeCurrentRound(tournamentId);
  await db
    .update(tournaments)
    .set({
      status: "complete",
      endedAt: new Date(),
      winnerUserId,
    })
    .where(eq(tournaments.id, tournamentId));
}

// Undo an "end". Sets status back to in_progress, clears endedAt and the
// chosen winner. Mistakes happen.
export async function reopenTournament(tournamentId: string) {
  await db
    .update(tournaments)
    .set({
      status: "in_progress",
      endedAt: null,
      winnerUserId: null,
    })
    .where(eq(tournaments.id, tournamentId));
}

// Bring an eliminated player back into the game. Optionally reset their
// strike count to a specific number (defaults to 0 — full restore).
export async function restoreReader(
  enrollmentId: string,
  strikeCount: number = 0
) {
  await db
    .update(enrollments)
    .set({
      eliminatedAt: null,
      eliminatedInRoundId: null,
      strikeCount: Math.max(0, strikeCount),
    })
    .where(eq(enrollments.id, enrollmentId));
}

// Adjust a player's strike count by delta. If they fall below the limit,
// they come back. If they reach the limit, they're eliminated.
export async function adjustStrike(
  enrollmentId: string,
  delta: number
) {
  const [e] = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);
  if (!e) return;
  const next = Math.max(0, e.strikeCount + delta);
  await db
    .update(enrollments)
    .set({
      strikeCount: next,
      // If we lowered them below the limit, they're back in the game.
      ...(delta < 0
        ? { eliminatedAt: null, eliminatedInRoundId: null }
        : {}),
    })
    .where(eq(enrollments.id, enrollmentId));
  // Re-check eliminations for the tournament so a strike that pushes someone
  // over the limit eliminates them.
  if (delta > 0) {
    await processEliminations(e.tournamentId);
  }
}

export async function setRegistrationOpen(
  tournamentId: string,
  open: boolean
) {
  await db
    .update(tournaments)
    .set({ registrationOpen: open })
    .where(eq(tournaments.id, tournamentId));
}

export async function setSubtitle(tournamentId: string, subtitle: string) {
  await db
    .update(tournaments)
    .set({ subtitle })
    .where(eq(tournaments.id, tournamentId));
}

// ─── chapter authoring ──────────────────────────────────────────────────────

type CreateRoundInput = {
  tournamentId: string;
  title: string;
  introProse?: string;
  passThreshold?: number;
  closesAt?: Date | null;
  isPractice?: boolean;
  questions: Array<{
    prompt: string;
    questionType: "multiple_choice" | "true_false";
    options: Array<{ label: string; isCorrect: boolean }>;
  }>;
};

export async function createRound(input: CreateRoundInput) {
  const isPractice = !!input.isPractice;
  // chapterNumber counters are SEPARATE for practice and real rounds, so
  // bracket round-index mapping (which uses chapterNumber on real rounds)
  // doesn't collide with practice numbering.
  const sameKind = await db
    .select()
    .from(rounds)
    .where(
      and(
        eq(rounds.tournamentId, input.tournamentId),
        eq(rounds.isPractice, isPractice)
      )
    );
  const nextNumber =
    sameKind.length === 0
      ? 1
      : Math.max(...sameKind.map((r) => r.chapterNumber)) + 1;

  const roundId = makeId();
  await db.insert(rounds).values({
    id: roundId,
    tournamentId: input.tournamentId,
    chapterNumber: nextNumber,
    title: input.title,
    introProse: input.introProse ?? null,
    passThreshold: (input.passThreshold ?? 0.6).toFixed(2),
    // Practice rounds open immediately; real rounds wait for the host to
    // press "Start Round N".
    status: isPractice ? "active" : "draft",
    isPractice,
    opensAt: isPractice ? new Date() : null,
    closesAt: input.closesAt ?? null,
  });

  for (let qi = 0; qi < input.questions.length; qi++) {
    const q = input.questions[qi];
    const qid = makeId();
    await db.insert(questions).values({
      id: qid,
      roundId,
      order: qi + 1,
      prompt: q.prompt,
      questionType: q.questionType,
      points: 1,
    });
    for (let oi = 0; oi < q.options.length; oi++) {
      const o = q.options[oi];
      await db.insert(options).values({
        id: makeId(),
        questionId: qid,
        order: oi + 1,
        label: o.label,
        isCorrect: !!o.isCorrect,
      });
    }
  }

  return { roundId, chapterNumber: nextNumber };
}

export async function publishRound(roundId: string) {
  // Drafts stay draft; only the active round is "published" in our model.
  // For now this is a no-op: drafts auto-become active when 'turnThePage'
  // is called. The Author's Desk button "Publish chapter" therefore really
  // just means "save this draft so it can be advanced to active later."
  // We keep this as an explicit hook for future behaviour (e.g., scheduled
  // opens_at).
  return { roundId };
}

// ─── reader removal ─────────────────────────────────────────────────────────

export async function removeReader(enrollmentId: string) {
  await db.delete(enrollments).where(eq(enrollments.id, enrollmentId));
}

// ─── helpers ────────────────────────────────────────────────────────────────

export const chapterWord = (n: number) => {
  const words = [
    "ZERO",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
  ];
  return words[n] ?? String(n);
};
