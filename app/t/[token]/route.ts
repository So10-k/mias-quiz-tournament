import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { verifyTrackerToken } from "@/lib/email-tracker";
import { id as makeId } from "@/lib/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { emailClicks } = schema;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const decoded = verifyTrackerToken(token);
  if (!decoded) {
    return NextResponse.redirect(
      new URL("/", "https://quiz.miaswebsites.art"),
      302
    );
  }
  // Fire and forget — don't block redirect on the insert.
  void db
    .insert(emailClicks)
    .values({
      id: makeId(),
      sendId: decoded.sendId,
      originalUrl: decoded.originalUrl,
      userAgent: req.headers.get("user-agent") ?? null,
      ip:
        req.headers.get("cf-connecting-ip") ??
        req.headers.get("x-real-ip") ??
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        null,
    })
    .catch(() => {});
  return NextResponse.redirect(decoded.originalUrl, 302);
}
