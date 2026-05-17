// DiscourseConnect (formerly Discourse SSO) helpers.
//
// Protocol summary — Discourse-side and us-side, simplified:
//
//   1. User clicks "Sign in" on discuss.miaswebsites.art.
//   2. Discourse builds a payload string:
//        nonce=...&return_sso_url=...
//      It URL-encodes that, base64-encodes the result, and signs the
//      base64 with HMAC-SHA256 keyed on a shared secret.
//   3. Discourse 302s the user to:
//        https://quiz.miaswebsites.art/api/discourse/sso?sso=<base64>&sig=<hex>
//   4. We verify the HMAC, decode the payload, identify the current
//      user (using the existing Next-Auth session — re-using the
//      player Auth0 callback so no new OIDC client is needed).
//   5. We build a response payload echoing the nonce + filling in
//      user fields, sign it the same way, and 302 the user to:
//        <return_sso_url>?sso=<base64>&sig=<hex>
//   6. Discourse verifies our HMAC, JIT-creates / updates the user,
//      logs them in.
//
// Reference:
//   https://meta.discourse.org/t/setup-discourseconnect-official-single-sign-on-for-discourse-sso/13045

import { createHmac, timingSafeEqual } from "node:crypto";

export type SsoIncomingPayload = {
  nonce: string;
  return_sso_url: string;
  // Discourse may add other fields (e.g. `prompt=none`), preserve as
  // string-string map for completeness.
  raw: Record<string, string>;
};

export type SsoOutgoingPayload = {
  // Always required.
  nonce: string;
  email: string;
  external_id: string;
  username: string;
  // Optional but very useful.
  name?: string;
  avatar_url?: string;
  avatar_force_update?: boolean;
  bio?: string;
  // Permission flags. Mapping our `role === 'author'` to admin +
  // moderator gives Sam + Mia full control on Discourse.
  admin?: boolean;
  moderator?: boolean;
  // Suppress the "Welcome to ..." message Discourse normally sends to
  // first-time users — they already know what the site is.
  suppress_welcome_message?: boolean;
  // Skip Discourse's separate email-verification step. We've already
  // verified via Auth0; one verification is enough.
  require_activation?: boolean;
  // Group membership reconciliation. Discourse adds the user to
  // every group in `add_groups` and removes them from every group
  // in `remove_groups` on every successful sign-in. Comma-separated
  // group names (no spaces). We use this to keep `players` /
  // `semi_finalists` / `finalists` in lockstep with the bracket.
  add_groups?: string;
  remove_groups?: string;
  // Authoritative group list — comma-separated, used by Discourse
  // when `discourse_connect_overrides_groups = true`. In that mode
  // Discourse ignores add_groups/remove_groups entirely and instead
  // sets the user's non-automatic groups to exactly this list. We
  // send all three so the SSO works regardless of which mode the
  // admin has the setting toggled to.
  groups?: string;
  // Username/account display flair.
  title?: string;
  primary_group_name?: string;
  // Arbitrary key/value pairs persisted on the User model as
  // `custom_fields`. We use these to ship tournament stats (wins,
  // matches, status, etc.) into Discourse so the bridge plugin can
  // surface them on the user profile and post bylines without
  // round-tripping back to the quiz API.
  custom_fields?: Record<string, string | number | boolean>;
};

function secretOrThrow(): string {
  const secret = process.env.DISCOURSE_SSO_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "DISCOURSE_SSO_SECRET not set (or too short — needs ≥16 chars)"
    );
  }
  return secret;
}

function hmacHex(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

// Discourse encodes the payload as base64 of a URL-encoded query
// string. Decode + parse.
export function verifyAndParseInbound(
  ssoBase64: string,
  sigHex: string
): SsoIncomingPayload {
  const secret = secretOrThrow();
  const expected = hmacHex(ssoBase64, secret);
  // timing-safe to deny timing oracle attacks.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sigHex, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("invalid HMAC");
  }
  const decoded = Buffer.from(ssoBase64, "base64").toString("utf8");
  const params = new URLSearchParams(decoded);
  const nonce = params.get("nonce");
  const returnUrl = params.get("return_sso_url");
  if (!nonce || !returnUrl) {
    throw new Error("missing nonce or return_sso_url in SSO payload");
  }
  const raw: Record<string, string> = {};
  for (const [k, v] of params.entries()) raw[k] = v;
  return { nonce, return_sso_url: returnUrl, raw };
}

// Encode + sign our response. Returns { sso, sig } ready to be
// appended as query params on the return URL.
export function signOutbound(
  payload: SsoOutgoingPayload
): { sso: string; sig: string } {
  const secret = secretOrThrow();
  const params = new URLSearchParams();
  // Discourse expects every value to be a string; booleans → "true"/"false".
  // custom_fields is a special case — Discourse expects each key as a
  // separate query param using the `custom.<name>` convention rather
  // than a nested object.
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (key === "custom_fields" && typeof value === "object") {
      for (const [k, v] of Object.entries(
        value as Record<string, unknown>
      )) {
        if (v === undefined || v === null) continue;
        params.set(`custom.${k}`, String(v));
      }
      continue;
    }
    params.set(key, String(value));
  }
  const ssoBase64 = Buffer.from(params.toString(), "utf8").toString(
    "base64"
  );
  const sig = hmacHex(ssoBase64, secret);
  return { sso: ssoBase64, sig };
}

// Build the final redirect URL to send the user back to Discourse.
export function buildReturnRedirect(
  returnSsoUrl: string,
  payload: SsoOutgoingPayload
): string {
  const { sso, sig } = signOutbound(payload);
  // Preserve any pre-existing query params on the return URL.
  const url = new URL(returnSsoUrl);
  url.searchParams.set("sso", sso);
  url.searchParams.set("sig", sig);
  return url.toString();
}

// Pick a Discourse-acceptable username from email or display name.
// Discourse usernames must be 3+ chars, alphanumerics + underscore +
// hyphen + period, can't start with a number, can't end with .json/etc.
// We do a best-effort sanitize and let Discourse make it unique on its
// end if there's a collision.
export function deriveUsername(args: {
  name?: string | null;
  email: string;
}): string {
  const source = (args.name && args.name.trim()) || args.email.split("@")[0];
  let s = source
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w.\-]/g, "")
    .replace(/^[._-]+/, "")
    .replace(/[._-]+$/, "");
  if (!s) s = "player";
  if (/^\d/.test(s)) s = `u${s}`;
  // Cap at 20 chars (Discourse default max).
  return s.slice(0, 20);
}
