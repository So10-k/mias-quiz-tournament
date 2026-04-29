import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { AutoRefresh } from "@/components/AutoRefresh";
import { currentUser } from "@/lib/session";
import { db, schema } from "@/db";
import { desc, eq, inArray, isNotNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AttemptsListPage() {
  const me = await currentUser();
  if (!me) redirect("/signin");
  if (me.role !== "author") redirect("/play");

  // Last 50 SUBMITTED attempts across all tournaments.
  const recent = await db
    .select()
    .from(schema.attempts)
    .where(isNotNull(schema.attempts.submittedAt))
    .orderBy(desc(schema.attempts.submittedAt))
    .limit(50);

  const userIds = [...new Set(recent.map((a) => a.userId))];
  const roundIds = [...new Set(recent.map((a) => a.roundId))];
  const [users, rounds] = await Promise.all([
    userIds.length === 0
      ? []
      : db
          .select()
          .from(schema.users)
          .where(inArray(schema.users.id, userIds)),
    roundIds.length === 0
      ? []
      : db
          .select()
          .from(schema.rounds)
          .where(inArray(schema.rounds.id, roundIds)),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const roundById = new Map(rounds.map((r) => [r.id, r]));

  return (
    <Stage scrollable>
      <AutoRefresh seconds={8} />
      <div className="max-w-5xl mx-auto pt-4 px-4 flex flex-col gap-4">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">📡 Attempts feed</h1>
          <div className="flex gap-2 items-baseline">
            <span className="font-body text-xs text-navy-soft">
              auto-refreshes every 8s · last 50 submissions
            </span>
            <Link href="/host" className="pop pop-white text-sm">
              ← Host
            </Link>
          </div>
        </div>

        {recent.length === 0 ? (
          <div className="card px-7 py-7 text-center">
            <div className="text-4xl">📭</div>
            <p className="font-display text-xl text-navy mt-3">
              No submissions yet.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((a) => {
              const u = userById.get(a.userId);
              const r = roundById.get(a.roundId);
              const passed = a.passed === true;
              const failed = a.passed === false;
              const when = a.submittedAt
                ? new Date(a.submittedAt).toLocaleString()
                : "—";
              return (
                <li
                  key={a.id}
                  className="card-sm bg-white px-4 py-3 flex items-center gap-3 flex-wrap"
                >
                  <div
                    className={
                      "w-3 h-3 rounded-full flex-shrink-0 " +
                      (passed
                        ? "bg-grass"
                        : failed
                        ? "bg-coral-deep"
                        : "bg-sun")
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-base text-navy truncate">
                      {u?.name ?? u?.email ?? "—"}
                    </p>
                    <p className="font-body text-xs text-navy-soft truncate">
                      {r?.isPractice ? "🎯 Practice" : "Round"} {r?.chapterNumber} ·{" "}
                      {r?.title ?? "—"}
                    </p>
                  </div>
                  <span
                    className={
                      "font-display text-sm px-2 py-1 rounded-md border-2 border-navy " +
                      (passed
                        ? "bg-grass text-white"
                        : failed
                        ? "bg-coral-deep text-white"
                        : "bg-sun text-navy")
                    }
                  >
                    {passed ? "✓ pass" : failed ? "✗ fail" : "—"}
                  </span>
                  <span className="font-display text-base text-navy w-16 text-right">
                    {(Number(a.score ?? 0) * 100).toFixed(0)}%
                  </span>
                  <span className="font-body text-xs text-navy-soft hidden md:inline">
                    {when}
                  </span>
                  <Link
                    href={`/host/attempts/${a.id}`}
                    className="pop pop-coral text-xs"
                  >
                    Inspect →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Stage>
  );
}
