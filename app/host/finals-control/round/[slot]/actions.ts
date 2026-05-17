"use server";

// Inline question editor for a finals round. Auto-creates the round
// if it doesn't exist yet (so Sam can author questions BEFORE the
// round is launched). Author-only.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { id as makeId } from "@/lib/ids";
import { requireUser } from "@/lib/session";
import {
  getFinalsRoundSummary,
  type FinalsSlot,
} from "@/lib/finals-rounds";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import { generateMysteryQuestions } from "@/lib/mystery-questions";
import { generatePlacesQuestions } from "@/lib/places-questions";

const SLOT_VALUES = new Set<FinalsSlot>([
  "rehearsal",
  "winners",
  "losers",
  "championship",
]);

async function requireAuthor() {
  const u = await requireUser();
  if (u.role !== "author") throw new Error("forbidden — author only");
  return u;
}

function requireSlot(value: unknown): FinalsSlot {
  const s = String(value ?? "");
  if (!SLOT_VALUES.has(s as FinalsSlot)) {
    throw new Error("unknown slot");
  }
  return s as FinalsSlot;
}

// Create an empty round shell (no library auto-fill) so Sam can author
// questions from scratch. Returns the round id.
async function ensureEmptyRoundFor(slot: FinalsSlot): Promise<string> {
  const existing = await getFinalsRoundSummary(slot);
  if (existing.roundId) return existing.roundId;
  const t = (await getActiveTournament()) ?? (await getLatestTournament());
  if (!t) throw new Error("no tournament");
  const [maxRow] = await db
    .select({
      max: sql<number>`COALESCE(MAX(${schema.rounds.chapterNumber}), 0)`,
    })
    .from(schema.rounds)
    .where(eq(schema.rounds.tournamentId, t.id));
  const nextChapter = (maxRow?.max ?? 0) + 1;
  const titles: Record<FinalsSlot, string> = {
    rehearsal: "Finals Rehearsal",
    winners: "🏆 Winners' Bracket Final — Karen vs Marc",
    losers: "🥈 Losers' Bracket Final — Grandpa vs Sam",
    championship: "👑 Championship Round",
  };
  const roundId = makeId();
  await db.insert(schema.rounds).values({
    id: roundId,
    tournamentId: t.id,
    chapterNumber: nextChapter,
    title: titles[slot],
    isPractice: slot === "rehearsal",
    isLive: true,
    liveStatus: "pre_start",
    liveQuestionSeconds: 30,
    status: "draft",
  });
  await db
    .insert(schema.appSettings)
    .values({ key: `finals_round_id_${slot}`, value: roundId })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: roundId, updatedAt: new Date() },
    });
  return roundId;
}

// ─── add a fresh question (4 blank options) ─────────────────────────

export async function addQuestionAction(formData: FormData) {
  await requireAuthor();
  const slot = requireSlot(formData.get("slot"));
  const roundId = await ensureEmptyRoundFor(slot);
  const [maxRow] = await db
    .select({
      max: sql<number>`COALESCE(MAX(${schema.questions.order}), -1)`,
    })
    .from(schema.questions)
    .where(eq(schema.questions.roundId, roundId));
  const nextOrder = (maxRow?.max ?? -1) + 1;
  const qid = makeId();
  await db.insert(schema.questions).values({
    id: qid,
    roundId,
    order: nextOrder,
    prompt: "New question",
    questionType: "multiple_choice",
    points: 1,
  });
  // Seed 4 blank options.
  for (let i = 0; i < 4; i++) {
    await db.insert(schema.options).values({
      id: makeId(),
      questionId: qid,
      order: i,
      label: ["Option A", "Option B", "Option C", "Option D"][i],
      isCorrect: i === 0,
    });
  }
  revalidatePath(`/host/finals-control/round/${slot}`);
}

// ─── update prompt + options + correct answer in one shot ──────────

export async function saveQuestionAction(formData: FormData) {
  await requireAuthor();
  const slot = requireSlot(formData.get("slot"));
  const questionId = String(formData.get("questionId") ?? "");
  if (!questionId) throw new Error("missing questionId");
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!prompt) throw new Error("prompt is required");
  await db
    .update(schema.questions)
    .set({ prompt })
    .where(eq(schema.questions.id, questionId));
  // Options come in as option_<id>_label / option_<id>_label plus a
  // `correct` radio that names which option is correct.
  const correctId = String(formData.get("correct") ?? "");
  const opts = await db
    .select()
    .from(schema.options)
    .where(eq(schema.options.questionId, questionId));
  for (const o of opts) {
    const label = formData.get(`option_${o.id}_label`);
    const isCorrect = correctId === o.id;
    await db
      .update(schema.options)
      .set({
        label:
          label != null
            ? String(label).trim() || o.label
            : o.label,
        isCorrect,
      })
      .where(eq(schema.options.id, o.id));
  }
  revalidatePath(`/host/finals-control/round/${slot}`);
}

// ─── delete one question (+ options cascade via FK) ─────────────────

export async function deleteQuestionAction(formData: FormData) {
  await requireAuthor();
  const slot = requireSlot(formData.get("slot"));
  const questionId = String(formData.get("questionId") ?? "");
  if (!questionId) throw new Error("missing questionId");
  await db
    .delete(schema.questions)
    .where(eq(schema.questions.id, questionId));
  revalidatePath(`/host/finals-control/round/${slot}`);
}

// ─── reorder: bump up / bump down ────────────────────────────────────

export async function moveQuestionAction(formData: FormData) {
  await requireAuthor();
  const slot = requireSlot(formData.get("slot"));
  const questionId = String(formData.get("questionId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!questionId || (direction !== "up" && direction !== "down")) {
    throw new Error("bad reorder request");
  }
  const [me] = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.id, questionId))
    .limit(1);
  if (!me) return;
  const all = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.roundId, me.roundId))
    .orderBy(schema.questions.order);
  const idx = all.findIndex((q) => q.id === questionId);
  const swapWith =
    direction === "up" ? all[idx - 1] : all[idx + 1];
  if (!swapWith) return;
  // Swap their orders.
  await db
    .update(schema.questions)
    .set({ order: swapWith.order })
    .where(eq(schema.questions.id, me.id));
  await db
    .update(schema.questions)
    .set({ order: me.order })
    .where(eq(schema.questions.id, swapWith.id));
  revalidatePath(`/host/finals-control/round/${slot}`);
}

// ─── update round meta (title, seconds per question) ───────────────

export async function updateRoundMetaAction(formData: FormData) {
  await requireAuthor();
  const slot = requireSlot(formData.get("slot"));
  const summary = await getFinalsRoundSummary(slot);
  if (!summary.roundId) {
    await ensureEmptyRoundFor(slot);
  }
  const refreshed = await getFinalsRoundSummary(slot);
  if (!refreshed.roundId) throw new Error("round creation failed");
  const title = String(formData.get("title") ?? "").trim();
  const secondsRaw = Number(formData.get("seconds") ?? "30");
  const seconds = Math.max(10, Math.min(120, Math.floor(secondsRaw) || 30));
  await db
    .update(schema.rounds)
    .set({
      ...(title ? { title } : {}),
      liveQuestionSeconds: seconds,
    })
    .where(eq(schema.rounds.id, refreshed.roundId));
  revalidatePath(`/host/finals-control/round/${slot}`);
}

// ─── 🎭 Mystery championship questions (AI-generated) ──────────────
// Wipes existing championship questions and replaces them with a
// fresh batch from Groq on a topic the model picks itself. The host
// never sees the topic — the questions are stored blind.

export async function generateMysteryChampionshipAction(formData: FormData) {
  await requireAuthor();
  const slot = requireSlot(formData.get("slot"));
  if (slot !== "championship") {
    throw new Error("mystery generation is only available for championship");
  }
  const countRaw = Number(formData.get("count") ?? "15");
  const count = Math.max(5, Math.min(30, Math.floor(countRaw) || 15));

  const roundId = await ensureEmptyRoundFor(slot);

  let questions;
  try {
    questions = await generateMysteryQuestions({ count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[mystery] generation failed:", msg);
    throw new Error(`Misc championship generation failed: ${msg}`);
  }

  await db
    .delete(schema.questions)
    .where(eq(schema.questions.roundId, roundId));

  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const qid = makeId();
    await db.insert(schema.questions).values({
      id: qid,
      roundId,
      order: qi,
      prompt: q.prompt,
      questionType: "multiple_choice",
      points: 1,
    });
    for (let oi = 0; oi < q.options.length; oi++) {
      await db.insert(schema.options).values({
        id: makeId(),
        questionId: qid,
        order: oi,
        label: q.options[oi].label,
        isCorrect: q.options[oi].isCorrect,
      });
    }
  }
  revalidatePath(`/host/finals-control/round/${slot}`);
  revalidatePath(`/host/finals-control`);
}

// ─── 🌍 Famous-places questions (winners + losers) ─────────────────
// Generates an EXTREME-difficulty famous-places set for the chosen
// bracket-final slot. Pulls the prompts from the OTHER slot (if it
// has one) as an exclusion list so the two finals never overlap.

export async function generatePlacesAction(formData: FormData) {
  await requireAuthor();
  const slot = requireSlot(formData.get("slot"));
  if (slot !== "winners" && slot !== "losers") {
    throw new Error(
      "famous-places generation is only available for winners + losers finals"
    );
  }
  const countRaw = Number(formData.get("count") ?? "15");
  const count = Math.max(5, Math.min(30, Math.floor(countRaw) || 15));

  const roundId = await ensureEmptyRoundFor(slot);

  // Pull the OTHER bracket-final's prompts so the model doesn't repeat
  // them when drafting this one.
  const otherSlot: FinalsSlot = slot === "winners" ? "losers" : "winners";
  const otherSummary = await getFinalsRoundSummary(otherSlot);
  let excludePrompts: string[] = [];
  if (otherSummary.roundId) {
    const rows = await db
      .select({ prompt: schema.questions.prompt })
      .from(schema.questions)
      .where(eq(schema.questions.roundId, otherSummary.roundId));
    excludePrompts = rows.map((r) => r.prompt).filter(Boolean);
  }

  let questions;
  try {
    questions = await generatePlacesQuestions({ count, excludePrompts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[places] generation failed:", msg);
    throw new Error(`Famous-places generation failed: ${msg}`);
  }

  await db
    .delete(schema.questions)
    .where(eq(schema.questions.roundId, roundId));

  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const qid = makeId();
    await db.insert(schema.questions).values({
      id: qid,
      roundId,
      order: qi,
      prompt: q.prompt,
      questionType: "multiple_choice",
      points: 1,
    });
    for (let oi = 0; oi < q.options.length; oi++) {
      await db.insert(schema.options).values({
        id: makeId(),
        questionId: qid,
        order: oi,
        label: q.options[oi].label,
        isCorrect: q.options[oi].isCorrect,
      });
    }
  }
  revalidatePath(`/host/finals-control/round/${slot}`);
  revalidatePath(`/host/finals-control`);
}

// ─── seed library questions in bulk (one-click filler) ─────────────

export async function seedFromLibraryAction(formData: FormData) {
  await requireAuthor();
  const slot = requireSlot(formData.get("slot"));
  const count = Math.max(
    1,
    Math.min(30, Math.floor(Number(formData.get("count") ?? "15")) || 15)
  );
  const roundId = await ensureEmptyRoundFor(slot);
  const lib = await db
    .select()
    .from(schema.libraryQuestions)
    .orderBy(sql`random()`)
    .limit(count);
  if (lib.length === 0) throw new Error("library is empty");
  const [maxRow] = await db
    .select({
      max: sql<number>`COALESCE(MAX(${schema.questions.order}), -1)`,
    })
    .from(schema.questions)
    .where(eq(schema.questions.roundId, roundId));
  let nextOrder = (maxRow?.max ?? -1) + 1;
  for (const item of lib) {
    const qid = makeId();
    await db.insert(schema.questions).values({
      id: qid,
      roundId,
      order: nextOrder++,
      prompt: item.prompt,
      questionType: "multiple_choice",
      points: 1,
    });
    for (let i = 0; i < item.options.length; i++) {
      await db.insert(schema.options).values({
        id: makeId(),
        questionId: qid,
        order: i,
        label: item.options[i].label,
        isCorrect: item.options[i].isCorrect,
      });
    }
  }
  revalidatePath(`/host/finals-control/round/${slot}`);
}
