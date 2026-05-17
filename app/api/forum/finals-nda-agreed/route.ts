// HMAC-signed callback the Discourse plugin POSTs when a finalist
// replies "yes" / "agree" in their finals NDA PM. We stamp
// users.finals_nda_agreed_at; on the user's next SSO login the
// pending_finals_nda holding-zone group is dropped.

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyHmac(rawBody: string, signature: string): boolean {
  const secret = process.env.DISCOURSE_SSO_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-quizbook-signature") ?? "";
  if (!verifyHmac(raw, sig)) {
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 }
    );
  }
  let body: { external_id?: string; email?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json" },
      { status: 400 }
    );
  }
  const id = (body.external_id ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  if (!id && !email) {
    return NextResponse.json(
      { ok: false, error: "external_id or email required" },
      { status: 400 }
    );
  }

  let userRow: typeof schema.users.$inferSelect | null = null;
  if (id) {
    const [r] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    userRow = r ?? null;
  }
  if (!userRow && email) {
    const [r] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    userRow = r ?? null;
  }
  if (!userRow) {
    return NextResponse.json(
      { ok: false, error: "user not found" },
      { status: 404 }
    );
  }

  if (userRow.finalsNdaAgreedAt) {
    return NextResponse.json({
      ok: true,
      already_agreed_at: userRow.finalsNdaAgreedAt.toISOString(),
    });
  }

  await db
    .update(schema.users)
    .set({ finalsNdaAgreedAt: new Date() })
    .where(eq(schema.users.id, userRow.id));

  return NextResponse.json({ ok: true, agreed_at: new Date().toISOString() });
}
