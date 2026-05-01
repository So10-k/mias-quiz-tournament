import { NextRequest, NextResponse } from "next/server";
import { startSignin } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next") ?? "/staff";
  try {
    const url = await startSignin({ next });
    return NextResponse.redirect(url, 302);
  } catch (e) {
    return new NextResponse(
      `Staff sign-in unavailable: ${
        e instanceof Error ? e.message : String(e)
      }`,
      { status: 500 }
    );
  }
}
