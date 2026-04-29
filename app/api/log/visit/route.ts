import { NextResponse } from "next/server";
import { z } from "zod";
import { headers, cookies } from "next/headers";
import { auth } from "@/auth";
import { logVisit } from "@/lib/visits";

const Input = z.object({
  path: z.string().min(1).max(400),
  referrer: z.string().max(400).optional().nullable(),
  timezone: z.string().max(80).optional().nullable(),
  language: z.string().max(32).optional().nullable(),
  screen: z.string().max(32).optional().nullable(),
});

const FP_COOKIE = "qsp_fp";

function getRealIp(h: Headers): string | null {
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf;
  const real = h.get("x-real-ip");
  if (real) return real;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return null;
}

function randomFingerprint(): string {
  // 24 hex chars, server-generated. We don't try to fingerprint the user
  // beyond a stable cookie ID per browser.
  const out = new Uint8Array(12);
  crypto.getRandomValues(out);
  return Array.from(out)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: Request) {
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

  const h = await headers();
  const jar = await cookies();
  const session = await auth();
  const userId = (session?.user as any)?.id ?? null;

  let fingerprint = jar.get(FP_COOKIE)?.value ?? null;
  let setCookie = false;
  if (!fingerprint || fingerprint.length < 16 || fingerprint.length > 64) {
    fingerprint = randomFingerprint();
    setCookie = true;
  }

  const ua = h.get("user-agent");
  const ip = getRealIp(h);
  const country =
    h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? null;
  const region =
    h.get("x-vercel-ip-country-region") ??
    h.get("cf-region") ??
    null;
  const city =
    h.get("x-vercel-ip-city") ?? h.get("cf-ipcity") ?? null;

  try {
    await logVisit({
      fingerprint,
      userId,
      path: parsed.data.path,
      referrer: parsed.data.referrer ?? null,
      userAgent: ua,
      ip,
      country,
      region,
      city: city ? decodeURIComponent(city) : null,
      timezone: parsed.data.timezone ?? null,
      language: parsed.data.language ?? null,
      screen: parsed.data.screen ?? null,
    });
  } catch {
    // Logging failures are silent; don't impact the user's page load.
  }

  const res = NextResponse.json({ ok: true });
  if (setCookie) {
    res.cookies.set(FP_COOKIE, fingerprint, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2, // 2 years
      secure: true,
    });
  }
  return res;
}
