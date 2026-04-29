import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createPresignedUpload } from "@/lib/files";
import { isR2Configured } from "@/lib/r2";

const Input = z.object({
  filename: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(200),
  size: z.number().int().min(0).max(1024 * 1024 * 1024), // 1 GB cap
});

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user || role !== "author") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isR2Configured()) {
    return NextResponse.json({ error: "r2_not_configured" }, { status: 503 });
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
  const userId = (session.user as any).id as string;
  const r = await createPresignedUpload({
    filename: parsed.data.filename,
    mimeType: parsed.data.mimeType,
    size: parsed.data.size,
    ownerUserId: userId,
  });
  return NextResponse.json(r);
}
