// Minimal liveness endpoint. Public on purpose — used by external
// uptime monitors and the status page itself for cross-site checks.
// Returns the deployment SHA (when set) so we can verify a check
// actually hit the latest build.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "quiz.miaswebsites.art",
      sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
      region: process.env.VERCEL_REGION ?? null,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}
