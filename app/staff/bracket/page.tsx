import Link from "next/link";
import { Stage } from "@/components/Stage";
import { BracketView } from "@/components/BracketView";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import { getBracket, getBracketUsers } from "@/lib/bracket";
import { requireStaff } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export default async function StaffBracketPage() {
  await requireStaff({ next: "/staff/bracket", permission: "bracket:read" });

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
  const [main, losers, users] = await Promise.all([
    getBracket(t.id, "main"),
    getBracket(t.id, "losers"),
    getBracketUsers(t.id),
  ]);
  return (
    <Stage scrollable>
      <div className="max-w-6xl mx-auto pt-4 px-4 flex flex-col gap-5 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">🏆 Bracket</h1>
          <Link href="/staff" className="pop pop-white text-sm">
            ← Staff
          </Link>
        </div>
        <div className="card px-5 py-5">
          <h2 className="font-display text-xl text-navy mb-3">Main bracket</h2>
          <BracketView rounds={main} users={users} />
        </div>
        {losers.length > 0 ? (
          <div className="card px-5 py-5">
            <h2 className="font-display text-xl text-coral-deep mb-3">
              Losers bracket
            </h2>
            <BracketView rounds={losers} users={users} />
          </div>
        ) : null}
      </div>
    </Stage>
  );
}
