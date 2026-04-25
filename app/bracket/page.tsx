import Link from "next/link";
import { Stage } from "@/components/Stage";
import { BracketView } from "@/components/BracketView";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import {
  getBracket,
  getBracketUsers,
  getBracketChampionId,
} from "@/lib/bracket";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
  const t =
    (await getActiveTournament()) ?? (await getLatestTournament());

  if (!t) {
    return (
      <Stage>
        <div className="h-[calc(100vh-128px)] flex items-center justify-center px-4">
          <div className="card px-7 py-7 text-center max-w-md">
            <div className="text-6xl">🎟️</div>
            <h1 className="font-display text-3xl text-navy mt-3">
              No bracket yet!
            </h1>
            <Link href="/" className="pop pop-coral mt-5">
              ← Home
            </Link>
          </div>
        </div>
      </Stage>
    );
  }

  const rounds = await getBracket(t.id);
  const users = await getBracketUsers(t.id);
  const championId = await getBracketChampionId(t.id);

  return (
    <Stage scrollable>
      <div className="max-w-6xl mx-auto pt-4 px-4 flex flex-col gap-5">
        <div className="card-sm px-5 py-3 flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl md:text-4xl text-navy">
            🎟️ Bracket
          </h1>
          <div className="flex gap-2">
            <Link href="/standings" className="pop pop-white text-sm">
              🏅 Standings
            </Link>
            <Link href="/play" className="pop pop-coral text-sm">
              ▶ Play
            </Link>
          </div>
        </div>

        <div className="card px-5 py-5">
          <BracketView rounds={rounds} users={users} championId={championId} />
        </div>
      </div>
    </Stage>
  );
}
