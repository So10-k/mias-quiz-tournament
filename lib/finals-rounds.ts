// Helpers for the three big "launch" buttons on /host/finals-control:
//   - Rehearsal           (practice mode, anyone signed-in can answer)
//   - Losers Final        (tied to losers-bracket final matchup)
//   - Winners Final       (tied to winners-bracket final matchup)
//
// Each "slot" remembers its round id in app_settings so the launch button
// is idempotent: clicking it again finds the existing round and starts it
// (or just opens the control panel if it's already running).
//
// The actual question content is auto-populated from libraryQuestions if
// the round is being created fresh. That way Sam doesn't have to author
// questions before clicking "Launch" — but he CAN still edit them after
// via the question editor.

import { db, schema } from "@/db";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { id as makeId } from "@/lib/ids";
import { getActiveTournament, getLatestTournament } from "@/lib/engine";
import { startLiveRound } from "@/lib/live";
import {
  getWinnersFinalMatchupId,
  getLosersFinalMatchupId,
} from "@/lib/finals-access";

// Get-or-create the championship matchup. It pits the WB final
// winner against the LB final winner — only valid AFTER both finals
// have a winnerUserId set. The matchup is persisted as a row in
// `matchups` with bracket='main' and a roundIndex one above the
// existing main bracket max, so it lives natively in the bracket
// graph (and getFinalistIds() in lib/live.ts treats it like any
// other final).
export async function getOrCreateChampionshipMatchupId(
  tournamentId: string
): Promise<string> {
  // 1) See if a championship matchup already exists for this
  //    tournament. We detect it via its known shape: bracket='main',
  //    deepest roundIndex, and BOTH player slots being set from the
  //    finals winners.
  const allMain = await db
    .select()
    .from(schema.matchups)
    .where(
      and(
        eq(schema.matchups.tournamentId, tournamentId),
        eq(schema.matchups.bracket, "main")
      )
    );
  const wbFinalId = await getWinnersFinalMatchupId();
  const lbFinalId = await getLosersFinalMatchupId();
  if (!wbFinalId || !lbFinalId) {
    throw new Error(
      "Both bracket finals must exist before the championship round can be staged."
    );
  }
  const wbFinal = allMain.find((m) => m.id === wbFinalId);
  const lbFinal = (
    await db
      .select()
      .from(schema.matchups)
      .where(eq(schema.matchups.id, lbFinalId))
      .limit(1)
  )[0];
  if (!wbFinal?.winnerUserId || !lbFinal?.winnerUserId) {
    throw new Error(
      "Championship round can't start until both bracket finals have a winner. Resolve them first from /host."
    );
  }
  const wbWinner = wbFinal.winnerUserId;
  const lbWinner = lbFinal.winnerUserId;

  // Look for an existing championship row pointing at these two
  // players above the current bracket depth.
  const wbMax = allMain.reduce(
    (acc, m) => (m.roundIndex > acc ? m.roundIndex : acc),
    0
  );
  const existing = allMain.find(
    (m) =>
      m.roundIndex === wbMax + 1 &&
      ((m.playerAUserId === wbWinner && m.playerBUserId === lbWinner) ||
        (m.playerAUserId === lbWinner && m.playerBUserId === wbWinner))
  );
  if (existing) return existing.id;

  // 2) Otherwise, create a fresh championship matchup at
  //    roundIndex = wbMax + 1. Slot 0 because there's only one.
  const newId = makeId();
  await db.insert(schema.matchups).values({
    id: newId,
    tournamentId,
    bracket: "main",
    roundIndex: wbMax + 1,
    slot: 0,
    playerAUserId: wbWinner,
    playerBUserId: lbWinner,
  });
  return newId;
}

export type FinalsSlot =
  | "rehearsal"
  | "winners"
  | "losers"
  | "championship";

const SETTING_KEY: Record<FinalsSlot, string> = {
  rehearsal: "finals_round_id_rehearsal",
  winners: "finals_round_id_winners",
  losers: "finals_round_id_losers",
  championship: "finals_round_id_championship",
};

const DEFAULTS: Record<
  FinalsSlot,
  { title: string; questionCount: number; seconds: number; isPractice: boolean }
> = {
  rehearsal: {
    title: "Finals Rehearsal",
    questionCount: 10,
    seconds: 30,
    isPractice: true,
  },
  winners: {
    title: "🏆 Winners' Bracket Final — Karen vs Marc",
    questionCount: 15,
    seconds: 30,
    isPractice: false,
  },
  losers: {
    title: "🥈 Losers' Bracket Final — Grandpa vs Sam",
    questionCount: 15,
    seconds: 30,
    isPractice: false,
  },
  championship: {
    title: "👑 Championship Round",
    // The crown match — first to 8. Shorter Q count, tighter timer.
    questionCount: 15,
    seconds: 25,
    isPractice: false,
  },
};

export type FinalsRoundSummary = {
  slot: FinalsSlot;
  title: string;
  roundId: string | null;
  // null when the matchup hasn't been set up yet (only relevant for
  // winners/losers — rehearsal doesn't need a matchup).
  matchupId: string | null;
  // Mirrors rounds.liveStatus, plus 'not_created' when there's no round.
  status: "not_created" | "pre_start" | "running" | "revealing" | "complete";
  totalQuestions: number;
  currentQuestionIndex: number | null;
  isLive: boolean;
};

async function readRoundIdSetting(slot: FinalsSlot): Promise<string | null> {
  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, SETTING_KEY[slot]))
    .limit(1);
  return row?.value || null;
}

async function writeRoundIdSetting(slot: FinalsSlot, roundId: string) {
  await db
    .insert(schema.appSettings)
    .values({ key: SETTING_KEY[slot], value: roundId })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: roundId, updatedAt: new Date() },
    });
}

export async function getFinalsRoundSummary(
  slot: FinalsSlot
): Promise<FinalsRoundSummary> {
  const matchupId =
    slot === "winners"
      ? await getWinnersFinalMatchupId()
      : slot === "losers"
        ? await getLosersFinalMatchupId()
        : null;

  const cachedRoundId = await readRoundIdSetting(slot);
  let round: typeof schema.rounds.$inferSelect | null = null;
  if (cachedRoundId) {
    const [r] = await db
      .select()
      .from(schema.rounds)
      .where(eq(schema.rounds.id, cachedRoundId))
      .limit(1);
    round = r ?? null;
  }

  const totalQuestions = round
    ? (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.questions)
          .where(eq(schema.questions.roundId, round.id))
      )[0]?.c ?? 0
    : 0;

  return {
    slot,
    title: round?.title ?? DEFAULTS[slot].title,
    roundId: round?.id ?? null,
    matchupId,
    status: round
      ? (round.liveStatus as FinalsRoundSummary["status"])
      : "not_created",
    totalQuestions,
    currentQuestionIndex: round?.liveCurrentQuestionIndex ?? null,
    isLive: round?.isLive ?? false,
  };
}

// Create a fresh live round for the given slot. Used internally by
// launchFinalsRound; exposed for tests / manual recovery.
async function createRoundFor(slot: FinalsSlot): Promise<string> {
  const t = (await getActiveTournament()) ?? (await getLatestTournament());
  if (!t) throw new Error("no tournament — create one before launching");

  const defaults = DEFAULTS[slot];

  // Resolve the matchup for tournament-mode slots so the finalist gate
  // in lib/live.ts works (it reads round.tiebreakerMatchupId).
  let tiebreakerMatchupId: string | null = null;
  if (slot === "winners") {
    tiebreakerMatchupId = await getWinnersFinalMatchupId();
    if (!tiebreakerMatchupId) {
      throw new Error(
        "couldn't find a winners-bracket final matchup — generate the bracket first"
      );
    }
  } else if (slot === "losers") {
    tiebreakerMatchupId = await getLosersFinalMatchupId();
    if (!tiebreakerMatchupId) {
      throw new Error(
        "couldn't find a losers-bracket final matchup — generate the bracket first"
      );
    }
  } else if (slot === "championship") {
    tiebreakerMatchupId = await getOrCreateChampionshipMatchupId(t.id);
  }

  // chapterNumber unique-ish per tournament — append above the current max.
  const [maxRow] = await db
    .select({
      max: sql<number>`COALESCE(MAX(${schema.rounds.chapterNumber}), 0)`,
    })
    .from(schema.rounds)
    .where(eq(schema.rounds.tournamentId, t.id));
  const nextChapter = (maxRow?.max ?? 0) + 1;

  const roundId = makeId();
  await db.insert(schema.rounds).values({
    id: roundId,
    tournamentId: t.id,
    chapterNumber: nextChapter,
    title: defaults.title,
    isPractice: defaults.isPractice,
    isLive: true,
    liveStatus: "pre_start",
    liveQuestionSeconds: defaults.seconds,
    tiebreakerMatchupId,
    losersMatchupId: slot === "losers" ? tiebreakerMatchupId : null,
    status: "draft",
  });

  // Populate questions from the library so the round is immediately
  // runnable. Sam can still edit/replace them via the round editor.
  const libRows = await db
    .select()
    .from(schema.libraryQuestions)
    .orderBy(sql`random()`)
    .limit(defaults.questionCount);
  if (libRows.length === 0) {
    throw new Error("library is empty — seed library_questions first");
  }
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
    for (let oi = 0; oi < lib.options.length; oi++) {
      await db.insert(schema.options).values({
        id: makeId(),
        questionId: qid,
        order: oi,
        label: lib.options[oi].label,
        isCorrect: lib.options[oi].isCorrect,
      });
    }
  }

  await writeRoundIdSetting(slot, roundId);
  return roundId;
}

// Returns the round id for the given slot, creating + starting the round
// if it doesn't exist yet. Idempotent:
//   - not_created → create + start
//   - pre_start   → start
//   - running     → no-op (just return the existing id)
//   - revealing   → no-op
//   - complete    → no-op (host must Reset from /host/live/[id] first)
export async function launchFinalsRound(
  slot: FinalsSlot
): Promise<{ roundId: string; started: boolean }> {
  let summary = await getFinalsRoundSummary(slot);

  if (summary.status === "not_created") {
    const newId = await createRoundFor(slot);
    summary = await getFinalsRoundSummary(slot);
    if (!summary.roundId) throw new Error("round creation failed");
  }

  if (!summary.roundId) {
    throw new Error("no round id after creation");
  }

  if (summary.status === "pre_start") {
    // Before going live, close out any OTHER live rounds. Two rounds
    // with isLive=true and an in-flight status (pre_start/running/
    // revealing) confuse getCurrentLiveRound — clients on /watch and
    // /live can end up locked to the wrong round.
    await db
      .update(schema.rounds)
      .set({
        liveStatus: "complete",
        status: "closed",
        liveEffect: null,
        liveEffectAt: null,
        liveEffectMessage: null,
      })
      .where(
        and(
          eq(schema.rounds.isLive, true),
          ne(schema.rounds.id, summary.roundId),
          inArray(schema.rounds.liveStatus, [
            "pre_start",
            "running",
            "revealing",
          ])
        )
      );
    await startLiveRound({ roundId: summary.roundId });
    return { roundId: summary.roundId, started: true };
  }

  return { roundId: summary.roundId, started: false };
}
