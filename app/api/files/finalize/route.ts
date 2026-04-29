import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { finalizeUpload } from "@/lib/files";
import { headObject } from "@/lib/r2";

const Input = z.object({
  id: z.string().min(1).max(64),
  storageKey: z.string().min(1).max(400),
  originalName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(200),
  size: z.number().int().min(0),
});

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || role !== "author") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", detail: parsed.error.errors[0]?.message },
      { status: 400 }
    );
  }

  // Sanity check: confirm the object actually exists in R2 before recording.
  // If the upload failed silently, we don't want a phantom row.
  try {
    const head = await headObject(parsed.data.storageKey);
    const r2Size = Number(head.ContentLength ?? 0);
    if (r2Size <= 0) {
      return NextResponse.json({ error: "empty_upload" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "upload_missing" }, { status: 400 });
  }

  const userId = (session.user as any).id as string;
  const row = await finalizeUpload({
    id: parsed.data.id,
    storageKey: parsed.data.storageKey,
    originalName: parsed.data.originalName,
    mimeType: parsed.data.mimeType,
    size: parsed.data.size,
    ownerUserId: userId,
  });
  return NextResponse.json({ ok: true, file: row });
}
