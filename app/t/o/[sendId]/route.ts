import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, isNull, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { emailSends } = schema;

// 1×1 transparent GIF (43 bytes).
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ sendId: string }> }
) {
  const { sendId } = await ctx.params;
  // Best-effort: only set openedAt the first time we see it.
  void db
    .update(emailSends)
    .set({ openedAt: new Date() })
    .where(and(eq(emailSends.id, sendId), isNull(emailSends.openedAt)))
    .catch(() => {});
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      pragma: "no-cache",
      expires: "0",
    },
  });
}
