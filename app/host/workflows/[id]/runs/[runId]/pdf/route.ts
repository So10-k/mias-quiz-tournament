// PDF download for a stored workflow run. Author-only.

import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { findWorkflow, getRun } from "@/lib/workflows";
import { renderWorkflowRunPdf } from "@/lib/workflows-pdf";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import type { WorkflowResult } from "@/lib/workflows/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const me = await currentUser();
  if (!me || me.role !== "author") {
    return NextResponse.json({ error: "host only" }, { status: 401 });
  }
  const { id, runId } = await params;
  const def = findWorkflow(id);
  if (!def) return NextResponse.json({ error: "unknown workflow" }, { status: 404 });
  const run = await getRun(runId);
  if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });
  const result = (run.resultJson as unknown as WorkflowResult | null) ?? null;
  if (!result) {
    return NextResponse.json(
      { error: "no result_json — run may have failed before persisting" },
      { status: 409 }
    );
  }

  let triggeredByName: string | null = null;
  if (run.triggeredByUserId) {
    const [u] = await db
      .select({ name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, run.triggeredByUserId))
      .limit(1);
    triggeredByName = u?.name ?? u?.email ?? null;
  }

  const pdf = await renderWorkflowRunPdf({
    def,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    triggeredByName,
    result,
  });
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${def.id}-${runId.slice(0, 8)}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
