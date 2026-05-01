import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import {
  getAllMatchupsForGame,
  getMyPredictions,
  getPredictionsSettings,
  getR1Seeds,
} from "@/lib/predictions";
import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";
import { PredictionExperience } from "@/components/predict/PredictionExperience";

export const dynamic = "force-dynamic";

export default async function PredictPlayPage() {
  const me = await currentUser();
  if (!me) redirect("/signin");

  const settings = await getPredictionsSettings();
  if (!settings.enabled && me.role !== "author") notFound();

  const tournament =
    (await getActiveTournament()) ?? (await getLatestTournament());
  if (!tournament) notFound();

  const matchups = await getAllMatchupsForGame(tournament.id);
  const myPreds = await getMyPredictions(me.id, tournament.id);

  const userIds = new Set<string>();
  for (const m of matchups) {
    if (m.playerAUserId) userIds.add(m.playerAUserId);
    if (m.playerBUserId) userIds.add(m.playerBUserId);
    if (m.winnerUserId) userIds.add(m.winnerUserId);
  }
  const userRows =
    userIds.size === 0
      ? []
      : await db
          .select({
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
          })
          .from(schema.users)
          .where(inArray(schema.users.id, [...userIds]));

  const seedMap = await getR1Seeds(tournament.id);
  const seeds: Record<string, number> = {};
  for (const [k, v] of seedMap) seeds[k] = v;

  // Plain-shape data so the client component never touches Drizzle types.
  const matchupsForClient = matchups.map((m) => ({
    id: m.id,
    bracket: m.bracket as "main" | "losers",
    roundIndex: m.roundIndex,
    slot: m.slot,
    playerAUserId: m.playerAUserId,
    playerBUserId: m.playerBUserId,
    winnerUserId: m.winnerUserId,
    predictionsLockedAt: m.predictionsLockedAt
      ? new Date(m.predictionsLockedAt).toISOString()
      : null,
    loserNextMatchupId: m.loserNextMatchupId,
    loserNextSide: m.loserNextSide as "a" | "b" | null,
  }));
  const usersForClient = userRows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
  }));
  const predsForClient: Record<string, string> = {};
  for (const [k, v] of myPreds) predsForClient[k] = v.predictedWinnerUserId;

  return (
    <PredictionExperience
      matchups={matchupsForClient}
      users={usersForClient}
      seeds={seeds}
      myPredictions={predsForClient}
      prizeText={settings.prize}
    />
  );
}
