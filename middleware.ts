import { NextRequest, NextResponse } from "next/server";
import {
  isIpBlocked,
  getBlockMode,
  getRealIpFromHeaders,
} from "@/lib/blocks";

const TARGET_HOST = "quiz.miaswebsites.art";
const TARGET_ORIGIN = `https://${TARGET_HOST}`;

const SESSION_COOKIES = [
  "__Secure-authjs.session-token",
  "__Host-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

// Cookie set by `?permissionlevel=granted`. Persists for a year and bypasses
// the IP blocklist (and any future gate). Lets Sam un-stick himself if he
// ever blocks his own address by accident.
const PERMISSION_COOKIE = "qsp_grant";

// Paths that should never be intercepted by the block check — APIs/assets
// must keep working for whoever DOES have the bypass cookie, plus the block
// page itself.
function isBlockPassthrough(path: string) {
  return (
    path.startsWith("/_next/") ||
    path === "/blocked" ||
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    path === "/handoff"
  );
}

// Paths the staff subdomain is allowed to expose. Anything else gets
// redirected to /staff so the subdomain stays scoped to staff functions.
function isStaffPath(path: string) {
  return (
    path.startsWith("/staff") ||
    path.startsWith("/api/auth/staff") ||
    path.startsWith("/api/log/") ||
    path.startsWith("/miamail") ||
    path.startsWith("/email-assets") ||
    path.startsWith("/t/") ||
    path === "/blocked" ||
    path === "/favicon.ico" ||
    path === "/robots.txt"
  );
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  // ── staff.miaswebsites.art → only staff routes; everything else
  //    redirects to /staff so the subdomain stays scoped.
  if (host.startsWith("staff.")) {
    const path = request.nextUrl.pathname;
    if (!isStaffPath(path)) {
      const u = request.nextUrl.clone();
      u.pathname = "/staff";
      u.search = "";
      return NextResponse.redirect(u, 302);
    }
    // Skip IP block on staff sub-domain — staff need to get in.
    return NextResponse.next();
  }

  // ── .vercel.app → custom-domain bridge with auth handoff ────────────────
  if (host.includes(".vercel.app")) {
    const path = request.nextUrl.pathname;

    if (
      path.startsWith("/api/") ||
      path.startsWith("/_next/") ||
      path.startsWith("/r/") ||
      path === "/handoff"
    ) {
      return NextResponse.next();
    }

    const next = request.nextUrl.pathname + request.nextUrl.search;
    const hasSession = SESSION_COOKIES.some((n) => request.cookies.has(n));

    if (hasSession) {
      const handoff = request.nextUrl.clone();
      handoff.pathname = "/handoff";
      handoff.search = "";
      handoff.searchParams.set("next", next);
      return NextResponse.redirect(handoff, 307);
    }

    const redirectUrl = `${TARGET_ORIGIN}${request.nextUrl.pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(redirectUrl, 301);
  }

  // ── permission grant via query string sets the bypass cookie ────────────
  if (request.nextUrl.searchParams.get("permissionlevel") === "granted") {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("permissionlevel");
    const res = NextResponse.redirect(clean, 302);
    res.cookies.set(PERMISSION_COOKIE, "1", {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      secure: true,
    });
    return res;
  }

  // ── bypass cookie: skip every gate ──────────────────────────────────────
  if (request.cookies.has(PERMISSION_COOKIE)) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  if (isBlockPassthrough(path)) {
    return NextResponse.next();
  }

  // Local dev never hits the gate.
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    return NextResponse.next();
  }

  // ── IP blocklist ────────────────────────────────────────────────────────
  const ip = getRealIpFromHeaders(request.headers);
  if (ip && (await isIpBlocked(ip))) {
    const mode = await getBlockMode();
    if (mode === "bare") {
      // Native browser "this page isn't working / HTTP ERROR 403" treatment.
      return new NextResponse(null, {
        status: 403,
        statusText: "Forbidden",
        headers: { "cache-control": "no-store" },
      });
    }
    // Default: friendly styled page with the reason.
    const u = request.nextUrl.clone();
    u.pathname = "/blocked";
    u.search = "";
    return NextResponse.rewrite(u, {
      status: 403,
      headers: { "cache-control": "no-store" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
