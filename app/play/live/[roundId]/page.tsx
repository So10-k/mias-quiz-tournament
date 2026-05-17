// Synced live-round page — finalists answer here, everyone else
// spectates here. Renders the initial state server-side so the first
// frame is fast, then hands off to <LiveRoundClient/> which polls
// /api/live/[roundId]/state for ongoing updates.

import { redirect, notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { LiveRoundClient } from "@/components/LiveRoundClient";
import { currentUser } from "@/lib/session";
import { getLiveRoundState } from "@/lib/live";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function PlayLivePage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  const user = await currentUser();
  if (!user) redirect(`/signin?next=/play/live/${roundId}`);

  const [round] = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.id, roundId))
    .limit(1);
  if (!round) notFound();
  if (!round.isLive) redirect("/play");

  const initialState = await getLiveRoundState({
    roundId,
    viewerUserId: user.id,
  });
  if (!initialState) notFound();

  return (
    <Stage scrollable>
      <LiveRoundClient
        roundId={roundId}
        viewerUserId={user.id}
        initialState={initialState}
      />
    </Stage>
  );
}
