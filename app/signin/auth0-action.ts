"use server";

// Kicks off the Auth.js → Auth0 OIDC flow. Auth.js's `signIn(providerId)`
// helper handles the redirect to the IdP's authorize endpoint and the
// PKCE/state dance on return.

import { signIn } from "@/auth";

export async function auth0SignInAction() {
  await signIn("auth0", { redirectTo: "/play" });
}
