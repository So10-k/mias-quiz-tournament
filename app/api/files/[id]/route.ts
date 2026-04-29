// Auth-checked file fetch. 302-redirects to a short-lived presigned R2
// URL when access is permitted; otherwise responds with the right error
// status so the viewer can react (login required, password required, etc.).

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
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const file = await getFileById(id);
  if (!file) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const session = await auth();
  const u = session?.user as any;
  const cookieJar = await cookies();
  const passwordCookieOk =
    cookieJar.get(PASSWORD_COOKIE(file.id))?.value === "ok";

  const access = await checkAccess(file, {
    userEmail: u?.email ?? null,
    userIsAuthor: u?.role === "author",
    passwordCookieOk,
  });
  if (!access.ok) {
    return NextResponse.json(
      { error: access.reason },
      { status: access.reason === "login" || access.reason === "users" ? 401 : 403 }
    );
  }

  // Decide attachment vs inline: if the request asks for ?download=1 and
  // download is allowed, force attachment. Otherwise inline so viewers can
  // render in iframes / video tags.
  const url = new URL(_req.url);
  const wantDownload = url.searchParams.get("download") === "1";
  const attachment = wantDownload && file.allowDownload;

  const presigned = await presignAssetUrl(file, { attachment });
  return NextResponse.redirect(presigned, { status: 302 });
}
