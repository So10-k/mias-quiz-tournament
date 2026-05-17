// Public spectator JWT — no auth, no user context. Anyone with the
// /watch URL can join the Jitsi room as a passive viewer with mic
// + cam off by default. Rate-limit-friendly: each call generates a
// fresh anonymous identity.
//
// JaaS requires every iframe load to carry a JWT, so even
// "anonymous" spectators need one — this endpoint just signs a
// generic non-moderator token.

import { NextRequest, NextResponse } from "next/server";
import { signJaasToken } from "@/lib/jaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROOMS = new Set(["finals-room", "rehearsal"]);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const roomReq = url.searchParams.get("room") ?? "finals-room";
  const room = ALLOWED_ROOMS.has(roomReq) ? roomReq : "finals-room";

  // Generate a fresh anonymous id + display label per call. Numbers
  // are visible in the participant list; using "Spectator" + 3 hex
  // chars keeps it tidy.
  const suffix = Math.random().toString(16).slice(2, 5);
  const id = `spectator-${suffix}`;
  const name = `Spectator ${suffix.toUpperCase()}`;

  try {
    const jwt = await signJaasToken({
      roomName: room,
      user: {
        id,
        name,
        moderator: false,
      },
      ttlSeconds: 60 * 60 * 4, // 4h — covers a long broadcast
    });
    return NextResponse.json({
      ok: true,
      jwt,
      room,
      appId: process.env.JAAS_APP_ID,
      moderator: false,
      isSpectator: true,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "sign failed",
      },
      { status: 500 }
    );
  }
}
