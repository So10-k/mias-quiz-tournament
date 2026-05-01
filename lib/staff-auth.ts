// Staff portal auth — totally separate from the user/Auth.js stack.
// Custom OIDC client against Duo SSO. JIT-provisions a `staff_users` row
// on first successful auth; subsequent visits use a `staff_session`
// cookie. No SCIM yet — Duo Premier supports it, but for a small team
// JIT is simpler and any user provisioned in Duo gets in on first login.

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as jose from "jose";
import { db, schema } from "@/db";
import { and, eq, gt } from "drizzle-orm";
import { id as makeId } from "@/lib/ids";
import { staffCan, type Permission } from "@/lib/staff-permissions";

const SESSION_COOKIE = "qsp_staff";
const STATE_COOKIE = "qsp_staff_state";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const STATE_TTL_MS = 10 * 60 * 1000; // 10m

const STAFF_ORIGIN =
  process.env.STAFF_ORIGIN ?? "https://staff.miaswebsites.art";

export type DuoConfig = {
  clientId: string;
  clientSecret: string;
  issuer: string; // e.g. https://sso-xxx.sso.duosecurity.com/oidc/...
  redirectUri: string;
};

export function duoConfig(): DuoConfig | null {
  const clientId = process.env.DUO_CLIENT_ID;
  const clientSecret = process.env.DUO_CLIENT_SECRET;
  const issuer = process.env.DUO_ISSUER;
  if (!clientId || !clientSecret || !issuer) return null;
  return {
    clientId,
    clientSecret,
    issuer: issuer.replace(/\/$/, ""),
    redirectUri: `${STAFF_ORIGIN}/api/auth/staff/callback`,
  };
}

type Discovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
  userinfo_endpoint?: string;
};
let discoveryCache: { v: Discovery; expiresAt: number } | null = null;

export async function discoverDuo(cfg: DuoConfig): Promise<Discovery> {
  if (discoveryCache && discoveryCache.expiresAt > Date.now())
    return discoveryCache.v;
  const url = `${cfg.issuer}/.well-known/openid-configuration`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Duo discovery failed: ${res.status} ${url}`);
  const v = (await res.json()) as Discovery;
  discoveryCache = { v, expiresAt: Date.now() + 60 * 60 * 1000 };
  return v;
}

// PKCE — Duo SSO requires (or strongly prefers) it.
function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

export async function startSignin(args: { next?: string }): Promise<string> {
  const cfg = duoConfig();
  if (!cfg) throw new Error("Duo OIDC env vars missing");
  const disco = await discoverDuo(cfg);
  const state = randomBytes(16).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const { verifier, challenge } = pkce();
  const cookieJar = await cookies();
  cookieJar.set(STATE_COOKIE, JSON.stringify({
    state,
    nonce,
    verifier,
    next: args.next ?? "/staff",
  }), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: STATE_TTL_MS / 1000,
  });
  const u = new URL(disco.authorization_endpoint);
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("redirect_uri", cfg.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("nonce", nonce);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export async function completeSignin(req: {
  code: string;
  state: string;
}): Promise<{ next: string } | { error: string }> {
  const cfg = duoConfig();
  if (!cfg) return { error: "Duo OIDC env vars missing" };
  const disco = await discoverDuo(cfg);
  const cookieJar = await cookies();
  const stateCookie = cookieJar.get(STATE_COOKIE);
  if (!stateCookie) return { error: "missing-state" };
  let parsed: { state: string; nonce: string; verifier: string; next: string };
  try {
    parsed = JSON.parse(stateCookie.value);
  } catch {
    return { error: "bad-state" };
  }
  if (parsed.state !== req.state) return { error: "state-mismatch" };

  // Exchange code for tokens.
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: req.code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code_verifier: parsed.verifier,
  });
  const tokenRes = await fetch(disco.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    return { error: `token-exchange-failed: ${t.slice(0, 200)}` };
  }
  const tokens = (await tokenRes.json()) as {
    id_token: string;
    access_token?: string;
  };

  // Verify ID token via JWKS, check nonce + audience + issuer.
  const JWKS = jose.createRemoteJWKSet(new URL(disco.jwks_uri));
  let payload: jose.JWTPayload;
  try {
    const verified = await jose.jwtVerify(tokens.id_token, JWKS, {
      issuer: disco.issuer,
      audience: cfg.clientId,
    });
    payload = verified.payload;
  } catch (e) {
    return {
      error: `id-token-verify-failed: ${
        e instanceof Error ? e.message : String(e)
      }`,
    };
  }
  if (payload.nonce !== parsed.nonce) return { error: "nonce-mismatch" };

  const subj = String(payload.sub ?? "");
  let email = String(payload.email ?? "").toLowerCase();
  let name = (payload.name as string | undefined) ?? null;

  // Duo (and many IDPs) often ship a sparse id_token and put email/name on
  // the userinfo endpoint instead. If we're missing either, hit userinfo
  // with the access_token.
  if ((!email || !name) && tokens.access_token && disco.userinfo_endpoint) {
    try {
      const uiRes = await fetch(disco.userinfo_endpoint, {
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });
      if (uiRes.ok) {
        const ui = (await uiRes.json()) as Record<string, unknown>;
        if (!email) email = String(ui.email ?? "").toLowerCase();
        if (!name && typeof ui.name === "string") name = ui.name;
        if (
          !name &&
          (typeof ui.given_name === "string" ||
            typeof ui.family_name === "string")
        ) {
          name =
            [ui.given_name, ui.family_name]
              .filter((x): x is string => typeof x === "string")
              .join(" ")
              .trim() || null;
        }
        if (!name && typeof ui.preferred_username === "string") {
          name = ui.preferred_username;
        }
      }
    } catch {
      /* fall through with whatever we have */
    }
  }

  if (!subj || !email) {
    return {
      error: `missing-subject-or-email (sub=${subj ? "ok" : "missing"} email=${
        email ? "ok" : "missing"
      })`,
    };
  }

  // JIT-provision the staff_user row.
  const [existing] = await db
    .select()
    .from(schema.staffUsers)
    .where(eq(schema.staffUsers.email, email))
    .limit(1);
  let staffUserId: string;
  if (existing) {
    staffUserId = existing.id;
    await db
      .update(schema.staffUsers)
      .set({
        duoSubject: subj,
        name: existing.name ?? name,
        lastLoginAt: new Date(),
      })
      .where(eq(schema.staffUsers.id, staffUserId));
  } else {
    staffUserId = makeId();
    await db.insert(schema.staffUsers).values({
      id: staffUserId,
      email,
      name,
      duoSubject: subj,
      role: "staff",
      lastLoginAt: new Date(),
    });
  }

  // Mint a session + set cookie scoped to the staff subdomain.
  const sessionToken = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(schema.staffSessions).values({
    sessionToken,
    staffUserId,
    expires,
  });
  cookieJar.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  cookieJar.delete(STATE_COOKIE);

  // Audit the login. Lazy import to avoid a cycle (staff-audit imports auth).
  try {
    const { logStaffAction } = await import("@/lib/staff-audit");
    await logStaffAction({
      actor: { id: staffUserId, email },
      action: existing ? "auth.signin" : "auth.signin_first",
    });
  } catch {
    /* never block login on audit failure */
  }

  return { next: parsed.next ?? "/staff" };
}

export async function getStaffUser(): Promise<
  | (typeof schema.staffUsers.$inferSelect & { sessionToken: string })
  | null
> {
  const cookieJar = await cookies();
  const tok = cookieJar.get(SESSION_COOKIE);
  if (!tok) return null;
  const [row] = await db
    .select()
    .from(schema.staffSessions)
    .innerJoin(
      schema.staffUsers,
      eq(schema.staffUsers.id, schema.staffSessions.staffUserId)
    )
    .where(
      and(
        eq(schema.staffSessions.sessionToken, tok.value),
        gt(schema.staffSessions.expires, new Date())
      )
    )
    .limit(1);
  if (!row) return null;
  return { ...row.staff_users, sessionToken: row.staff_sessions.sessionToken };
}

// Page-guard helper. Redirects unauthenticated requests to the staff sign-in
// page (preserving `next`). Authenticated-but-unauthorised requests get
// redirected to /staff with a `?denied=` flag so the dashboard can surface
// "you don't have permission to do that" without a hard 403.
export async function requireStaff(opts: {
  next: string;
  permission?: Permission;
}): Promise<NonNullable<Awaited<ReturnType<typeof getStaffUser>>>> {
  const me = await getStaffUser();
  if (!me) {
    redirect(`/staff/signin?next=${encodeURIComponent(opts.next)}`);
  }
  if (opts.permission && !staffCan(me.role, opts.permission)) {
    redirect(`/staff?denied=${encodeURIComponent(opts.permission)}`);
  }
  return me;
}

export async function signOutStaff(): Promise<void> {
  const me = await getStaffUser();
  const cookieJar = await cookies();
  const tok = cookieJar.get(SESSION_COOKIE);
  if (tok) {
    await db
      .delete(schema.staffSessions)
      .where(eq(schema.staffSessions.sessionToken, tok.value));
  }
  cookieJar.delete(SESSION_COOKIE);
  if (me) {
    try {
      const { logStaffAction } = await import("@/lib/staff-audit");
      await logStaffAction({
        actor: { id: me.id, email: me.email },
        action: "auth.signout",
      });
    } catch {
      /* never block logout on audit failure */
    }
  }
}
