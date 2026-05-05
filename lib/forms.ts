// Native forms feature — CRUD helpers used by /staff/forms (operator UI)
// and /forms/[slug] (public typeform-style runner).
//
// Forms have a slug (URL key), a list of ordered questions, and an optional
// auth gate. Authoring is staff-side; submissions are public-facing and may
// be anonymous or tied to a tournament player.

import { db, schema } from "@/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { id as makeId, slug as makeSlug } from "@/lib/ids";

const { forms, formQuestions, formSubmissions, formAnswers } = schema;

export type FormQuestionType =
  | "short_text"
  | "long_text"
  | "email"
  | "single_select"
  | "multi_select"
  | "yes_no"
  | "scale"
  | "statement";

export type FormQuestionOption = { label: string; value: string };

export type FormQuestionConfig = {
  // Scale-only: numeric range + optional anchors.
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  // short_text/long_text: max length.
  maxLength?: number;
};

export type Form = typeof forms.$inferSelect;
export type FormQuestion = typeof formQuestions.$inferSelect;
export type FormSubmission = typeof formSubmissions.$inferSelect;
export type FormAnswer = typeof formAnswers.$inferSelect;

export type AnswerValue = string | string[] | number | boolean | null;

// Slug normaliser: lowercase, alphanum + hyphens, trimmed.
export function normaliseSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// Pick a unique slug from a candidate; appends a short random suffix if
// taken. Caller passes a sane base ("untitled-form" if title empty).
export async function uniqueFormSlug(base: string): Promise<string> {
  const root = normaliseSlug(base) || "form";
  const [existing] = await db
    .select({ slug: forms.slug })
    .from(forms)
    .where(eq(forms.slug, root))
    .limit(1);
  if (!existing) return root;
  return `${root}-${makeSlug().slice(0, 4)}`;
}

// ─── reads ──────────────────────────────────────────────────────────────

export async function listForms() {
  // Forms with their submission counts. Single query via subselect so it
  // doesn't get expensive as form count grows.
  const rows = await db
    .select({
      id: forms.id,
      slug: forms.slug,
      title: forms.title,
      status: forms.status,
      requireAuth: forms.requireAuth,
      createdAt: forms.createdAt,
      updatedAt: forms.updatedAt,
      submissionCount: sql<number>`(select count(*)::int from ${formSubmissions} where ${formSubmissions.formId} = ${forms.id})`,
    })
    .from(forms)
    .orderBy(desc(forms.updatedAt));
  return rows;
}

export async function getFormById(id: string) {
  const [row] = await db.select().from(forms).where(eq(forms.id, id)).limit(1);
  return row ?? null;
}

export async function getFormBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(forms)
    .where(eq(forms.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function listQuestions(formId: string): Promise<FormQuestion[]> {
  return db
    .select()
    .from(formQuestions)
    .where(eq(formQuestions.formId, formId))
    .orderBy(asc(formQuestions.order));
}

export async function listSubmissions(formId: string) {
  return db
    .select({
      id: formSubmissions.id,
      submittedAt: formSubmissions.submittedAt,
      userId: formSubmissions.userId,
      ip: formSubmissions.ip,
      answersJson: formSubmissions.answersJson,
    })
    .from(formSubmissions)
    .where(eq(formSubmissions.formId, formId))
    .orderBy(desc(formSubmissions.submittedAt));
}

// ─── writes — forms ─────────────────────────────────────────────────────

export async function createForm(input: {
  title: string;
  intro?: string | null;
  createdByStaffId?: string | null;
}) {
  const id = makeId();
  const slug = await uniqueFormSlug(input.title);
  await db.insert(forms).values({
    id,
    slug,
    title: input.title || "Untitled form",
    intro: input.intro ?? null,
    status: "draft",
    requireAuth: false,
    oneSubmissionPerUser: false,
    createdByStaffId: input.createdByStaffId ?? null,
  });
  return { id, slug };
}

export async function updateForm(
  id: string,
  patch: Partial<{
    title: string;
    intro: string | null;
    outro: string | null;
    slug: string;
    requireAuth: boolean;
    oneSubmissionPerUser: boolean;
    status: "draft" | "published" | "closed";
  }>
) {
  const next: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.intro !== undefined) next.intro = patch.intro;
  if (patch.outro !== undefined) next.outro = patch.outro;
  if (patch.slug !== undefined) next.slug = normaliseSlug(patch.slug);
  if (patch.requireAuth !== undefined) next.requireAuth = patch.requireAuth;
  if (patch.oneSubmissionPerUser !== undefined)
    next.oneSubmissionPerUser = patch.oneSubmissionPerUser;
  if (patch.status !== undefined) next.status = patch.status;
  await db.update(forms).set(next).where(eq(forms.id, id));
}

export async function deleteForm(id: string) {
  await db.delete(forms).where(eq(forms.id, id));
}

// ─── writes — questions ─────────────────────────────────────────────────

export async function addQuestion(args: {
  formId: string;
  type: FormQuestionType;
  prompt: string;
  helperText?: string | null;
  required?: boolean;
  options?: FormQuestionOption[] | null;
  config?: FormQuestionConfig | null;
}): Promise<FormQuestion> {
  // Find the next order slot for this form.
  const [last] = await db
    .select({ max: sql<number>`coalesce(max(${formQuestions.order}), 0)` })
    .from(formQuestions)
    .where(eq(formQuestions.formId, args.formId));
  const nextOrder = (last?.max ?? 0) + 1;
  const id = makeId();
  await db.insert(formQuestions).values({
    id,
    formId: args.formId,
    order: nextOrder,
    type: args.type,
    prompt: args.prompt,
    helperText: args.helperText ?? null,
    required: args.required ?? true,
    options: args.options ?? null,
    config: args.config ?? null,
  });
  await db
    .update(forms)
    .set({ updatedAt: new Date() })
    .where(eq(forms.id, args.formId));
  const [row] = await db
    .select()
    .from(formQuestions)
    .where(eq(formQuestions.id, id))
    .limit(1);
  return row;
}

export async function updateQuestion(
  id: string,
  patch: Partial<{
    type: FormQuestionType;
    prompt: string;
    helperText: string | null;
    required: boolean;
    options: FormQuestionOption[] | null;
    config: FormQuestionConfig | null;
    order: number;
  }>
) {
  const next: Record<string, unknown> = {};
  if (patch.type !== undefined) next.type = patch.type;
  if (patch.prompt !== undefined) next.prompt = patch.prompt;
  if (patch.helperText !== undefined) next.helperText = patch.helperText;
  if (patch.required !== undefined) next.required = patch.required;
  if (patch.options !== undefined) next.options = patch.options;
  if (patch.config !== undefined) next.config = patch.config;
  if (patch.order !== undefined) next.order = patch.order;
  if (Object.keys(next).length === 0) return;
  await db.update(formQuestions).set(next).where(eq(formQuestions.id, id));

  // Bump form's updatedAt for sorting in the list.
  const [q] = await db
    .select({ formId: formQuestions.formId })
    .from(formQuestions)
    .where(eq(formQuestions.id, id))
    .limit(1);
  if (q)
    await db
      .update(forms)
      .set({ updatedAt: new Date() })
      .where(eq(forms.id, q.formId));
}

export async function deleteQuestion(id: string) {
  const [q] = await db
    .select({ formId: formQuestions.formId })
    .from(formQuestions)
    .where(eq(formQuestions.id, id))
    .limit(1);
  await db.delete(formQuestions).where(eq(formQuestions.id, id));
  if (q)
    await db
      .update(forms)
      .set({ updatedAt: new Date() })
      .where(eq(forms.id, q.formId));
}

// Reorder a question by setting a new explicit order. Other questions get
// renumbered to keep them dense (1..N).
export async function reorderQuestions(formId: string, idsInOrder: string[]) {
  for (let i = 0; i < idsInOrder.length; i++) {
    await db
      .update(formQuestions)
      .set({ order: i + 1 })
      .where(
        and(
          eq(formQuestions.id, idsInOrder[i]),
          eq(formQuestions.formId, formId)
        )
      );
  }
  await db
    .update(forms)
    .set({ updatedAt: new Date() })
    .where(eq(forms.id, formId));
}

// ─── writes — submissions ──────────────────────────────────────────────

export async function recordSubmission(args: {
  formId: string;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  answers: Record<string, AnswerValue>;
}) {
  const submissionId = makeId();
  await db.insert(formSubmissions).values({
    id: submissionId,
    formId: args.formId,
    userId: args.userId ?? null,
    ip: args.ip ?? null,
    userAgent: args.userAgent ?? null,
    answersJson: args.answers,
  });
  // Materialise per-question rows for easy joins/queries.
  const rows = Object.entries(args.answers).map(([questionId, value]) => ({
    id: makeId(),
    submissionId,
    questionId,
    value: value as unknown,
  }));
  if (rows.length > 0) await db.insert(formAnswers).values(rows);
  return submissionId;
}

export async function userHasSubmitted(args: {
  formId: string;
  userId: string;
}): Promise<boolean> {
  const [row] = await db
    .select({ id: formSubmissions.id })
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.formId, args.formId),
        eq(formSubmissions.userId, args.userId)
      )
    )
    .limit(1);
  return !!row;
}
