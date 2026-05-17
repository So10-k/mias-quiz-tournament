// Issues a short-lived JaaS JWT for the current signed-in user.
// The /live page calls this on mount, then passes the JWT to the
// JitsiMeetExternalAPI iframe.
//
// Role assignment:
//   • role=author       → moderator (can mute others, end meeting,
//                                    livestream/record)
//   • role=reader       → participant
//   • signed-out users  → 401 (must sign in to join)
//
// Room is fixed to "finals-room" by default; pass ?room=<name> to
// override (still tenant-scoped via JAAS_APP_ID).

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { signJaasToken } from "@/lib/jaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ROOMS = new Set(["finals-room", "green-room", "rehearsal"]);

export async function GET(req: NextRequest) {
  const me = await currentUser();
  if (!me || !me.email) {
    return NextResponse.json(
      { ok: false, error: "Sign in required" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const roomReq = url.searchParams.get("room") ?? "finals-room";
  const room = ALLOWED_ROOMS.has(roomReq) ? roomReq : "finals-room";

  try {
    const jwt = await signJaasToken({
      roomName: room,
      user: {
        id: me.id,
        name: me.name ?? me.email.split("@")[0],
        email: me.email,
        moderator: me.role === "author",
      },
    });
    return NextResponse.json({
      ok: true,
      jwt,
      room,
      appId: process.env.JAAS_APP_ID,
      moderator: me.role === "author",
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
