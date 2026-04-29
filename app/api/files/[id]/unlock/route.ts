// Verify a password for a password-protected file. On success, sets a
// short-lived cookie so subsequent fetches of the asset don't re-prompt.

import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import {
  getFileById,
  verifyPassword,
  PASSWORD_COOKIE,
} from "@/lib/files";

const Input = z.object({ password: z.string().min(1).max(200) });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const file = await getFileById(id);
  if (!file) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (file.accessMode !== "password") {
    return NextResponse.json({ error: "wrong_mode" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const ok = await verifyPassword(parsed.data.password, file.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "wrong_password" }, { status: 401 });
  }
  const jar = await cookies();
  jar.set({
    name: PASSWORD_COOKIE(file.id),
    value: "ok",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  });
  return NextResponse.json({ ok: true });
}
