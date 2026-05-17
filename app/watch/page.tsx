// Public broadcast scene — pre-taped edition.
//
// Originally screen-shared into a live Zoho webinar. Now used as the
// "on-camera" scene while Sam records each round in /live with the
// finalist. Same scene state, same Scene Director — we just point a
// screen-recording at this tab instead of streaming it live.
//
// Hit F11 to fullscreen before starting the recording.

import type { Metadata } from "next";
import { WatchScene } from "./WatchScene";
import { getWatchScene } from "@/lib/watch-scene";
import { getCurrentLiveRound, getLiveRoundState } from "@/lib/live";
import { getBracket, getBracketUsers } from "@/lib/bracket";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mia's Quiz · Recording scene",
  description:
    "The on-camera scene for Mia's Quiz Tournament finals (pre-taped). Used for recording each round.",
  alternates: { canonical: `${SITE_URL}/watch` },
  robots: { index: false, follow: false },
};

export default async function WatchPage() {
  const [scene, activeRound, t] = await Promise.all([
    getWatchScene(),
    getCurrentLiveRound(),
    (async () => {
      return (await getActiveTournament()) ?? (await getLatestTournament());
    })(),
  ]);

  const live = activeRound
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
    bracketUsers = Array.from(usersMap.entries()).map(([id, u]) => ({
      id,
      name: u.name,
      email: u.email,
    }));
    mainBracket = m;
    losersBracket = l;
  }

  return (
    <WatchScene
      initial={{
        ok: true,
        scene,
        live,
        mainBracket,
        losersBracket,
        bracketUsers,
        ts: Date.now(),
      }}
    />
  );
}
