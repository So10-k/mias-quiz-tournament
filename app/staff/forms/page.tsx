import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { requireStaff } from "@/lib/staff-auth";
import { staffCan } from "@/lib/staff-permissions";
import { logStaffAction } from "@/lib/staff-audit";
import { listForms, createForm } from "@/lib/forms";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function newFormAction(formData: FormData) {
  "use server";
  const me = await requireStaff({
    next: "/staff/forms",
    permission: "forms:write",
  });
  const title = String(formData.get("title") ?? "").trim() || "Untitled form";
  const { id } = await createForm({
    title,
    createdByStaffId: me.id,
  });
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "form.created",
    target: title,
    details: { formId: id },
  });
  revalidatePath("/staff/forms");
  redirect(`/staff/forms/${id}`);
}

export default async function StaffFormsPage() {
  const me = await requireStaff({
    next: "/staff/forms",
    permission: "forms:read",
  });
  const canWrite = staffCan(me.role, "forms:write");
  const forms = await listForms();

  return (
    <Stage scrollable>
      <div className="max-w-4xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl text-navy">📝 Forms</h1>
            <p className="font-body text-xs text-navy-soft mt-1">
              Custom typeform-style forms. Public forms live at
              quiz.miaswebsites.art/forms/&lt;slug&gt;.
            </p>
          </div>
          <Link href="/staff" className="pop pop-white text-sm">
            ← Overview
          </Link>
        </div>

        {canWrite ? (
          <form
            action={newFormAction}
            className="card-sm bg-white px-5 py-3 flex items-center gap-3 flex-wrap"
          >
            <input
              name="title"
              placeholder="New form title"
              className="card-sm bg-white px-3 py-2 flex-1 min-w-[16ch] text-base font-body"
              maxLength={120}
            />
            <button className="pop pop-coral text-sm">+ New form</button>
          </form>
        ) : null}

        <section className="card px-3 py-3">
          {forms.length === 0 ? (
            <p className="font-body text-sm text-navy-soft px-3 py-3">
              No forms yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-navy/10">
              {forms.map((f) => {
                const statusBadge =
                  f.status === "published"
                    ? "bg-grass text-white"
                    : f.status === "closed"
                      ? "bg-coral-deep text-white"
                      : "bg-sun text-navy";
                return (
                  <li
                    key={f.id}
                    className="py-3 px-2 flex flex-wrap items-center gap-3"
                  >
                    <Link
                      href={`/staff/forms/${f.id}`}
                      className="flex-1 min-w-0"
                    >
                      <p className="font-display text-base text-navy truncate">
                        {f.title}
                      </p>
                      <p className="font-body text-xs text-navy-soft truncate">
                        /forms/{f.slug} ·{" "}
                        {f.requireAuth ? "🔐 auth required" : "open"} ·{" "}
                        {f.submissionCount} response
                        {f.submissionCount === 1 ? "" : "s"}
                      </p>
                    </Link>
                    <span
                      className={
                        "font-display text-xs px-2 py-0.5 rounded-md border-2 border-navy " +
                        statusBadge
                      }
                    >
                      {f.status}
                    </span>
                    {f.status === "published" ? (
                      <a
                        href={`/forms/${f.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="pop pop-white text-xs"
                      >
                        view ↗
                      </a>
                    ) : null}
                    <Link
                      href={`/staff/forms/${f.id}/responses`}
                      className="pop pop-sky text-xs"
                    >
                      responses
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Stage>
  );
}
