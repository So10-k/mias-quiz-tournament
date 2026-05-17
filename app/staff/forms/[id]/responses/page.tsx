import Link from "next/link";
import { notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { requireStaff } from "@/lib/staff-auth";
import { getFormById, listQuestions, listSubmissions } from "@/lib/forms";
import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function FormResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireStaff({
    next: `/staff/forms/${id}/responses`,
    permission: "forms:read",
  });

  const form = await getFormById(id);
  if (!form) notFound();

  const [questions, submissions] = await Promise.all([
    listQuestions(id),
    listSubmissions(id),
  ]);

  // Resolve user names for authed submissions in one shot.
  const userIds = [
    ...new Set(submissions.map((s) => s.userId).filter(Boolean) as string[]),
  ];
  const users =
    userIds.length === 0
      ? []
      : await db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
          })
          .from(schema.users)
          .where(inArray(schema.users.id, userIds));
  const userMap = new Map(users.map((u) => [u.id, u]));

  return (
    <Stage scrollable>
      <div className="max-w-6xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl text-navy">
              📊 Responses · {form.title}
            </h1>
            <p className="font-body text-xs text-navy-soft mt-1">
              {submissions.length} submission
              {submissions.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/staff/forms/${id}`} className="pop pop-white text-sm">
              ← Editor
            </Link>
          </div>
        </div>

        <section className="card px-3 py-2">
          {submissions.length === 0 ? (
            <p className="font-body text-sm text-navy-soft px-3 py-3">
              No responses yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-navy-soft">
                  <th className="px-2 py-2 font-display whitespace-nowrap">
                    When
                  </th>
                  <th className="px-2 py-2 font-display">Who</th>
                  {questions.map((q) => (
                    <th
                      key={q.id}
                      className="px-2 py-2 font-display max-w-[20ch] truncate"
                      title={q.prompt}
                    >
                      {q.prompt}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => {
                  const u = s.userId ? userMap.get(s.userId) : null;
                  const answers = (s.answersJson ?? {}) as Record<
                    string,
                    string | string[] | number | boolean | null
                  >;
                  return (
                    <tr key={s.id} className="border-t border-navy/10">
                      <td className="px-2 py-2 font-body text-xs text-navy-soft whitespace-nowrap">
                        {s.submittedAt.toLocaleString()}
                      </td>
                      <td className="px-2 py-2 font-body text-xs text-navy truncate max-w-[18ch]">
                        {u
                          ? (u.name ?? u.email ?? u.id)
                          : "(anonymous)"}
                      </td>
                      {questions.map((q) => {
                        const v = answers[q.id];
                        return (
                          <td
                            key={q.id}
                            className="px-2 py-2 font-body text-xs text-navy max-w-[24ch] truncate"
                            title={
                              v == null
                                ? ""
                                : Array.isArray(v)
                                  ? v.join(", ")
                                  : String(v)
                            }
                          >
                            {v == null
                              ? <span className="text-navy-soft italic">—</span>
                              : Array.isArray(v)
                                ? v.join(", ")
                                : typeof v === "boolean"
                                  ? v ? "yes" : "no"
                                  : String(v)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </Stage>
  );
}
