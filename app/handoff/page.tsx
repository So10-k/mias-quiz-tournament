// Cross-domain auth bridge.
//
// When someone is already signed in on the .vercel.app host and we want
// them to land at quiz.miaswebsites.art with the same session, we can't
// just redirect — cookies are domain-scoped, so the new domain doesn't
// see the old session.
//
// Instead, this page (which runs server-side on the OLD domain) mints a
// short-lived NextAuth verification token tied to the user's email and
// 302-redirects to the NEW domain's NextAuth email callback. NextAuth
// validates the token (same database is shared between domains), creates
// a fresh session row, and sets the session cookie scoped to the new
// domain. End result: the user lands signed-in on the new domain and
// never sees a sign-in page.
//
// IMPORTANT: Auth.js v5 stores verification tokens as
// `sha256(rawToken + AUTH_SECRET)`. The URL carries the RAW token; the
// adapter hashes the URL token on receipt and looks it up by hash. So
// we must mirror that exact storage pattern here.

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { db, schema } from "@/db";

export const dynamic = "force-dynamic";

const TARGET_ORIGIN = "https://quiz.miaswebsites.art";

function hashToken(rawToken: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET missing — handoff cannot mint a token");
  }
  return createHash("sha256").update(`${rawToken}${secret}`).digest("hex");
}

export default async function Handoff({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const requestedNext = (sp.next ?? "/play").trim();
  const safeNext = requestedNext.startsWith("/") ? requestedNext : "/play";

  // If we somehow rendered on the new domain, just go where the user wanted.
  const h = await headers();
  const host = h.get("host") ?? "";
  if (host.includes("miaswebsites.art")) {
    redirect(safeNext);
  }

  const session = await auth();
  const email = session?.user?.email ?? null;

  // Not signed in on the old domain — drop the user on the new domain
  // unauthenticated; they'll sign in there if they need to.
  if (!email) {
    redirect(`${TARGET_ORIGIN}${safeNext}`);
  }

  const rawToken = randomBytes(24).toString("hex");
  const hashed = hashToken(rawToken);
  const identifier = email.toLowerCase();
  const expires = new Date(Date.now() + 90 * 1000); // 90s — generous for a redirect chain

  await db
    .insert(schema.verificationTokens)
    .values({ identifier, token: hashed, expires })
    .onConflictDoNothing();

  const callbackUrl = `${TARGET_ORIGIN}${safeNext}`;
  const url =
    `${TARGET_ORIGIN}/api/auth/callback/email` +
    `?token=${encodeURIComponent(rawToken)}` +
    `&email=${encodeURIComponent(identifier)}` +
    `&callbackUrl=${encodeURIComponent(callbackUrl)}`;

  redirect(url);
}
