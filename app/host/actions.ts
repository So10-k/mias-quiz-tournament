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

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") redirect("/play");
  return u;
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
  await requireHost();
  const t = await getOrCreateActiveTournament();
  await setRegistrationOpen(t.id, true);
  bumpAll();
}

export async function closeTheDoors() {
  await requireHost();
  const t = await getOrCreateActiveTournament();
  await setRegistrationOpen(t.id, false);
  bumpAll();
}

export async function startNextRoundAction() {
  await requireHost();
  const t = await getOrCreateActiveTournament();
  try {
    await startNextRound(t.id);
  } catch (err: any) {
    redirect(
      "/host?error=" + encodeURIComponent(err?.message ?? "Could not start")
    );
  }
  bumpAll();
}

export async function closeActiveRound() {
  await requireHost();
  const t = await getOrCreateActiveTournament();
  await closeCurrentRound(t.id);
  bumpAll();
}

const EndTournamentInput = z.object({
  winnerUserId: z.string().min(1).optional(),
  noWinner: z.string().optional(),
});

export async function endTournamentAction(formData: FormData) {
  await requireHost();
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
  bumpAll();
  redirect("/host?ok=Tournament+ended");
}

export async function reopenTournamentAction() {
  await requireHost();
  const latest = await getLatestTournament();
  if (!latest) return;
  await reopenTournament(latest.id);
  bumpAll();
  redirect("/host?ok=Tournament+reopened");
}

export async function restoreReaderAction(formData: FormData) {
  await requireHost();
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  if (!enrollmentId) return;
  await restoreReader(enrollmentId, 0);
  bumpAll();
  redirect("/host?ok=Player+restored");
}

export async function giveHeartAction(formData: FormData) {
  await requireHost();
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  if (!enrollmentId) return;
  await adjustStrike(enrollmentId, -1);
  bumpAll();
}

export async function takeHeartAction(formData: FormData) {
  await requireHost();
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  if (!enrollmentId) return;
  await adjustStrike(enrollmentId, +1);
  bumpAll();
}

export async function updateSubtitle(formData: FormData) {
  await requireHost();
  const t = await getOrCreateActiveTournament();
  const subtitle = String(formData.get("subtitle") ?? "").trim();
  if (subtitle.length === 0 || subtitle.length > 240) {
    redirect("/host?error=Subtitle+must+be+1-240+characters");
  }
  await setSubtitle(t.id, subtitle);
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

  await createRound({
    tournamentId: t.id,
    title,
    introProse: intro || undefined,
    passThreshold: threshold,
    closesAt: null,
    questions: parsedQs.map((q) => ({
      prompt: q.prompt,
      questionType: "multiple_choice",
      options: q.options.map((o, idx) => ({
        label: o.label,
        isCorrect: idx === q.correctIndex,
      })),
    })),
  });

  bumpAll();
  redirect("/host?ok=Round+saved");
}

export async function removeReaderAction(formData: FormData) {
  await requireHost();
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!enrollmentId || confirm !== "yes") {
    redirect("/host?error=Please+confirm");
  }
  await removeReader(enrollmentId);
  bumpAll();
}

export async function deleteDraftRound(formData: FormData) {
  await requireHost();
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
  bumpAll();
}

// ─── bracket controls ───────────────────────────────────────────────────────

// Create (or recreate) a bracket. `mode` controls seeding:
//   - "registration" — order players by registration time (default)
//   - "shuffle"      — random order
//   - "custom"       — caller passes seedOrder via formData
export async function generateBracketAction(formData: FormData) {
  await requireHost();
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
  bumpAll();
  redirect("/host?ok=Bracket+generated");
}

export async function clearBracketAction() {
  await requireHost();
  const t = await getOrCreateActiveTournament();
  await clearBracket(t.id);
  bumpAll();
  redirect("/host?ok=Bracket+cleared");
}

// Override a single matchup's winner. Setting "" clears it (auto can refill).
export async function setMatchupWinnerAction(formData: FormData) {
  await requireHost();
  const matchupId = String(formData.get("matchupId") ?? "");
  const winnerRaw = String(formData.get("winnerUserId") ?? "");
  const winnerUserId = winnerRaw ? winnerRaw : null;
  await resolveMatchup(matchupId, winnerUserId, "manual");
  bumpAll();
}

// Swap a round-1 seed slot's player. Used by the bracket maker UI.
export async function swapSeedAction(formData: FormData) {
  await requireHost();
  const t = await getOrCreateActiveTournament();
  const matchupId = String(formData.get("matchupId") ?? "");
  const side = String(formData.get("side") ?? "a") === "b" ? "b" : "a";
  const newUserIdRaw = String(formData.get("newUserId") ?? "");
  const newUserId = newUserIdRaw ? newUserIdRaw : null;
  await swapSeed(t.id, matchupId, side, newUserId);
  void getBracketChampionId; // silence unused import lint
  bumpAll();
}

// ─── existing round controls (continued) ────────────────────────────────────

export async function reopenRound(formData: FormData) {
  await requireHost();
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
  await db
    .update(schema.rounds)
    .set({ status: "active" })
    .where(
      and(eq(schema.rounds.id, roundId), eq(schema.rounds.tournamentId, t.id))
    );
  bumpAll();
  redirect("/host?ok=Round+reopened");
}
