// Short alias for the auth-checked asset fetch.
//   /r/abc123             → inline view URL (302 to presigned)
//   /r/abc123?download=1  → forces attachment when downloads allowed
//
// Use these URLs anywhere you'd embed an asset (img src, iframe src for PDFs,
// video src). Public files work without any session.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import {
  checkAccess,
  getFileById,
  presignAssetUrl,
  PASSWORD_COOKIE,
} from "@/lib/files";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const file = await getFileById(id);
  if (!file) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const session = await auth();
  const u = session?.user as any;
  const jar = await cookies();
  const passwordCookieOk =
    jar.get(PASSWORD_COOKIE(file.id))?.value === "ok";

  const access = await checkAccess(file, {
    userEmail: u?.email ?? null,
    userIsAuthor: u?.role === "author",
    passwordCookieOk,
  });
  if (!access.ok) {
    return NextResponse.redirect(new URL(`/files/${file.id}`, req.url), 302);
  }

  const url = new URL(req.url);
  const wantDownload = url.searchParams.get("download") === "1";
  const attachment = wantDownload && file.allowDownload;
  const presigned = await presignAssetUrl(file, { attachment });
  return NextResponse.redirect(presigned, { status: 302 });
}
