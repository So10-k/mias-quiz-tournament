// Confirmation link target. GET-by-design (the user is following an
// emailed link). Validates the token, flips confirmedAt, redirects to
// a friendly success page on the blog.

import { NextRequest, NextResponse } from "next/server";
import { confirmByToken } from "@/lib/newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const sub = await confirmByToken(token);
  const base = process.env.PUBLIC_BASE_URL ?? "https://quiz.miaswebsites.art";
  if (!sub) {
    return NextResponse.redirect(
      `${base}/blog/subscribe?error=${encodeURIComponent("That confirmation link wasn't valid (maybe expired).")}`,
      302
    );
  }
  return NextResponse.redirect(
    `${base}/blog/subscribe?ok=already-confirmed`,
    302
  );
}
