import { NextResponse } from "next/server";
import {
  getBracket,
  getBracketUsers,
  getBracketChampionId,
} from "@/lib/bracket";
import { getActiveTournament, getLatestTournament } from "@/lib/engine";
import { renderBracketSvg } from "@/lib/bracket-svg";

export const dynamic = "force-dynamic";

export async function GET() {
  const tournament =
    (await getActiveTournament()) ?? (await getLatestTournament());
  if (!tournament) {
    return new NextResponse(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="600" height="200"><rect width="100%" height="100%" fill="#B7E5FF"/><text x="300" y="100" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="20" font-weight="700" fill="#1B2A4E">No active tournament</text></svg>`,
      {
        status: 200,
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          "cache-control": "public, max-age=30",
        },
      }
    );
  }
  const [rounds, users, championId] = await Promise.all([
    getBracket(tournament.id),
    getBracketUsers(tournament.id),
    getBracketChampionId(tournament.id),
  ]);
  const svg = renderBracketSvg(rounds, users, championId);
  return new NextResponse(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // Short cache so email clients refetch on each open but we don't
      // hammer the DB if many recipients open at once.
      "cache-control": "public, max-age=30, stale-while-revalidate=300",
    },
  });
}
