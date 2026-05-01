import { NextRequest, NextResponse } from "next/server";
import { completeSignin } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAFF_ORIGIN =
  process.env.STAFF_ORIGIN ?? "https://staff.miaswebsites.art";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const oidcError = sp.get("error");

  if (oidcError) {
    return NextResponse.redirect(
      `${STAFF_ORIGIN}/staff/signin?err=${encodeURIComponent(oidcError)}`,
      302
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      `${STAFF_ORIGIN}/staff/signin?err=missing-code`,
      302
    );
  }
  const result = await completeSignin({ code, state });
  if ("error" in result) {
    return NextResponse.redirect(
      `${STAFF_ORIGIN}/staff/signin?err=${encodeURIComponent(result.error)}`,
      302
    );
  }
  const next = result.next.startsWith("/") ? result.next : "/staff";
  return NextResponse.redirect(`${STAFF_ORIGIN}${next}`, 302);
}
