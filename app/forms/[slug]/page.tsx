import { notFound, redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import {
  getFormBySlug,
  listQuestions,
  userHasSubmitted,
  type FormQuestion,
} from "@/lib/forms";
import { FormRunner } from "@/components/forms/FormRunner";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const form = await getFormBySlug(slug);
  if (!form) notFound();
  if (form.status === "draft") notFound();

  // Auth gate. Forms can require sign-in; if so, bounce unauthenticated
  // visitors to /signin with a return URL so they land back here.
  const me = await currentUser();
  if (form.requireAuth && !me) {
    redirect(`/signin?next=/forms/${form.slug}`);
  }

  // One-submission-per-user check.
  if (form.requireAuth && form.oneSubmissionPerUser && me) {
    const already = await userHasSubmitted({ formId: form.id, userId: me.id });
    if (already && sp.done !== "1") {
      return (
        <Stage>
          <div className="min-h-[calc(100vh-128px)] flex items-center justify-center px-4 py-8">
            <div className="card max-w-md w-full px-7 py-9 text-center">
              <p className="text-5xl">📬</p>
              <h1 className="font-display text-3xl text-navy mt-3">
                You&rsquo;ve already submitted this form
              </h1>
              <p className="font-body text-base text-navy-soft mt-3">
                Thanks for filling it in. The author only accepts one
                response per player.
              </p>
              <Link href="/play" className="pop pop-coral mt-6 inline-flex">
                ← Back to play
              </Link>
            </div>
          </div>
        </Stage>
      );
    }
  }

  if (form.status === "closed") {
    return (
      <Stage>
        <div className="min-h-[calc(100vh-128px)] flex items-center justify-center px-4 py-8">
          <div className="card max-w-md w-full px-7 py-9 text-center">
            <p className="text-5xl">🔒</p>
            <h1 className="font-display text-3xl text-navy mt-3">
              This form is closed
            </h1>
            <p className="font-body text-base text-navy-soft mt-3">
              {form.outro?.trim() ||
                "It's no longer accepting responses. Thanks for stopping by."}
            </p>
          </div>
        </div>
      </Stage>
    );
  }

  if (sp.done === "1") {
    return (
      <Stage>
        <div className="min-h-[calc(100vh-128px)] flex items-center justify-center px-4 py-8">
          <div className="card max-w-md w-full px-7 py-9 text-center relative overflow-hidden">
            <span
              aria-hidden
              className="absolute -top-3 -left-3 text-3xl select-none"
              style={{ filter: "drop-shadow(2px 2px 0 var(--navy))" }}
            >
              ✨
            </span>
            <span
              aria-hidden
              className="absolute -bottom-2 -right-3 text-3xl select-none rotate-12"
              style={{ filter: "drop-shadow(2px 2px 0 var(--navy))" }}
            >
              🌞
            </span>
            <p className="text-6xl">🎉</p>
            <h1 className="font-display text-3xl text-navy mt-3">
              {form.outro?.trim() ? "Done!" : "Thanks for filling that in!"}
            </h1>
            <p className="font-body text-base text-navy-soft mt-3 whitespace-pre-line">
              {form.outro?.trim() ?? "Your answers are saved."}
            </p>
            <Link href="/" className="pop pop-coral mt-6 inline-flex">
              ← Home
            </Link>
          </div>
        </div>
      </Stage>
    );
  }

  const questions = await listQuestions(form.id);
  if (questions.length === 0) {
    return (
      <Stage>
        <div className="min-h-[calc(100vh-128px)] flex items-center justify-center px-4 py-8">
          <div className="card max-w-md w-full px-7 py-9 text-center">
            <p className="text-5xl">🤷</p>
            <h1 className="font-display text-3xl text-navy mt-3">
              No questions yet
            </h1>
            <p className="font-body text-base text-navy-soft mt-3">
              The author hasn&rsquo;t added any questions to this form.
            </p>
          </div>
        </div>
      </Stage>
    );
  }

  // Strip Date objects from questions so they're safe to pass to a client
  // component (no Date-in-RSC payload weirdness).
  const safeQuestions: PublicQuestion[] = questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    helperText: q.helperText,
    required: q.required,
    options: q.options ?? null,
    config: (q.config as PublicQuestion["config"]) ?? null,
  }));

  return (
    <Stage scrollable>
      <FormRunner
        formId={form.id}
        formTitle={form.title}
        intro={form.intro}
        questions={safeQuestions}
        slug={form.slug}
        respondentName={me?.name ?? null}
      />
    </Stage>
  );
}

export type PublicQuestion = {
  id: string;
  type: FormQuestion["type"];
  prompt: string;
  helperText: string | null;
  required: boolean;
  options: { label: string; value: string }[] | null;
  config: {
    scaleMin?: number;
    scaleMax?: number;
    scaleMinLabel?: string;
    scaleMaxLabel?: string;
    maxLength?: number;
  } | null;
};
