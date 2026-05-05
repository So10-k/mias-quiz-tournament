"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { currentUser } from "@/lib/session";
import {
  getFormBySlug,
  listQuestions,
  recordSubmission,
  userHasSubmitted,
  type AnswerValue,
} from "@/lib/forms";

// Submit action for the public typeform-style runner. Reads each answer
// from the form data (key = "q:<questionId>"), validates required fields,
// records the submission, and redirects to the thank-you screen.
//
// Auth + one-per-user rules are enforced both here AND on the page that
// renders the form — defense in depth so a hand-rolled POST can't bypass.

export async function submitFormAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) redirect("/");
  const form = await getFormBySlug(slug);
  if (!form) redirect("/");
  if (form.status !== "published") {
    redirect(`/forms/${slug}`);
  }
  const me = await currentUser();
  if (form.requireAuth && !me) {
    redirect(`/signin?next=/forms/${slug}`);
  }
  if (form.requireAuth && form.oneSubmissionPerUser && me) {
    const already = await userHasSubmitted({
      formId: form.id,
      userId: me.id,
    });
    if (already) {
      redirect(`/forms/${slug}`);
    }
  }

  const questions = await listQuestions(form.id);
  const answers: Record<string, AnswerValue> = {};
  for (const q of questions) {
    const key = `q:${q.id}`;
    if (q.type === "multi_select") {
      // Checkboxes — getAll grabs every checked value.
      const all = formData.getAll(key).map((v) => String(v));
      answers[q.id] = all.length > 0 ? all : null;
    } else if (q.type === "yes_no") {
      const v = formData.get(key);
      answers[q.id] = v == null ? null : v === "yes";
    } else if (q.type === "scale") {
      const v = formData.get(key);
      const n = v == null ? null : Number(v);
      answers[q.id] = n == null || !Number.isFinite(n) ? null : n;
    } else if (q.type === "statement") {
      // Statements have no answer; record null so the question still
      // shows up in the answersJson keys for completeness.
      answers[q.id] = null;
    } else {
      const v = formData.get(key);
      answers[q.id] = v == null ? null : String(v).trim() || null;
    }

    // Required validation. If a required question is empty, redirect
    // back with an error flag rather than silently submitting.
    if (q.required && q.type !== "statement") {
      const v = answers[q.id];
      const empty =
        v == null ||
        (typeof v === "string" && v.length === 0) ||
        (Array.isArray(v) && v.length === 0);
      if (empty) {
        redirect(`/forms/${slug}?missing=${q.id}`);
      }
    }
  }

  const h = await headers();
  const ip =
    h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? null;
  const ua = h.get("user-agent");

  await recordSubmission({
    formId: form.id,
    userId: me?.id ?? null,
    ip,
    userAgent: ua,
    answers,
  });

  redirect(`/forms/${slug}?done=1`);
}
