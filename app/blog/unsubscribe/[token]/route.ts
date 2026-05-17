// One-click unsubscribe. GET-by-design — every newsletter email
// includes a link to this URL, and email clients shouldn't trip a
// state-mutation here because the URL is unique-per-recipient and the
// operation is idempotent (re-hitting just sets unsubscribedAt to
// "now" again).

import { NextRequest, NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const sub = await unsubscribeByToken(token);
  const base = process.env.PUBLIC_BASE_URL ?? "https://quiz.miaswebsites.art";
  if (!sub) {
    return NextResponse.redirect(
      `${base}/blog/subscribe?error=${encodeURIComponent("Unsubscribe link wasn't valid.")}`,
      302
    );
  }
  // Friendly landing — message via querystring on the subscribe page.
  return NextResponse.redirect(
    `${base}/blog/subscribe?ok=unsubscribed`,
    302
  );
}
