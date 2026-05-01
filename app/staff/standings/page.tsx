import Link from "next/link";
import { Stage } from "@/components/Stage";
import {
  getActiveTournament,
  getLatestTournament,
  getCast,
} from "@/lib/engine";
import { requireStaff } from "@/lib/staff-auth";
import { db, schema } from "@/db";
import { eq, asc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function StaffStandingsPage() {
  await requireStaff({
    next: "/staff/standings",
    permission: "standings:read",
  });
  const t =
    (await getActiveTournament()) ?? (await getLatestTournament());
  if (!t) {
    return (
      <Stage>
        <div className="max-w-2xl mx-auto pt-9">
          <div className="card px-7 py-7 text-center">
            <p className="font-display text-2xl text-navy">No tournament.</p>
          </div>
        </div>
      </Stage>
    );
  }
  const cast = await getCast(t.id);
  const rounds = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.tournamentId, t.id))
    .orderBy(asc(schema.rounds.chapterNumber));
  const totals = new Map<string, number>();
  if (rounds.length > 0) {
    const all = await db
      .select()
      .from(schema.attempts)
      .where(
        inArray(
          schema.attempts.roundId,
          rounds.map((r) => r.id)
        )
      );
    for (const a of all) {
      totals.set(
        a.userId,
        (totals.get(a.userId) ?? 0) + Number(a.score ?? 0)
      );
    }
  }
  const ranked = cast
    .map((c) => ({ ...c, total: totals.get(c.user.id) ?? 0 }))
    .sort((a, b) => b.total - a.total);
  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">📊 Standings</h1>
          <Link href="/staff" className="pop pop-white text-sm">
            ← Staff
          </Link>
        </div>
        <ol className="flex flex-col gap-2">
          {ranked.map((r, i) => (
            <li
              key={r.enrollment.id}
              className={
                "card-sm px-4 py-3 flex items-center gap-3 " +
                (r.enrollment.eliminatedAt ? "opacity-70 bg-white" : "bg-white")
              }
            >
              <span className="font-display text-lg text-navy w-8 text-right">
                {i + 1}.
              </span>
              <span className="font-display text-base text-navy flex-1 min-w-0 truncate">
                {r.user.name ?? r.user.email ?? "—"}
              </span>
              <span className="font-display text-base text-navy">
                {r.total.toFixed(2)}
              </span>
              {r.enrollment.eliminatedAt ? (
                <span className="font-display text-xs px-2 py-0.5 rounded-md border-2 border-navy bg-coral-deep text-white">
                  out
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </Stage>
  );
}
