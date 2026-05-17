"use server";

// Server actions for the form editor. Each one:
//   1. Gates on staff perms via requireStaff
//   2. Calls a lib/forms.ts helper
//   3. Logs to staff_actions
//   4. Revalidates the editor page

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/staff-auth";
import { logStaffAction } from "@/lib/staff-audit";
import {
  addQuestion,
  deleteQuestion,
  deleteForm,
  reorderQuestions,
  updateForm,
  updateQuestion,
  type FormQuestionType,
} from "@/lib/forms";

const VALID_TYPES: FormQuestionType[] = [
  "short_text",
  "long_text",
  "email",
  "single_select",
  "multi_select",
  "yes_no",
  "scale",
  "statement",
];

function bumpEditor(formId: string) {
  revalidatePath(`/staff/forms/${formId}`);
  revalidatePath(`/staff/forms`);
}

export async function saveFormMetaAction(formData: FormData) {
  const me = await requireStaff({
    next: "/staff/forms",
    permission: "forms:write",
  });
  const formId = String(formData.get("formId") ?? "");
  if (!formId) return;
  const title = String(formData.get("title") ?? "").trim();
  const intro = String(formData.get("intro") ?? "").trim();
  const outro = String(formData.get("outro") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const requireAuth = formData.get("requireAuth") === "yes";
  const oneSubmissionPerUser = formData.get("oneSubmissionPerUser") === "yes";

  await updateForm(formId, {
    title: title || "Untitled form",
    intro: intro || null,
    outro: outro || null,
    slug: slug || undefined,
    requireAuth,
    oneSubmissionPerUser,
  });
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "form.meta_saved",
    target: title.slice(0, 60),
    details: { formId, requireAuth, oneSubmissionPerUser },
  });
  bumpEditor(formId);
}

export async function setStatusAction(formData: FormData) {
  const me = await requireStaff({
    next: "/staff/forms",
    permission: "forms:write",
  });
  const formId = String(formData.get("formId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!formId) return;
  if (
    status !== "draft" &&
    status !== "published" &&
    status !== "closed"
  )
    return;
  await updateForm(formId, { status });
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "form.status_changed",
    target: formId,
    details: { status },
  });
  bumpEditor(formId);
}

export async function addQuestionAction(formData: FormData) {
  const me = await requireStaff({
    next: "/staff/forms",
    permission: "forms:write",
  });
  const formId = String(formData.get("formId") ?? "");
  const typeRaw = String(formData.get("type") ?? "short_text");
  const type = (VALID_TYPES.includes(typeRaw as FormQuestionType)
    ? typeRaw
    : "short_text") as FormQuestionType;
  const prompt = String(formData.get("prompt") ?? "").trim();
  const helperText = String(formData.get("helperText") ?? "").trim();
  const required = formData.get("required") !== "no";
  if (!formId || !prompt) return;

  // Parse "options" as one-per-line strings for choice-type questions.
  let options:
    | { label: string; value: string }[]
    | undefined = undefined;
  if (type === "single_select" || type === "multi_select") {
    const rawLines = String(formData.get("options") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    options = rawLines.map((label) => ({
      label,
      // Stable value = label, lowercased + collapsed; good enough for now.
      value: label.toLowerCase().replace(/\s+/g, "_").slice(0, 64),
    }));
  }

  // Scale config — defaults to 1..5 if not provided.
  let config: Record<string, unknown> | undefined = undefined;
  if (type === "scale") {
    const minRaw = Number(formData.get("scaleMin") ?? 1);
    const maxRaw = Number(formData.get("scaleMax") ?? 5);
    config = {
      scaleMin: Number.isFinite(minRaw) ? minRaw : 1,
      scaleMax: Number.isFinite(maxRaw) ? maxRaw : 5,
      scaleMinLabel:
        String(formData.get("scaleMinLabel") ?? "").trim() || undefined,
      scaleMaxLabel:
        String(formData.get("scaleMaxLabel") ?? "").trim() || undefined,
    };
  }

  const q = await addQuestion({
    formId,
    type,
    prompt,
    helperText: helperText || null,
    required,
    options: options ?? null,
    config: config ?? null,
  });
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "form.question_added",
    target: formId,
    details: { questionId: q.id, type },
  });
  bumpEditor(formId);
}

export async function deleteQuestionAction(formData: FormData) {
  const me = await requireStaff({
    next: "/staff/forms",
    permission: "forms:write",
  });
  const questionId = String(formData.get("questionId") ?? "");
  const formId = String(formData.get("formId") ?? "");
  if (!questionId) return;
  await deleteQuestion(questionId);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "form.question_deleted",
    target: formId,
    details: { questionId },
  });
  bumpEditor(formId);
}

export async function moveQuestionAction(formData: FormData) {
  const me = await requireStaff({
    next: "/staff/forms",
    permission: "forms:write",
  });
  const formId = String(formData.get("formId") ?? "");
  const direction = String(formData.get("direction") ?? "up");
  const questionId = String(formData.get("questionId") ?? "");
  if (!formId || !questionId) return;

  const { listQuestions } = await import("@/lib/forms");
  const qs = await listQuestions(formId);
  const idx = qs.findIndex((q) => q.id === questionId);
  if (idx === -1) return;
  const targetIdx =
    direction === "down" ? Math.min(qs.length - 1, idx + 1) : Math.max(0, idx - 1);
  if (targetIdx === idx) return;
  const reordered = [...qs];
  const [moved] = reordered.splice(idx, 1);
  reordered.splice(targetIdx, 0, moved);
  await reorderQuestions(
    formId,
    reordered.map((q) => q.id)
  );
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "form.question_reordered",
    target: formId,
    details: { questionId, direction },
  });
  bumpEditor(formId);
}

export async function updateQuestionAction(formData: FormData) {
  const me = await requireStaff({
    next: "/staff/forms",
    permission: "forms:write",
  });
  const questionId = String(formData.get("questionId") ?? "");
  const formId = String(formData.get("formId") ?? "");
  const prompt = String(formData.get("prompt") ?? "").trim();
  const helperText = String(formData.get("helperText") ?? "").trim();
  const required = formData.get("required") !== "no";
  if (!questionId) return;
  await updateQuestion(questionId, {
    prompt: prompt || undefined,
    helperText: helperText || null,
    required,
  });
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "form.question_updated",
    target: formId,
    details: { questionId },
  });
  bumpEditor(formId);
}

export async function deleteFormAction(formData: FormData) {
  const me = await requireStaff({
    next: "/staff/forms",
    permission: "forms:write",
  });
  const formId = String(formData.get("formId") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!formId || confirm !== "yes") {
    redirect(`/staff/forms/${formId}?error=confirm`);
  }
  await deleteForm(formId);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "form.deleted",
    target: formId,
  });
  revalidatePath("/staff/forms");
  redirect("/staff/forms");
}
