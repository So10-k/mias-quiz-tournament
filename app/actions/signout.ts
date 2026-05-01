"use server";

// Federated sign-out. Clears the local Auth.js session cookies first so
// the user is logged out of THIS app, then redirects to Auth0's /v2/logout
// endpoint with `returnTo` set to the home page. That kills the Auth0 SSO
// session — without it, hitting "Continue with Auth0" again would silently
// re-auth the same person without prompting.
//
// `returnTo` must be in Auth0's "Allowed Logout URLs" — we have
// https://quiz.miaswebsites.art and http://localhost:3000 listed there.

import { signOut as authjsSignOut } from "@/auth";
import { redirect } from "next/navigation";

export async function signOutEverywhereAction() {
  // Clear our own session. `redirect: false` so we control where the user
  // lands next.
  await authjsSignOut({ redirect: false });

  const issuer = process.env.AUTH_AUTH0_ISSUER;
  const clientId = process.env.AUTH_AUTH0_ID;
  const origin =
    process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://quiz.miaswebsites.art";

  // If Auth0 isn't configured (env missing), just bounce home — nothing
  // upstream to log out of.
  if (!issuer || !clientId) {
    redirect("/");
  }

  const url = new URL("/v2/logout", issuer.replace(/\/$/, ""));
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("returnTo", origin + "/");
  redirect(url.toString());
}
