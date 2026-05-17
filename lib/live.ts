// Live-round state machine.
//
// A live round is hosted in real time over a webinar: the host advances
// each question for everyone at once, finalists answer in sync, spectators
// watch. State lives on the `rounds` row (isLive, liveStatus,
// liveCurrentQuestionIndex, liveCurrentQuestionStartedAt, …) plus the
// existing attempts/answers tables for actual answer storage.
//
// All transitions go through this module so the rules (who can advance,
// who can answer, when the lock falls) are in one place. Polling clients
// use `getLiveRoundState` for read-only views.

import { db, schema } from "@/db";
import { and, asc, eq } from "drizzle-orm";
import { id as makeId } from "@/lib/ids";

export type LiveStatus = "pre_start" | "running" | "revealing" | "complete";

// Effect identifiers the host can trigger. Each plays a synchronized
// overlay on every connected client. Adding a new effect:
//   1) add the id here
//   2) add the button in /host/live/[roundId]/page.tsx
//   3) render the visual in components/LiveEffectOverlay.tsx
export const LIVE_EFFECTS = [
  "confetti", // emoji rain (🎉 ✨ 🌟)
  "fanfare", // big "NICE!" banner with bounce
  "boom", // red flash + screen shake (use sparingly)
  "fireworks", // 💥 emoji bursts
  "drumroll", // pulsing "🥁 DRUMROLL…"
  "approve", // "MIA APPROVES" stamp
  "tomato", // splat overlay for wrong-answer reveal
  "hearts", // floating ❤️
  "pressure", // ⏰ time-pressure red pulse
  "banner", // custom text — uses liveEffectMessage
] as const;
export type LiveEffect = (typeof LIVE_EFFECTS)[number];

export type LiveEffectFire = {
  // The effect to play. Null = no effect currently armed.
  effect: LiveEffect | null;
  // ISO string of when it was triggered. Clients dedupe on this — only
  // play effects whose timestamp is newer than the last one played.
  at: string | null;
  // Optional text for the 'banner' effect.
  message: string | null;
};

export type LiveOption = {
  id: string;
  order: number;
  label: string;
  // Only populated during 'revealing' / 'complete' for honest reveal.
  isCorrect?: boolean;
};

export type LiveCurrentQuestion = {
  id: string;
  order: number;
  prompt: string;
  options: LiveOption[];
};

export type LiveFinalist = {
  userId: string;
  name: string | null;
  // Their pick on the current question (only revealed once locked, to
  // prevent spectators from copying picks during the answer window).
  currentPickOptionId: string | null;
  // Their full score so far (count of correct answers across the round).
  // Only populated in 'revealing' / 'complete'.
  scoreSoFar?: number;
};

export type LiveRoundView = {
  roundId: string;
  title: string;
  liveStatus: LiveStatus;
  // True when this is a practice live round (no tiebreaker matchup, just
  // for training). Anyone signed-in can answer; scoreboard is whoever
  // shows up. Used by the client to flip UI labels (PARTICIPANT vs
  // FINALIST/SPECTATOR).
  isPracticeMode: boolean;
  totalQuestions: number;
  currentQuestionIndex: number | null;
  currentQuestion: LiveCurrentQuestion | null;
  // Server-computed seconds left for the current question. Clients use
  // this as the source of truth — they tick locally between polls.
  secondsLeft: number;
  // True once secondsLeft hits 0 OR host advanced past it. Once locked,
  // no more answer writes are accepted for this question.
  locked: boolean;
  // The two finalists in tournament mode, or all participants in
  // practice mode (whoever has an attempt for this round).
  finalists: LiveFinalist[];
  // Whether the viewer is allowed to answer. Tournament mode: must be
  // one of the two finalists. Practice mode: any signed-in user.
  isFinalist: boolean;
  // Viewer's pick for the current question, if any.
  mySubmittedOptionId: string | null;
  // Final scoreboard — populated once status is 'revealing' / 'complete'.
  scoreboard: LiveFinalist[] | null;
  // Currently-armed effect (synced from `rounds.liveEffect`). Clients
  // dedupe on `at` so the same trigger only plays once.
  effect: LiveEffectFire;
};

async function getRoundOrNull(roundId: string) {
  const [r] = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.id, roundId))
    .limit(1);
  return r ?? null;
}

async function getFinalistIds(round: typeof schema.rounds.$inferSelect): Promise<string[]> {
  if (!round.tiebreakerMatchupId) return [];
  const [m] = await db
    .select()
    .from(schema.matchups)
    .where(eq(schema.matchups.id, round.tiebreakerMatchupId))
    .limit(1);
  if (!m) return [];
  return [m.playerAUserId, m.playerBUserId].filter(
    (x): x is string => !!x
  );
}

async function getOrCreateAttempt(userId: string, roundId: string) {
  const [existing] = await db
    .select()
    .from(schema.attempts)
    .where(
      and(
        eq(schema.attempts.userId, userId),
        eq(schema.attempts.roundId, roundId)
      )
    )
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(schema.attempts)
    .values({
      id: makeId(),
      userId,
      roundId,
    })
    .returning();
  return created;
}

// ─── reads ───────────────────────────────────────────────────────────

// Finds the most recently-started live round that's still in
// pre_start, running, or revealing. Used by the broadcast pages
// (/live and /watch) to embed the current question without the
// host having to push a roundId into a URL.
export async function getCurrentLiveRound(): Promise<
  typeof schema.rounds.$inferSelect | null
> {
  const rows = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.isLive, true));
  // Prefer running/revealing over pre_start; fall back to most recently
  // started.
  const active = rows.filter((r) =>
    ["pre_start", "running", "revealing"].includes(r.liveStatus)
  );
  if (active.length === 0) return null;
  active.sort((a, b) => {
    const aT = a.liveStartedAt?.getTime() ?? 0;
    const bT = b.liveStartedAt?.getTime() ?? 0;
    return bT - aT;
  });
  return active[0];
}

export async function getLiveRoundState(args: {
  roundId: string;
  viewerUserId: string | null;
}): Promise<LiveRoundView | null> {
  const round = await getRoundOrNull(args.roundId);
  if (!round || !round.isLive) return null;

  const qs = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.roundId, args.roundId))
    .orderBy(asc(schema.questions.order));

  // Practice mode = isPractice + no tiebreaker matchup. Anyone signed-in
  // can answer; "finalists" becomes "everyone who has an attempt".
  const isPracticeMode =
    round.isPractice && !round.tiebreakerMatchupId;

  let finalistIds: string[];
  if (isPracticeMode) {
    // Pull everyone who has an attempt on this round so far. The list
    // grows as participants opt in by submitting their first answer.
    const atts = await db
      .select({ userId: schema.attempts.userId })
      .from(schema.attempts)
      .where(eq(schema.attempts.roundId, args.roundId));
    finalistIds = Array.from(new Set(atts.map((a) => a.userId)));
  } else {
    finalistIds = await getFinalistIds(round);
  }

  // In tournament mode, only the two matchup players can answer.
  // In practice mode, any signed-in user can — they just need to be
  // looking at the page.
  const isFinalist = isPracticeMode
    ? !!args.viewerUserId
    : !!args.viewerUserId && finalistIds.includes(args.viewerUserId);

  // Resolve finalist names.
  const finalists: LiveFinalist[] = [];
  for (const fid of finalistIds) {
    const [u] = await db
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, fid))
      .limit(1);
    finalists.push({
      userId: fid,
      name: u?.name ?? null,
      currentPickOptionId: null,
    });
  }

  const idx = round.liveCurrentQuestionIndex;
  const currentQRow =
    idx != null && idx >= 0 && idx < qs.length ? qs[idx] : null;

  let currentQuestion: LiveCurrentQuestion | null = null;
  let mySubmittedOptionId: string | null = null;

  if (currentQRow) {
    const opts = await db
      .select()
      .from(schema.options)
      .where(eq(schema.options.questionId, currentQRow.id))
      .orderBy(asc(schema.options.order));

    // Compute lock first so we can decide whether to expose `isCorrect`
    // on options.
    const startedAt = round.liveCurrentQuestionStartedAt;
    const seconds = round.liveQuestionSeconds;
    const elapsedMs = startedAt ? Date.now() - startedAt.getTime() : 0;
    const secondsLeftLocal = startedAt
      ? Math.max(0, seconds - Math.floor(elapsedMs / 1000))
      : seconds;
    const lockedLocal =
      round.liveStatus === "revealing" ||
      round.liveStatus === "complete" ||
      secondsLeftLocal <= 0;

    currentQuestion = {
      id: currentQRow.id,
      order: currentQRow.order,
      prompt: currentQRow.prompt,
      options: opts.map((o) => ({
        id: o.id,
        order: o.order,
        label: o.label,
        // Only show correctness once everyone's locked in.
        ...(lockedLocal ? { isCorrect: o.isCorrect } : {}),
      })),
    };

    if (isFinalist && args.viewerUserId) {
      const [att] = await db
        .select()
        .from(schema.attempts)
        .where(
          and(
            eq(schema.attempts.userId, args.viewerUserId),
            eq(schema.attempts.roundId, args.roundId)
          )
        )
        .limit(1);
      if (att) {
        const [ans] = await db
          .select()
          .from(schema.answers)
          .where(
            and(
              eq(schema.answers.attemptId, att.id),
              eq(schema.answers.questionId, currentQRow.id)
            )
          )
          .limit(1);
        if (ans) mySubmittedOptionId = ans.optionId ?? null;
      }
    }

    // For all spectators / finalists: once locked, surface what each
    // finalist picked for the CURRENT question. Before lock, also
    // surface "did they pick anything" (without revealing WHAT) by
    // setting currentPickOptionId to a sentinel "__answered__" — the
    // client uses presence (truthy) to render "✓ LOCKED IN" without
    // exposing which option.
    for (const f of finalists) {
      const [att] = await db
        .select()
        .from(schema.attempts)
        .where(
          and(
            eq(schema.attempts.userId, f.userId),
            eq(schema.attempts.roundId, args.roundId)
          )
        )
        .limit(1);
      if (!att) continue;
      const [ans] = await db
        .select()
        .from(schema.answers)
        .where(
          and(
            eq(schema.answers.attemptId, att.id),
            eq(schema.answers.questionId, currentQRow.id)
          )
        )
        .limit(1);
      if (!ans) continue;
      // Locked → reveal the actual option. Pre-lock → opaque marker so
      // we don't leak which option, but UI can show "answered".
      f.currentPickOptionId = lockedLocal
        ? (ans.optionId ?? null)
        : "__answered__";
    }
  }

  // Always recompute time fields off the row (single source of truth).
  const startedAt = round.liveCurrentQuestionStartedAt;
  const seconds = round.liveQuestionSeconds;
  const elapsedMs = startedAt ? Date.now() - startedAt.getTime() : 0;
  const secondsLeft = startedAt
    ? Math.max(0, seconds - Math.floor(elapsedMs / 1000))
    : seconds;
  const locked =
    round.liveStatus === "revealing" ||
    round.liveStatus === "complete" ||
    !startedAt ||
    secondsLeft <= 0;

  // Score-so-far for the inline transition splash + podiums. Counts
  // ONLY questions that are past (lower order than the current index)
  // OR the current question if it's locked. Never counts the in-flight
  // question — that would let one finalist watch the other's score
  // tick up and infer correctness mid-window. Populated for every
  // finalist regardless of state so the client can render running
  // scores at transition time.
  const lockedNow =
    round.liveStatus === "revealing" ||
    round.liveStatus === "complete" ||
    !round.liveCurrentQuestionStartedAt ||
    (round.liveCurrentQuestionStartedAt &&
      Math.floor(
        (Date.now() - round.liveCurrentQuestionStartedAt.getTime()) / 1000
      ) >= round.liveQuestionSeconds);
  const idxNow = round.liveCurrentQuestionIndex;
  const scorableQuestionIds = new Set<string>();
  for (let i = 0; i < qs.length; i++) {
    if (idxNow == null) continue;
    if (i < idxNow) scorableQuestionIds.add(qs[i].id);
    else if (i === idxNow && lockedNow) scorableQuestionIds.add(qs[i].id);
  }
  if (
    round.liveStatus === "revealing" ||
    round.liveStatus === "complete"
  ) {
    // Once we're past the running window everything counts.
    for (const q of qs) scorableQuestionIds.add(q.id);
  }
  for (const f of finalists) {
    const [att] = await db
      .select()
      .from(schema.attempts)
      .where(
        and(
          eq(schema.attempts.userId, f.userId),
          eq(schema.attempts.roundId, args.roundId)
        )
      )
      .limit(1);
    let score = 0;
    if (att && scorableQuestionIds.size > 0) {
      const ans = await db
        .select()
        .from(schema.answers)
        .where(eq(schema.answers.attemptId, att.id));
      score = ans.filter(
        (a) => scorableQuestionIds.has(a.questionId) && a.isCorrect
      ).length;
    }
    f.scoreSoFar = score;
  }

  // Scoreboard (only the final reveal; mid-round scores live on
  // finalists[].scoreSoFar instead).
  let scoreboard: LiveFinalist[] | null = null;
  if (
    (round.liveStatus === "revealing" || round.liveStatus === "complete") &&
    finalists.length > 0
  ) {
    scoreboard = finalists
      .slice()
      .sort((a, b) => a.userId.localeCompare(b.userId));
  }

  return {
    roundId: round.id,
    title: round.title,
    liveStatus: round.liveStatus as LiveStatus,
    isPracticeMode,
    totalQuestions: qs.length,
    currentQuestionIndex: idx ?? null,
    currentQuestion,
    secondsLeft,
    locked,
    finalists,
    isFinalist,
    mySubmittedOptionId,
    scoreboard,
    effect: {
      effect:
        (LIVE_EFFECTS as readonly string[]).includes(round.liveEffect ?? "")
          ? (round.liveEffect as LiveEffect)
          : null,
      at: round.liveEffectAt ? round.liveEffectAt.toISOString() : null,
      message: round.liveEffectMessage ?? null,
    },
  };
}

// ─── effects ─────────────────────────────────────────────────────────

export async function triggerLiveEffect(args: {
  roundId: string;
  effect: LiveEffect;
  message?: string | null;
}) {
  // Sanity-check the effect id even though TypeScript narrows it —
  // protects against direct API calls bypassing the type system.
  if (!(LIVE_EFFECTS as readonly string[]).includes(args.effect)) {
    throw new Error(`unknown effect: ${args.effect}`);
  }
  await db
    .update(schema.rounds)
    .set({
      liveEffect: args.effect,
      liveEffectAt: new Date(),
      // Trim + cap the message so a giant string can't blow up the
      // banner overlay or push past the column.
      liveEffectMessage: args.message
        ? String(args.message).trim().slice(0, 120) || null
        : null,
    })
    .where(eq(schema.rounds.id, args.roundId));
}

export async function clearLiveEffect(args: { roundId: string }) {
  await db
    .update(schema.rounds)
    .set({
      liveEffect: null,
      liveEffectAt: null,
      liveEffectMessage: null,
    })
    .where(eq(schema.rounds.id, args.roundId));
}

// ─── host transitions ────────────────────────────────────────────────

// Internal: enforce that a round is configured for live mode before any
// transition. Throws on misconfiguration to fail loud — these calls only
// come from the host control panel which is admin-gated.
async function loadLiveRound(roundId: string) {
  const r = await getRoundOrNull(roundId);
  if (!r) throw new Error("round not found");
  if (!r.isLive) throw new Error("round is not in live mode");
  return r;
}

export async function startLiveRound(args: { roundId: string }) {
  const round = await loadLiveRound(args.roundId);
  if (round.liveStatus !== "pre_start") {
    throw new Error(`cannot start: status is ${round.liveStatus}`);
  }
  // Defense-in-depth: wipe any stale attempts on this round before
  // going live. The page-level redirects already block /play/round/[n]
  // and /play/practice/[id] for live rounds, but if any pre-existing
  // attempts somehow landed here (e.g. round was flipped to live AFTER
  // a regular run) we don't want them showing up in the live
  // scoreboard. Cascade FK on attempts deletes their answers too.
  await db
    .delete(schema.attempts)
    .where(eq(schema.attempts.roundId, args.roundId));
  await db
    .update(schema.rounds)
    .set({
      liveStatus: "running",
      liveCurrentQuestionIndex: 0,
      liveCurrentQuestionStartedAt: new Date(),
      liveStartedAt: new Date(),
      status: "active",
      // Fresh round = no leftover effect overlay from a previous run.
      liveEffect: null,
      liveEffectAt: null,
      liveEffectMessage: null,
    })
    .where(eq(schema.rounds.id, args.roundId));
}

export async function advanceLiveRound(args: { roundId: string }) {
  const round = await loadLiveRound(args.roundId);
  if (round.liveStatus !== "running") {
    throw new Error(`cannot advance: status is ${round.liveStatus}`);
  }
  const qs = await db
    .select({ id: schema.questions.id })
    .from(schema.questions)
    .where(eq(schema.questions.roundId, args.roundId))
    .orderBy(asc(schema.questions.order));
  const total = qs.length;
  const cur = round.liveCurrentQuestionIndex ?? 0;
  const next = cur + 1;
  if (next >= total) {
    // Out of questions — flip to revealing state. The host can then
    // walk through the answers visually.
    await db
      .update(schema.rounds)
      .set({
        liveStatus: "revealing",
        liveCurrentQuestionStartedAt: null,
        // Clear any active effect overlay — it shouldn't bleed into
        // the reveal sequence.
        liveEffect: null,
        liveEffectAt: null,
        liveEffectMessage: null,
      })
      .where(eq(schema.rounds.id, args.roundId));
  } else {
    await db
      .update(schema.rounds)
      .set({
        liveCurrentQuestionIndex: next,
        liveCurrentQuestionStartedAt: new Date(),
        // Clear last question's reveal effect so we don't see the old
        // confetti/banner ride on top of the next question.
        liveEffect: null,
        liveEffectAt: null,
        liveEffectMessage: null,
      })
      .where(eq(schema.rounds.id, args.roundId));
  }
}

// Hard-lock the current question without advancing. Used when the host
// wants to stop accepting answers but pause on the question (to discuss
// it on camera before moving on).
export async function lockCurrentLiveQuestion(args: { roundId: string }) {
  const round = await loadLiveRound(args.roundId);
  if (round.liveStatus !== "running") return;
  // Setting liveCurrentQuestionStartedAt to far-past collapses the
  // server-computed `secondsLeft` to 0 immediately.
  await db
    .update(schema.rounds)
    .set({ liveCurrentQuestionStartedAt: new Date(0) })
    .where(eq(schema.rounds.id, args.roundId));
}

export async function completeLiveRound(args: { roundId: string }) {
  const round = await loadLiveRound(args.roundId);
  if (round.liveStatus === "complete") return;
  await db
    .update(schema.rounds)
    .set({
      liveStatus: "complete",
      status: "closed",
    })
    .where(eq(schema.rounds.id, args.roundId));
}

export async function resetLiveRound(args: { roundId: string }) {
  // Wipe attempts + answers for this round and reset live state. Use
  // sparingly — only before going live in front of an audience.
  await db
    .update(schema.rounds)
    .set({
      liveStatus: "pre_start",
      liveCurrentQuestionIndex: null,
      liveCurrentQuestionStartedAt: null,
      liveStartedAt: null,
    })
    .where(eq(schema.rounds.id, args.roundId));
  // Cascade-delete attempts (and their answers via FK cascade).
  await db
    .delete(schema.attempts)
    .where(eq(schema.attempts.roundId, args.roundId));
}

// ─── finalist answer submission ─────────────────────────────────────

export type SubmitLiveAnswerResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function submitLiveAnswer(args: {
  roundId: string;
  userId: string;
  questionId: string;
  optionId: string;
}): Promise<SubmitLiveAnswerResult> {
  const round = await loadLiveRound(args.roundId);
  if (round.liveStatus !== "running") {
    return { ok: false, reason: "round not running" };
  }

  // Finalist gate. Practice rounds (isPractice=true && no tiebreaker)
  // are open to any signed-in user — the auth check happened at the
  // Server Action layer. Tournament-mode live rounds gate to the two
  // matchup players.
  const isPracticeMode = round.isPractice && !round.tiebreakerMatchupId;
  if (!isPracticeMode) {
    const finalistIds = await getFinalistIds(round);
    if (!finalistIds.includes(args.userId)) {
      return { ok: false, reason: "not a finalist" };
    }
  }

  // Question must be the current one. We refuse writes to past or
  // future questions.
  const qs = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.roundId, args.roundId))
    .orderBy(asc(schema.questions.order));
  const idx = round.liveCurrentQuestionIndex ?? -1;
  const current = idx >= 0 && idx < qs.length ? qs[idx] : null;
  if (!current || current.id !== args.questionId) {
    return { ok: false, reason: "wrong question" };
  }

  // Time gate — server-enforced lock.
  const startedAt = round.liveCurrentQuestionStartedAt;
  if (!startedAt) return { ok: false, reason: "no question started" };
  const elapsedSec = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  if (elapsedSec >= round.liveQuestionSeconds) {
    return { ok: false, reason: "time expired" };
  }

  // Validate the option belongs to this question.
  const [opt] = await db
    .select()
    .from(schema.options)
    .where(
      and(
        eq(schema.options.id, args.optionId),
        eq(schema.options.questionId, args.questionId)
      )
    )
    .limit(1);
  if (!opt) return { ok: false, reason: "bad option" };

  // Upsert the answer.
  const att = await getOrCreateAttempt(args.userId, args.roundId);
  const [existing] = await db
    .select()
    .from(schema.answers)
    .where(
      and(
        eq(schema.answers.attemptId, att.id),
        eq(schema.answers.questionId, args.questionId)
      )
    )
    .limit(1);
  if (existing) {
    await db
      .update(schema.answers)
      .set({ optionId: args.optionId, isCorrect: opt.isCorrect })
      .where(eq(schema.answers.id, existing.id));
  } else {
    await db.insert(schema.answers).values({
      id: makeId(),
      attemptId: att.id,
      questionId: args.questionId,
      optionId: args.optionId,
      isCorrect: opt.isCorrect,
    });
  }

  return { ok: true };
}
