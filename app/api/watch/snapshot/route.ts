// JSON snapshot endpoint for /watch — bundles the scene state, the
// active live round (if any), and bracket data into one payload so the
// client only polls one URL.
//
// No auth — /watch is a public broadcast page. (Sam screen-shares this
// into the Zoho webinar; nothing here leaks past what /watch already
// renders.)

import { NextResponse } from "next/server";
import { getWatchScene } from "@/lib/watch-scene";
import { getCurrentLiveRound, getLiveRoundState } from "@/lib/live";
import { getBracket, getBracketUsers } from "@/lib/bracket";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const [scene, activeRound, t] = await Promise.all([
    getWatchScene(),
    getCurrentLiveRound(),
    (async () => {
      return (await getActiveTournament()) ?? (await getLatestTournament());
    })(),
  ]);

  const liveState = activeRound
    ? await getLiveRoundState({
        roundId: activeRound.id,
        viewerUserId: null,
      })
    : null;

  let mainBracket: any[] = [];
  let losersBracket: any[] = [];
  let bracketUsers: Array<{
    id: string;
    name: string | null;
    email: string | null;
  }> = [];
  if (t) {
    const [m, l, usersMap] = await Promise.all([
      getBracket(t.id, "main"),
      getBracket(t.id, "losers"),
      getBracketUsers(t.id),
    ]);
    // Serialize the Map into a plain array so JSON.stringify works.
    bracketUsers = Array.from(usersMap.entries()).map(([id, u]) => ({
      id,
      name: u.name,
      email: u.email,
    }));
    mainBracket = m;
    losersBracket = l;
  }

  return NextResponse.json(
    {
      ok: true,
      scene,
      live: liveState,
      mainBracket,
      losersBracket,
      bracketUsers,
      ts: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
