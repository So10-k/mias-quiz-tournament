"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import {
  getOrCreateActiveTournament,
  getLatestTournament,
  setRegistrationOpen,
  setSubtitle,
  closeCurrentRound,
  startNextRound,
  endTournament,
  reopenTournament,
  restoreReader,
  adjustStrike,
  createRound,
  removeReader,
  getCast,
} from "@/lib/engine";
import {
  generateBracket,
  clearBracket,
  resolveMatchup,
  swapSeed,
  getBracketChampionId,
} from "@/lib/bracket";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { logHostAction } from "@/lib/discourse-staff-log";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") redirect("/play");
  return u;
}

// Look up a user's email/name for use as the staff-log target. Used
// by host actions that operate on a specific player. Returns null
// if the user can't be found — caller should pass null fields.
async function lookupTargetUser(
  userId: string | null | undefined
): Promise<{ email: string | null; name: string | null } | null> {
  if (!userId) return null;
  const [u] = await db
    .select({
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return u ?? null;
}

function bumpAll() {
  revalidatePath("/host");
  revalidatePath("/");
  revalidatePath("/play");
  revalidatePath("/players");
  revalidatePath("/standings");
  revalidatePath("/bracket");
}

export async function ensureTournamentExists() {
  await requireHost();
  await getOrCreateActiveTournament();
  bumpAll();
}

export async function openTheDoors() {
  const u = await requireHost();
  const t = await getOrCreateActiveTournament();
  await setRegistrationOpen(t.id, true);
  void logHostAction({
    actor: u,
    actionLabel: "open_registration",
    subject: t.slug,
    details: `Tournament: ${t.title}`,
    newValue: "true",
  });
  bumpAll();
}

export async function closeTheDoors() {
  const u = await requireHost();
  const t = await getOrCreateActiveTournament();
  await setRegistrationOpen(t.id, false);
  void logHostAction({
    actor: u,
    actionLabel: "close_registration",
    subject: t.slug,
    details: `Tournament: ${t.title}`,
    newValue: "false",
  });
  bumpAll();
}

export async function startNextRoundAction() {
  const u = await requireHost();
  const t = await getOrCreateActiveTournament();
  try {
    await startNextRound(t.id);
  } catch (err: any) {
    redirect(
      "/host?error=" + encodeURIComponent(err?.message ?? "Could not start")
    );
  }
  void logHostAction({
    actor: u,
    actionLabel: "start_next_round",
    subject: t.slug,
    details: `Started the next round in ${t.title}`,
  });
  bumpAll();
}

export async function closeActiveRound() {
  const u = await requireHost();
  const t = await getOrCreateActiveTournament();
  await closeCurrentRound(t.id);
  void logHostAction({
    actor: u,
    actionLabel: "close_active_round",
    subject: t.slug,
    details: `Closed the active round in ${t.title}`,
  });
  bumpAll();
}

const EndTournamentInput = z.object({
  winnerUserId: z.string().min(1).optional(),
  noWinner: z.string().optional(),
});

export async function endTournamentAction(formData: FormData) {
  const u = await requireHost();
  const parsed = EndTournamentInput.safeParse({
    winnerUserId: formData.get("winnerUserId")
      ? String(formData.get("winnerUserId"))
      : undefined,
    noWinner: formData.get("noWinner")
      ? String(formData.get("noWinner"))
      : undefined,
  });
  if (!parsed.success) {
    redirect("/host?error=Pick+a+winner+or+choose+No+winner");
  }
  const winnerId = parsed.data.noWinner
    ? null
    : parsed.data.winnerUserId ?? null;
  const t = await getOrCreateActiveTournament();
  await endTournament(t.id, winnerId);
  const winner = await lookupTargetUser(winnerId);
  void logHostAction({
    actor: u,
    actionLabel: "end_tournament",
    subject: t.slug,
    targetUserId: winnerId,
    targetEmail: winner?.email,
    targetName: winner?.name,
    details: winnerId
      ? `Ended ${t.title} with winner: ${winner?.name ?? winner?.email ?? winnerId}`
      : `Ended ${t.title} with no winner`,
    newValue: winnerId ?? "(no winner)",
  });
  bumpAll();
  redirect("/host?ok=Tournament+ended");
}

export async function reopenTournamentAction() {
  const u = await requireHost();
  const latest = await getLatestTournament();
  if (!latest) return;
  await reopenTournament(latest.id);
  void logHostAction({
    actor: u,
    actionLabel: "reopen_tournament",
    subject: latest.slug,
    details: `Reopened ${latest.title}`,
  });
  bumpAll();
  redirect("/host?ok=Tournament+reopened");
}

export async function restoreReaderAction(formData: FormData) {
  const u = await requireHost();
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  if (!enrollmentId) return;
  // Resolve the enrollment to a user so the staff log shows who got
  // restored. Cheap to look up — single PK fetch.
  const [enr] = await db
    .select({
      userId: schema.enrollments.userId,
    })
    .from(schema.enrollments)
    .where(eq(schema.enrollments.id, enrollmentId))
    .limit(1);
  await restoreReader(enrollmentId, 0);
  const target = await lookupTargetUser(enr?.userId);
  void logHostAction({
    actor: u,
    actionLabel: "restore_player",
    subject: enrollmentId,
    targetUserId: enr?.userId,
    targetEmail: target?.email,
    targetName: target?.name,
    details: `Restored ${target?.name ?? target?.email ?? enrollmentId} to the active roster`,
  });
  bumpAll();
  redirect("/host?ok=Player+restored");
}

export async function giveHeartAction(formData: FormData) {
  const u = await requireHost();
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  if (!enrollmentId) return;
  const [enr] = await db
    .select({ userId: schema.enrollments.userId })
    .from(schema.enrollments)
    .where(eq(schema.enrollments.id, enrollmentId))
    .limit(1);
  await adjustStrike(enrollmentId, -1);
  const target = await lookupTargetUser(enr?.userId);
  void logHostAction({
    actor: u,
    actionLabel: "give_heart",
    subject: enrollmentId,
    targetUserId: enr?.userId,
    targetEmail: target?.email,
    targetName: target?.name,
    details: `Gave +1 heart to ${target?.name ?? target?.email ?? enrollmentId} (strike count -1)`,
  });
  bumpAll();
}

export async function takeHeartAction(formData: FormData) {
  const u = await requireHost();
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  if (!enrollmentId) return;
  const [enr] = await db
    .select({ userId: schema.enrollments.userId })
    .from(schema.enrollments)
    .where(eq(schema.enrollments.id, enrollmentId))
    .limit(1);
  await adjustStrike(enrollmentId, +1);
  const target = await lookupTargetUser(enr?.userId);
  void logHostAction({
    actor: u,
    actionLabel: "take_heart",
    subject: enrollmentId,
    targetUserId: enr?.userId,
    targetEmail: target?.email,
    targetName: target?.name,
    details: `Took -1 heart from ${target?.name ?? target?.email ?? enrollmentId} (strike count +1)`,
  });
  bumpAll();
}

export async function updateSubtitle(formData: FormData) {
  const u = await requireHost();
  const t = await getOrCreateActiveTournament();
  const subtitle = String(formData.get("subtitle") ?? "").trim();
  if (subtitle.length === 0 || subtitle.length > 240) {
    redirect("/host?error=Subtitle+must+be+1-240+characters");
  }
  const prev = t.subtitle ?? "";
  await setSubtitle(t.id, subtitle);
  void logHostAction({
    actor: u,
    actionLabel: "update_subtitle",
    subject: t.slug,
    previousValue: prev,
    newValue: subtitle,
    details: `Changed tournament subtitle for ${t.title}`,
  });
  bumpAll();
}

const QuestionInput = z.object({
  prompt: z.string().min(1).max(400),
  options: z
    .array(z.object({ label: z.string().min(1).max(200) }))
    .min(2)
    .max(6),
  correctIndex: z.number().int().min(0),
});

export async function addRound(formData: FormData) {
  await requireHost();
  const t = await getOrCreateActiveTournament();

  const title = String(formData.get("title") ?? "").trim();
  const intro = String(formData.get("intro") ?? "").trim();
  const thresholdRaw = Number(formData.get("threshold") ?? 60);

  if (!title || title.length > 120) {
    redirect("/host?error=Title+is+required");
  }
  const threshold =
    Number.isFinite(thresholdRaw) && thresholdRaw >= 0 && thresholdRaw <= 100
      ? thresholdRaw / 100
      : 0.6;

  const questionCount = Number(formData.get("questionCount") ?? 0);
  const parsedQs: Array<z.infer<typeof QuestionInput>> = [];
  for (let i = 0; i < questionCount; i++) {
    const prompt = String(formData.get(`q${i}.prompt`) ?? "").trim();
    if (!prompt) continue;
    const options: Array<{ label: string }> = [];
    for (let oi = 0; oi < 6; oi++) {
      const label = String(formData.get(`q${i}.opt${oi}`) ?? "").trim();
      if (label) options.push({ label });
    }
    const correctIndex = Number(formData.get(`q${i}.correct`) ?? -1);
    if (
      options.length < 2 ||
      correctIndex < 0 ||
      correctIndex >= options.length
    ) {
      redirect(
        "/host?error=" +
          encodeURIComponent(
            `Question ${i + 1} needs at least two answers and one correct one`
          )
      );
    }
    parsedQs.push(QuestionInput.parse({ prompt, options, correctIndex }));
  }

  if (parsedQs.length === 0) {
    redirect("/host?error=Add+at+least+one+question");
  }

  const isPractice = String(formData.get("isPractice") ?? "") === "yes";

  await createRound({
    tournamentId: t.id,
    title,
    introProse: intro || undefined,
    passThreshold: threshold,
    closesAt: null,
    isPractice,
    questions: parsedQs.map((q) => ({
      prompt: q.prompt,
      questionType: "multiple_choice",
      options: q.options.map((o, idx) => ({
        label: o.label,
        isCorrect: idx === q.correctIndex,
      })),
    })),
  });

  void logHostAction({
    actor: await requireHost(),
    actionLabel: isPractice ? "create_practice_round" : "create_round",
    subject: t.slug,
    details: `Created ${isPractice ? "practice " : ""}round "${title}" with ${parsedQs.length} question${parsedQs.length === 1 ? "" : "s"} (pass ≥ ${Math.round(threshold * 100)}%)`,
    newValue: title,
  });
  bumpAll();
  redirect(
    isPractice
      ? "/host?ok=Practice+round+saved+%E2%80%94+players+can+try+it+now"
      : "/host?ok=Round+saved"
  );
}

export async function removeReaderAction(formData: FormData) {
  const u = await requireHost();
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!enrollmentId || confirm !== "yes") {
    redirect("/host?error=Please+confirm");
  }
  const [enr] = await db
    .select({ userId: schema.enrollments.userId })
    .from(schema.enrollments)
    .where(eq(schema.enrollments.id, enrollmentId))
    .limit(1);
  await removeReader(enrollmentId);
  const target = await lookupTargetUser(enr?.userId);
  void logHostAction({
    actor: u,
    actionLabel: "remove_player",
    subject: enrollmentId,
    targetUserId: enr?.userId,
    targetEmail: target?.email,
    targetName: target?.name,
    details: `Removed ${target?.name ?? target?.email ?? enrollmentId} from the tournament`,
  });
  bumpAll();
}

export async function deleteDraftRound(formData: FormData) {
  const u = await requireHost();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) return;
  const [r] = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.id, roundId))
    .limit(1);
  if (!r || r.status !== "draft") {
    redirect("/host?error=Only+draft+rounds+can+be+deleted");
  }
  await db.delete(schema.rounds).where(eq(schema.rounds.id, roundId));
  void logHostAction({
    actor: u,
    actionLabel: "delete_draft_round",
    subject: roundId,
    details: `Deleted draft round "${r.title}"`,
    previousValue: r.title,
  });
  bumpAll();
}

// ─── bracket controls ───────────────────────────────────────────────────────

// Create (or recreate) a bracket. `mode` controls seeding:
//   - "registration" — order players by registration time (default)
//   - "shuffle"      — random order
//   - "custom"       — caller passes seedOrder via formData
export async function generateBracketAction(formData: FormData) {
  const u = await requireHost();
  const t = await getOrCreateActiveTournament();
  const mode = String(formData.get("mode") ?? "registration");
  const includeOut = formData.get("includeOut") === "yes";

  const cast = await getCast(t.id);
  const eligible = cast.filter(
    (c) => includeOut || !c.enrollment.eliminatedAt
  );
  if (eligible.length < 2) {
    redirect("/host?error=Need+at+least+2+players+to+make+a+bracket");
  }
  let seedUserIds = eligible.map((c) => c.user.id);
  if (mode === "shuffle") {
    seedUserIds = [...seedUserIds].sort(() => Math.random() - 0.5);
  } else if (mode === "custom") {
    const raw = String(formData.get("seedOrder") ?? "");
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) seedUserIds = parts;
  }
  try {
    await generateBracket(t.id, seedUserIds);
  } catch (err: any) {
    redirect(
      "/host?error=" + encodeURIComponent(err?.message ?? "Could not generate")
    );
  }
  void logHostAction({
    actor: u,
    actionLabel: "generate_bracket",
    subject: t.slug,
    details: `Generated bracket for ${t.title} with ${seedUserIds.length} players (mode: ${mode}${includeOut ? ", includes eliminated" : ""})`,
    newValue: `${seedUserIds.length} players`,
  });
  bumpAll();
  redirect("/host?ok=Bracket+generated");
}

export async function clearBracketAction() {
  const u = await requireHost();
  const t = await getOrCreateActiveTournament();
  await clearBracket(t.id);
  void logHostAction({
    actor: u,
    actionLabel: "clear_bracket",
    subject: t.slug,
    details: `Cleared the entire bracket for ${t.title}`,
  });
  bumpAll();
  redirect("/host?ok=Bracket+cleared");
}

// Override a single matchup's winner. Setting "" clears it (auto can refill).
export async function setMatchupWinnerAction(formData: FormData) {
  const u = await requireHost();
  const matchupId = String(formData.get("matchupId") ?? "");
  const winnerRaw = String(formData.get("winnerUserId") ?? "");
  const winnerUserId = winnerRaw ? winnerRaw : null;
  // Capture pre-state so the staff log can show the diff.
  const [pre] = await db
    .select()
    .from(schema.matchups)
    .where(eq(schema.matchups.id, matchupId))
    .limit(1);
  await resolveMatchup(matchupId, winnerUserId, "manual");

  // Mirror the result into the forum so subscribers see it as a
  // topic in Round Recaps. Idempotent (external_id keyed on matchup
  // id) so flipping the winner re-resolves to the same topic;
  // clearing a winner does nothing.
  if (winnerUserId) {
    const { postMatchRecap } = await import("@/lib/forum-autopost");
    void postMatchRecap(matchupId);
  }

  // Log every winner change — including clears — so the audit trail
  // captures host overrides.
  const [winner, prevWinner] = await Promise.all([
    lookupTargetUser(winnerUserId),
    lookupTargetUser(pre?.winnerUserId ?? null),
  ]);
  void logHostAction({
    actor: u,
    actionLabel: winnerUserId ? "set_match_winner" : "clear_match_winner",
    subject: matchupId,
    targetUserId: winnerUserId,
    targetEmail: winner?.email,
    targetName: winner?.name,
    previousValue: prevWinner?.name ?? prevWinner?.email ?? "",
    newValue: winner?.name ?? winner?.email ?? "(cleared)",
    details: pre
      ? `Bracket: ${pre.bracket} · Round ${pre.roundIndex} · Slot ${pre.slot}`
      : undefined,
    idempotencyKey: `match-${matchupId}-${winnerUserId ?? "clear"}-${Date.now()}`,
  });
  bumpAll();
}

// Swap a round-1 seed slot's player. Used by the bracket maker UI.
export async function swapSeedAction(formData: FormData) {
  const u = await requireHost();
  const t = await getOrCreateActiveTournament();
  const matchupId = String(formData.get("matchupId") ?? "");
  const side = String(formData.get("side") ?? "a") === "b" ? "b" : "a";
  const newUserIdRaw = String(formData.get("newUserId") ?? "");
  const newUserId = newUserIdRaw ? newUserIdRaw : null;
  await swapSeed(t.id, matchupId, side, newUserId);
  void getBracketChampionId; // silence unused import lint
  const target = await lookupTargetUser(newUserId);
  void logHostAction({
    actor: u,
    actionLabel: "swap_seed",
    subject: matchupId,
    targetUserId: newUserId,
    targetEmail: target?.email,
    targetName: target?.name,
    details: `Swapped seed in matchup side ${side.toUpperCase()} → ${target?.name ?? target?.email ?? "(empty)"}`,
    newValue: target?.name ?? target?.email ?? "(empty)",
  });
  bumpAll();
}

// ─── existing round controls (continued) ────────────────────────────────────

export async function reopenRound(formData: FormData) {
  const u = await requireHost();
  const t = await getOrCreateActiveTournament();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) return;
  const all = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.tournamentId, t.id));
  if (all.some((r) => r.status === "active" && r.id !== roundId)) {
    redirect(
      "/host?error=" +
        encodeURIComponent("Close the currently active round first.")
    );
  }
  const round = all.find((r) => r.id === roundId);
  await db
    .update(schema.rounds)
    .set({ status: "active" })
    .where(
      and(eq(schema.rounds.id, roundId), eq(schema.rounds.tournamentId, t.id))
    );
  void logHostAction({
    actor: u,
    actionLabel: "reopen_round",
    subject: roundId,
    details: round
      ? `Reopened round "${round.title}" (chapter ${round.chapterNumber})`
      : `Reopened round ${roundId}`,
    newValue: "active",
  });
  bumpAll();
  redirect("/host?ok=Round+reopened");
}
