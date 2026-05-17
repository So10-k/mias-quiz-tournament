// Polling endpoint for the live-round view. Clients hit this every
// ~1s to stay synced with the host's pace. Read-only — all mutations
// go through Server Actions on /host/live or /play/live.
//
// Auth: signed-in users only. The viewer's id determines whether the
// returned state will contain `mySubmittedOptionId` (only for finalists).

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getLiveRoundState } from "@/lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "auth required" }, { status: 401 });
  }
  const state = await getLiveRoundState({
    roundId,
    viewerUserId: user.id,
  });
  if (!state) {
    return NextResponse.json({ error: "not a live round" }, { status: 404 });
  }
  return NextResponse.json(
    { ok: true, state },
    {
      // Never cache — the whole point is real-time freshness.
      headers: { "cache-control": "no-store" },
    }
  );
}
