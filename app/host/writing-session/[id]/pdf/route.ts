// Stream a freshly-rendered PDF for the requested variant. Auth gated
// to author role — Sam pulls these from /host/writing-session/[id].

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getScript } from "@/lib/writing-session";
import { renderScriptPdf, type PdfVariant } from "@/lib/writing-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VARIANTS: Set<PdfVariant> = new Set([
  "personal-mia",
  "personal-juliette",
  "lines-only",
  "master",
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await currentUser();
  if (!me || me.role !== "author") {
    return NextResponse.json(
      { error: "host only" },
      { status: 401 }
    );
  }
  const { id } = await params;
  const url = new URL(req.url);
  const v = url.searchParams.get("variant");
  if (!v || !VARIANTS.has(v as PdfVariant)) {
    return NextResponse.json(
      { error: "missing/invalid variant" },
      { status: 400 }
    );
  }
  const body = await getScript(id);
  if (!body) {
    return NextResponse.json({ error: "script not found" }, { status: 404 });
  }
  const pdf = await renderScriptPdf({ body, variant: v as PdfVariant });
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${body.script.title.replace(/[^a-z0-9-]+/gi, "-")}-${v}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
