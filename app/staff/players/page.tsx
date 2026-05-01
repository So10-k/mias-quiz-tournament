import Link from "next/link";
import { Stage } from "@/components/Stage";
import { PlayerCard } from "@/components/PlayerCard";
import {
  getActiveTournament,
  getCast,
  getLatestTournament,
} from "@/lib/engine";
import { requireStaff } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export default async function StaffPlayersPage() {
  await requireStaff({ next: "/staff/players", permission: "players:read" });
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
  return (
    <Stage scrollable>
      <div className="max-w-5xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">👥 Players</h1>
          <Link href="/staff" className="pop pop-white text-sm">
            ← Staff
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cast.map((row) => (
            <PlayerCard
              key={row.enrollment.id}
              name={row.user.name ?? row.user.email ?? "—"}
              strikeCount={row.enrollment.strikeCount}
              strikeLimit={t.strikeLimit}
              eliminated={!!row.enrollment.eliminatedAt}
            />
          ))}
        </div>
      </div>
    </Stage>
  );
}
