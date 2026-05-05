// Question of the Day — DB helpers + cron-side orchestration.
// Designed to call Groq from the server-only cron route. Keep this file
// importable from server components (no client deps).

import { db, schema } from "@/db";
import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import { id as makeId } from "@/lib/ids";
import {
  generateDailyQuestion,
  safeguardText,
  type SafeguardVerdict,
} from "@/lib/groq";

const { qotdQuestions, qotdRecommendations, qotdResponses } = schema;

export const MAX_RECOMMENDATIONS_PER_USER = 2;

// ─── reads ──────────────────────────────────────────────────────────────

export function todayKey(now: Date = new Date()): string {
  // Using the server's local-equivalent date — Vercel runs UTC, so we use
  // America/New_York to match the family's wall clock. Cheap formatter.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now); // YYYY-MM-DD
}

export async function getQuestionForDate(forDate: string) {
  const [row] = await db
    .select()
    .from(qotdQuestions)
    .where(eq(qotdQuestions.forDate, forDate))
    .limit(1);
  return row ?? null;
}

export async function getTodayQuestion() {
  return getQuestionForDate(todayKey());
}

export async function getRecentQuestions(limit = 14) {
  return db
    .select()
    .from(qotdQuestions)
    .orderBy(desc(qotdQuestions.forDate))
    .limit(limit);
}

export async function listMyRecommendations(userId: string) {
  return db
    .select()
    .from(qotdRecommendations)
    .where(eq(qotdRecommendations.userId, userId))
    .orderBy(desc(qotdRecommendations.createdAt));
}

export async function countMyRecommendations(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(qotdRecommendations)
    .where(eq(qotdRecommendations.userId, userId));
  return row?.c ?? 0;
}

export async function listResponses(questionId: string) {
  // Public view — only non-hidden, with the user's display name joined in.
  return db
    .select({
      id: qotdResponses.id,
      choice: qotdResponses.choice,
      otherTextClean: qotdResponses.otherTextClean,
      createdAt: qotdResponses.createdAt,
      userName: schema.users.name,
      userEmail: schema.users.email,
    })
    .from(qotdResponses)
    .leftJoin(schema.users, eq(schema.users.id, qotdResponses.userId))
    .where(
      and(
        eq(qotdResponses.questionId, questionId),
        eq(qotdResponses.hidden, false)
      )
    )
    .orderBy(desc(qotdResponses.createdAt));
}

export async function listAllResponsesForStaff(questionId: string) {
  // Staff view — includes hidden ones for review.
  return db
    .select({
      id: qotdResponses.id,
      choice: qotdResponses.choice,
      otherTextRaw: qotdResponses.otherTextRaw,
      otherTextClean: qotdResponses.otherTextClean,
      hidden: qotdResponses.hidden,
      createdAt: qotdResponses.createdAt,
      userName: schema.users.name,
      userEmail: schema.users.email,
    })
    .from(qotdResponses)
    .leftJoin(schema.users, eq(schema.users.id, qotdResponses.userId))
    .where(eq(qotdResponses.questionId, questionId))
    .orderBy(desc(qotdResponses.createdAt));
}

export async function getMyResponse(args: {
  userId: string;
  questionId: string;
}) {
  const [row] = await db
    .select()
    .from(qotdResponses)
    .where(
      and(
        eq(qotdResponses.userId, args.userId),
        eq(qotdResponses.questionId, args.questionId)
      )
    )
    .limit(1);
  return row ?? null;
}

// ─── writes — recommendations ─────────────────────────────────────────

export async function submitRecommendation(args: {
  userId: string;
  topic: string;
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const trimmed = args.topic.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > 200)
    return { ok: false, reason: "too long (max 200 chars)" };

  // Lifetime cap.
  const have = await countMyRecommendations(args.userId);
  if (have >= MAX_RECOMMENDATIONS_PER_USER) {
    return {
      ok: false,
      reason: `you've used both your ${MAX_RECOMMENDATIONS_PER_USER} suggestions`,
    };
  }

  // Safeguard before saving so spam/inappropriate stuff never enters the
  // queue. Cleaned text replaces the original if the model wants a tidy.
  let topicToSave = trimmed;
  let verdict: SafeguardVerdict;
  try {
    verdict = await safeguardText(trimmed, "recommendation");
  } catch {
    // If safeguard fails (e.g. Groq down), fall back to allowing the
    // submission but flag it for staff review later via 'pending'.
    verdict = { decision: "safe" };
  }
  if (verdict.decision === "block") {
    return { ok: false, reason: verdict.reason ?? "rejected by safeguard" };
  }
  if (verdict.decision === "clean" && verdict.cleanText) {
    topicToSave = verdict.cleanText;
  }

  const id = makeId();
  await db.insert(qotdRecommendations).values({
    id,
    userId: args.userId,
    topic: topicToSave,
    status: "pending",
  });
  return { ok: true, id };
}

export async function pickNextRecommendation(opts?: {
  excludeIds?: string[];
}) {
  const where =
    opts?.excludeIds && opts.excludeIds.length > 0
      ? and(
          eq(qotdRecommendations.status, "pending"),
          notInArray(qotdRecommendations.id, opts.excludeIds)
        )
      : eq(qotdRecommendations.status, "pending");
  const [row] = await db
    .select()
    .from(qotdRecommendations)
    .where(where)
    .orderBy(qotdRecommendations.createdAt)
    .limit(1);
  return row ?? null;
}

export async function markRecommendationUsed(args: {
  recId: string;
  questionId: string;
}) {
  await db
    .update(qotdRecommendations)
    .set({
      status: "used",
      pickedForQuestionId: args.questionId,
    })
    .where(eq(qotdRecommendations.id, args.recId));
}

export async function rejectRecommendation(args: {
  recId: string;
  reason: string;
}) {
  await db
    .update(qotdRecommendations)
    .set({ status: "rejected", rejectionReason: args.reason })
    .where(eq(qotdRecommendations.id, args.recId));
}

// ─── writes — responses ──────────────────────────────────────────────

export async function recordResponse(args: {
  userId: string;
  questionId: string;
  choice: "A" | "B" | "C" | "D" | "other";
  otherTextRaw?: string | null;
}): Promise<
  | { ok: true; id: string; cleaned?: string | null }
  | { ok: false; reason: string }
> {
  // One response per user per question — caller can pre-check, but the DB
  // also has a unique index so a race won't double-write.
  const existing = await getMyResponse({
    userId: args.userId,
    questionId: args.questionId,
  });
  if (existing) {
    return { ok: false, reason: "you've already answered today" };
  }

  let otherClean: string | null = null;
  let hidden = false;

  if (args.choice === "other") {
    const raw = (args.otherTextRaw ?? "").trim();
    if (!raw) return { ok: false, reason: "type your 'Other' answer" };
    if (raw.length > 200)
      return { ok: false, reason: "200 character limit" };
    let verdict: SafeguardVerdict;
    try {
      verdict = await safeguardText(raw, "response");
    } catch {
      verdict = { decision: "safe" };
    }
    if (verdict.decision === "block") {
      // Save the response but hide it. Staff can review later.
      hidden = true;
      otherClean = null;
    } else {
      otherClean =
        verdict.decision === "clean" && verdict.cleanText
          ? verdict.cleanText
          : raw;
    }
  }

  const id = makeId();
  await db.insert(qotdResponses).values({
    id,
    questionId: args.questionId,
    userId: args.userId,
    choice: args.choice,
    otherTextRaw: args.otherTextRaw ?? null,
    otherTextClean: otherClean,
    hidden,
  });

  if (hidden) {
    return {
      ok: false,
      reason: "your answer was held for review — try a different wording",
    };
  }
  return { ok: true, id, cleaned: otherClean };
}

// ─── re-review of existing data ───────────────────────────────────────
// Re-runs the safeguard on every "other" response and pending
// recommendation. Used after we tighten the safeguard prompt or the
// blocklist — anything that snuck through earlier gets caught here.

export async function rereviewAll(): Promise<{
  responsesReviewed: number;
  responsesNewlyHidden: number;
  responsesUnhidden: number;
  recsReviewed: number;
  recsNewlyRejected: number;
}> {
  let responsesReviewed = 0;
  let responsesNewlyHidden = 0;
  let responsesUnhidden = 0;
  let recsReviewed = 0;
  let recsNewlyRejected = 0;

  const otherResponses = await db
    .select()
    .from(qotdResponses)
    .where(eq(qotdResponses.choice, "other"));
  for (const r of otherResponses) {
    responsesReviewed++;
    const probe = r.otherTextRaw ?? r.otherTextClean ?? "";
    if (!probe) continue;
    let verdict: SafeguardVerdict;
    try {
      verdict = await safeguardText(probe, "response");
    } catch {
      continue;
    }
    if (verdict.decision === "block") {
      if (!r.hidden) {
        await db
          .update(qotdResponses)
          .set({ hidden: true })
          .where(eq(qotdResponses.id, r.id));
        responsesNewlyHidden++;
      }
    } else {
      const newClean =
        verdict.decision === "clean" && verdict.cleanText
          ? verdict.cleanText
          : (r.otherTextRaw ?? r.otherTextClean ?? "").slice(0, 200);
      const updates: Record<string, unknown> = { otherTextClean: newClean };
      if (r.hidden) {
        updates.hidden = false;
        responsesUnhidden++;
      }
      await db
        .update(qotdResponses)
        .set(updates)
        .where(eq(qotdResponses.id, r.id));
    }
  }

  const pending = await db
    .select()
    .from(qotdRecommendations)
    .where(eq(qotdRecommendations.status, "pending"));
  for (const rec of pending) {
    recsReviewed++;
    let verdict: SafeguardVerdict;
    try {
      verdict = await safeguardText(rec.topic, "recommendation");
    } catch {
      continue;
    }
    if (verdict.decision === "block") {
      await db
        .update(qotdRecommendations)
        .set({
          status: "rejected",
          rejectionReason: verdict.reason ?? "rejected on rereview",
        })
        .where(eq(qotdRecommendations.id, rec.id));
      recsNewlyRejected++;
    } else if (verdict.decision === "clean" && verdict.cleanText) {
      await db
        .update(qotdRecommendations)
        .set({ topic: verdict.cleanText })
        .where(eq(qotdRecommendations.id, rec.id));
    }
  }

  return {
    responsesReviewed,
    responsesNewlyHidden,
    responsesUnhidden,
    recsReviewed,
    recsNewlyRejected,
  };
}

// ─── orchestration — daily generation ────────────────────────────────

// Regenerate today's question even if one already exists. Destructive:
// deletes the existing row (FK cascade wipes responses + answers) and
// reverts the seeding recommendation back to 'pending'. Use when the
// host doesn't like the question the cron picked.
export async function regenerateDailyQuestion(args: {
  forDate?: string;
  currentEventsContext?: string | null;
}): Promise<
  | {
      created: true;
      questionId: string;
      replaced: boolean;
      lostResponses: number;
    }
  | { created: false; reason: string }
> {
  const forDate = args.forDate ?? todayKey();
  const existing = await getQuestionForDate(forDate);
  let lostResponses = 0;
  // Capture what we're throwing out BEFORE the delete so we can pass it
  // to Groq as a "must not use" — otherwise the regenerated question
  // can land on the exact same prompt we just rejected (the recent-
  // prompts query no longer sees it once we delete the row).
  const justThrewOut = existing?.prompt ?? null;
  const justThrewOutOptions = existing?.options ?? null;

  // Capture the previous rec id (if any) so we can exclude it from the
  // pick on the very next call AND push it to the back of the queue.
  // Without these two, the regenerate just re-grabs the same rec (the
  // oldest pending one) and Groq dutifully writes another question on
  // the same topic — exactly the bug the host hit with the pizza one.
  const previousRecId = existing?.basedOnRecommendationId ?? null;

  if (existing) {
    const [c] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(qotdResponses)
      .where(eq(qotdResponses.questionId, existing.id));
    lostResponses = c?.n ?? 0;

    if (existing.basedOnRecommendationId) {
      // Revert the rec back to 'pending' so the player's lifetime cap
      // isn't burned on a thrown-out question — but bump createdAt to
      // NOW so it's at the BACK of the queue, not the front. This way
      // tomorrow's auto-cron won't keep grabbing the same rec.
      await db
        .update(qotdRecommendations)
        .set({
          status: "pending",
          pickedForQuestionId: null,
          createdAt: new Date(),
        })
        .where(eq(qotdRecommendations.id, existing.basedOnRecommendationId));
    }

    await db.delete(qotdQuestions).where(eq(qotdQuestions.id, existing.id));
  }

  // Build the avoid list: the literal prompt we just rejected + the option
  // labels (so Groq doesn't keep the same answer set with a paraphrased
  // stem). The regular generate path picks up these via extraAvoidPrompts.
  const extraAvoid: string[] = [];
  if (justThrewOut) extraAvoid.push(justThrewOut);
  if (justThrewOutOptions) {
    extraAvoid.push(
      `[options just rejected: ${justThrewOutOptions
        .map((o) => o.label)
        .join(" / ")}]`
    );
  }

  const result = await generateAndStoreDailyQuestion({
    forDate,
    currentEventsContext: args.currentEventsContext,
    extraAvoidPrompts: extraAvoid,
    // Skip THIS specific rec on the immediate pick. The createdAt bump
    // above keeps it from popping back to the top tomorrow either —
    // newer recs get priority going forward.
    excludeRecIds: previousRecId ? [previousRecId] : undefined,
  });
  if (!result.created) {
    return result;
  }
  return {
    created: true,
    questionId: result.questionId,
    replaced: !!existing,
    lostResponses,
  };
}

export async function generateAndStoreDailyQuestion(args: {
  forDate?: string;
  currentEventsContext?: string | null;
  // When set, these prompts are added to the "must not use" list passed
  // to Groq. Used by regenerateDailyQuestion to ensure the rejected
  // question doesn't get re-generated verbatim — the recent-prompts
  // query no longer sees the deleted row, so we have to hand-feed it.
  extraAvoidPrompts?: string[];
  // When set, recommendations with these ids are skipped by the queue
  // pick. Used by regenerate so the host doesn't get the same rec
  // (and thus the same topic) on the very next generate.
  excludeRecIds?: string[];
}): Promise<
  | { created: true; questionId: string }
  | { created: false; reason: string }
> {
  const forDate = args.forDate ?? todayKey();
  // Idempotent: if today's question already exists, don't regen.
  const existing = await getQuestionForDate(forDate);
  if (existing) {
    return { created: false, reason: `already exists for ${forDate}` };
  }

  const rec = await pickNextRecommendation({
    excludeIds: args.excludeRecIds,
  });
  const recent = await getRecentQuestions(28);
  const recentPrompts = recent.map((r) => r.prompt);
  const avoidList = [...(args.extraAvoidPrompts ?? []), ...recentPrompts];
  const generated = await generateDailyQuestion({
    recommendation: rec?.topic,
    currentEventsContext: args.currentEventsContext ?? null,
    recentQuestionPrompts: avoidList,
  });

  const questionId = makeId();
  await db.insert(qotdQuestions).values({
    id: questionId,
    forDate,
    prompt: generated.prompt,
    options: generated.options,
    basedOnRecommendationId: rec?.id ?? null,
    context: generated.rationale,
  });
  if (rec) {
    await markRecommendationUsed({ recId: rec.id, questionId });
  }
  return { created: true, questionId };
}
