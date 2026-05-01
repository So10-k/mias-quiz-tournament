import Link from "next/link";
import { Stage } from "@/components/Stage";
import { AutoRefresh } from "@/components/AutoRefresh";
import { requireStaff } from "@/lib/staff-auth";
import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function StaffAttemptsPage() {
  await requireStaff({
    next: "/staff/attempts",
    permission: "attempts:read",
  });

  const rows = await db
    .select({
      id: schema.attempts.id,
      userId: schema.attempts.userId,
      roundId: schema.attempts.roundId,
      score: schema.attempts.score,
      submittedAt: schema.attempts.submittedAt,
      userName: schema.users.name,
      userEmail: schema.users.email,
      chapterNumber: schema.rounds.chapterNumber,
      roundTitle: schema.rounds.title,
    })
    .from(schema.attempts)
    .innerJoin(schema.users, eq(schema.users.id, schema.attempts.userId))
    .innerJoin(schema.rounds, eq(schema.rounds.id, schema.attempts.roundId))
    .orderBy(desc(schema.attempts.submittedAt))
    .limit(200);

  return (
    <Stage scrollable>
      <AutoRefresh seconds={8} />
      <div className="max-w-5xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">📝 Attempts</h1>
          <Link href="/staff" className="pop pop-white text-sm">
            ← Overview
          </Link>
        </div>
        <section className="card px-3 py-2">
          {rows.length === 0 ? (
            <p className="font-body text-sm text-navy-soft px-3 py-3">
              No attempts yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-navy-soft">
                  <th className="px-2 py-2 font-display">When</th>
                  <th className="px-2 py-2 font-display">Player</th>
                  <th className="px-2 py-2 font-display">Chapter</th>
                  <th className="px-2 py-2 font-display text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-navy/10">
                    <td className="px-2 py-2 font-body text-xs text-navy-soft whitespace-nowrap">
                      {r.submittedAt
                        ? r.submittedAt.toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-2 py-2 font-body text-sm text-navy truncate max-w-[24ch]">
                      {r.userName ?? r.userEmail ?? "—"}
                    </td>
                    <td className="px-2 py-2 font-body text-sm text-navy truncate max-w-[28ch]">
                      📖 {r.chapterNumber}
                      {r.roundTitle ? ` · ${r.roundTitle}` : ""}
                    </td>
                    <td className="px-2 py-2 font-display text-sm text-navy text-right">
                      {Number(r.score ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </Stage>
  );
}
