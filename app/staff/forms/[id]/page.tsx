import Link from "next/link";
import { notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { requireStaff } from "@/lib/staff-auth";
import { staffCan } from "@/lib/staff-permissions";
import { getFormById, listQuestions, type FormQuestion } from "@/lib/forms";
import {
  saveFormMetaAction,
  setStatusAction,
  addQuestionAction,
  deleteQuestionAction,
  moveQuestionAction,
  updateQuestionAction,
  deleteFormAction,
} from "./actions";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  short_text: "Short answer",
  long_text: "Paragraph",
  email: "Email",
  single_select: "Single choice",
  multi_select: "Multiple choice",
  yes_no: "Yes / No",
  scale: "Scale (1–N)",
  statement: "Statement (no answer)",
};

export default async function StaffFormEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireStaff({
    next: `/staff/forms/${id}`,
    permission: "forms:read",
  });
  const canWrite = staffCan(me.role, "forms:write");
  const form = await getFormById(id);
  if (!form) notFound();
  const questions = await listQuestions(id);

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col gap-5 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl text-navy">
              📝 {form.title}
            </h1>
            <p className="font-body text-xs text-navy-soft mt-1">
              Public URL:{" "}
              <a
                href={`/forms/${form.slug}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                /forms/{form.slug}
              </a>{" "}
              · status <strong>{form.status}</strong>
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/staff/forms/${id}/responses`}
              className="pop pop-sky text-sm"
            >
              📊 Responses
            </Link>
            <Link href="/staff/forms" className="pop pop-white text-sm">
              ← All forms
            </Link>
          </div>
        </div>

        {/* Status switcher */}
        {canWrite ? (
          <section className="card px-5 py-4 flex flex-wrap items-center gap-3">
            <span className="font-display text-sm text-navy">Status:</span>
            {(["draft", "published", "closed"] as const).map((s) => (
              <form action={setStatusAction} key={s}>
                <input type="hidden" name="formId" value={form.id} />
                <input type="hidden" name="status" value={s} />
                <button
                  className={
                    "pop text-xs " +
                    (form.status === s ? "pop-coral" : "pop-white")
                  }
                >
                  {s}
                </button>
              </form>
            ))}
            <span className="font-body text-xs text-navy-soft ml-auto">
              {form.status === "published"
                ? "Live and accepting responses"
                : form.status === "closed"
                  ? "Visible but not accepting responses"
                  : "Hidden from the public"}
            </span>
          </section>
        ) : null}

        {/* Form metadata */}
        {canWrite ? (
          <form
            action={saveFormMetaAction}
            className="card px-5 py-5 flex flex-col gap-3"
          >
            <input type="hidden" name="formId" value={form.id} />
            <h2 className="font-display text-lg text-navy">Form details</h2>
            <label className="font-display text-sm text-navy">
              Title
              <input
                name="title"
                defaultValue={form.title}
                maxLength={120}
                required
                className="card-sm bg-white px-3 py-2 w-full mt-1 text-base font-body"
              />
            </label>
            <label className="font-display text-sm text-navy">
              Slug (URL key)
              <input
                name="slug"
                defaultValue={form.slug}
                maxLength={60}
                className="card-sm bg-white px-3 py-2 w-full mt-1 text-base font-body"
              />
              <span className="font-body text-xs text-navy-soft">
                /forms/&lt;slug&gt;. Letters, numbers, hyphens.
              </span>
            </label>
            <label className="font-display text-sm text-navy">
              Intro (shown before the first question)
              <textarea
                name="intro"
                defaultValue={form.intro ?? ""}
                rows={3}
                className="card-sm bg-white px-3 py-2 w-full mt-1 text-base font-body"
                maxLength={2000}
              />
            </label>
            <label className="font-display text-sm text-navy">
              Outro (shown after submission)
              <textarea
                name="outro"
                defaultValue={form.outro ?? ""}
                rows={2}
                className="card-sm bg-white px-3 py-2 w-full mt-1 text-base font-body"
                maxLength={2000}
              />
            </label>
            <label className="flex items-center gap-2 font-body text-sm text-navy">
              <input
                type="checkbox"
                name="requireAuth"
                value="yes"
                defaultChecked={form.requireAuth}
              />
              🔐 Require sign-in to fill (only tournament players)
            </label>
            <label className="flex items-center gap-2 font-body text-sm text-navy">
              <input
                type="checkbox"
                name="oneSubmissionPerUser"
                value="yes"
                defaultChecked={form.oneSubmissionPerUser}
              />
              One submission per signed-in player (requires sign-in)
            </label>
            <button className="pop pop-grass text-sm self-start">
              💾 Save details
            </button>
          </form>
        ) : null}

        {/* Questions list */}
        <section className="card px-5 py-5 flex flex-col gap-3">
          <h2 className="font-display text-lg text-navy">
            Questions ({questions.length})
          </h2>
          {questions.length === 0 ? (
            <p className="font-body text-sm text-navy-soft">
              No questions yet. Add one below.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {questions.map((q, i) => (
                <li
                  key={q.id}
                  className="card-sm bg-white px-4 py-3 flex flex-col gap-2"
                >
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <p className="font-display text-base text-navy flex-1 min-w-0">
                      <span className="text-coral-deep mr-2">{i + 1}.</span>
                      {q.prompt}
                      {q.required ? (
                        <span className="text-coral-deep ml-1">*</span>
                      ) : null}
                    </p>
                    <span className="font-body text-xs text-navy-soft">
                      {TYPE_LABELS[q.type] ?? q.type}
                    </span>
                  </div>
                  {q.helperText ? (
                    <p className="font-body text-xs text-navy-soft italic">
                      {q.helperText}
                    </p>
                  ) : null}
                  {q.options && q.options.length > 0 ? (
                    <ul className="font-body text-xs text-navy-soft list-disc pl-5">
                      {q.options.map((o, oi) => (
                        <li key={oi}>{o.label}</li>
                      ))}
                    </ul>
                  ) : null}
                  {q.type === "scale" && q.config ? (
                    <p className="font-body text-xs text-navy-soft">
                      Scale {(q.config as ScaleCfg).scaleMin ?? 1} →{" "}
                      {(q.config as ScaleCfg).scaleMax ?? 5}
                      {(q.config as ScaleCfg).scaleMinLabel
                        ? ` · "${(q.config as ScaleCfg).scaleMinLabel}"`
                        : ""}
                      {(q.config as ScaleCfg).scaleMaxLabel
                        ? ` → "${(q.config as ScaleCfg).scaleMaxLabel}"`
                        : ""}
                    </p>
                  ) : null}
                  {canWrite ? (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <form action={moveQuestionAction}>
                        <input type="hidden" name="formId" value={form.id} />
                        <input type="hidden" name="questionId" value={q.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button
                          className="pop pop-white text-xs"
                          disabled={i === 0}
                        >
                          ↑
                        </button>
                      </form>
                      <form action={moveQuestionAction}>
                        <input type="hidden" name="formId" value={form.id} />
                        <input type="hidden" name="questionId" value={q.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          className="pop pop-white text-xs"
                          disabled={i === questions.length - 1}
                        >
                          ↓
                        </button>
                      </form>
                      <details className="ml-2">
                        <summary className="cursor-pointer font-body text-xs text-navy-soft">
                          ✏️ edit
                        </summary>
                        <form
                          action={updateQuestionAction}
                          className="mt-2 flex flex-col gap-2"
                        >
                          <input
                            type="hidden"
                            name="questionId"
                            value={q.id}
                          />
                          <input type="hidden" name="formId" value={form.id} />
                          <input
                            name="prompt"
                            defaultValue={q.prompt}
                            className="card-sm bg-white px-3 py-2 text-sm font-body"
                            maxLength={400}
                          />
                          <input
                            name="helperText"
                            defaultValue={q.helperText ?? ""}
                            placeholder="Helper text (optional)"
                            className="card-sm bg-white px-3 py-2 text-sm font-body"
                            maxLength={400}
                          />
                          <label className="flex items-center gap-2 font-body text-xs text-navy">
                            <input
                              type="checkbox"
                              name="required"
                              value="yes"
                              defaultChecked={q.required}
                            />
                            Required
                          </label>
                          <button className="pop pop-grass text-xs self-start">
                            💾 Save
                          </button>
                        </form>
                      </details>
                      <form action={deleteQuestionAction} className="ml-auto">
                        <input type="hidden" name="formId" value={form.id} />
                        <input type="hidden" name="questionId" value={q.id} />
                        <button className="pop pop-coral text-xs">
                          🗑 delete
                        </button>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {canWrite ? <AddQuestionForm formId={form.id} /> : null}
        </section>

        {/* Danger zone */}
        {canWrite ? (
          <details className="card-sm bg-white px-5 py-3">
            <summary className="cursor-pointer font-display text-sm text-coral-deep">
              ⚠️ Delete this form
            </summary>
            <form action={deleteFormAction} className="mt-3 flex gap-2">
              <input type="hidden" name="formId" value={form.id} />
              <input type="hidden" name="confirm" value="yes" />
              <button className="pop pop-coral text-xs">
                Delete form + all responses
              </button>
            </form>
          </details>
        ) : null}
      </div>
    </Stage>
  );
}

type ScaleCfg = {
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
};

function AddQuestionForm({ formId }: { formId: string }) {
  return (
    <form
      action={addQuestionAction}
      className="card-sm bg-sky1 px-4 py-4 flex flex-col gap-2 mt-2"
    >
      <p className="font-display text-sm text-navy">+ Add a question</p>
      <input type="hidden" name="formId" value={formId} />
      <select
        name="type"
        defaultValue="short_text"
        className="card-sm bg-white px-3 py-2 text-sm font-body"
      >
        {Object.entries(TYPE_LABELS).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
      <input
        name="prompt"
        placeholder="Prompt (e.g. What's your favorite quiz topic?)"
        required
        maxLength={400}
        className="card-sm bg-white px-3 py-2 text-sm font-body"
      />
      <input
        name="helperText"
        placeholder="Helper text (optional)"
        maxLength={400}
        className="card-sm bg-white px-3 py-2 text-sm font-body"
      />
      <label className="flex items-center gap-2 font-body text-xs text-navy">
        <input type="checkbox" name="required" value="yes" defaultChecked />
        Required
      </label>
      <details>
        <summary className="cursor-pointer font-body text-xs text-navy-soft">
          Choices (only for single/multiple choice)
        </summary>
        <textarea
          name="options"
          rows={4}
          placeholder="One option per line:&#10;Option A&#10;Option B&#10;Option C"
          className="card-sm bg-white px-3 py-2 w-full mt-2 text-sm font-body"
          maxLength={2000}
        />
      </details>
      <details>
        <summary className="cursor-pointer font-body text-xs text-navy-soft">
          Scale config (only for scale)
        </summary>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input
            name="scaleMin"
            type="number"
            defaultValue="1"
            placeholder="min"
            className="card-sm bg-white px-3 py-2 text-sm font-body"
          />
          <input
            name="scaleMax"
            type="number"
            defaultValue="5"
            placeholder="max"
            className="card-sm bg-white px-3 py-2 text-sm font-body"
          />
          <input
            name="scaleMinLabel"
            placeholder="Min label (e.g. Hate)"
            maxLength={40}
            className="card-sm bg-white px-3 py-2 text-sm font-body"
          />
          <input
            name="scaleMaxLabel"
            placeholder="Max label (e.g. Love)"
            maxLength={40}
            className="card-sm bg-white px-3 py-2 text-sm font-body"
          />
        </div>
      </details>
      <button className="pop pop-coral text-sm self-start">+ Add</button>
    </form>
  );
}
