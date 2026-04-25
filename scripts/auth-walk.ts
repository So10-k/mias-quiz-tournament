// Walks the /register → magic-link → /desk flow without a browser.
// Uses NextAuth's standard /api/auth/signin/email POST endpoint (CSRF token
// fetched via /api/auth/csrf), then pulls the verification token straight
// from the DB and follows the callback URL to establish a session cookie.
//
// Run while `npm run dev` is up:
//   npx tsx --tsconfig tsconfig.json scripts/auth-walk.ts

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema.ts";
import { eq, desc } from "drizzle-orm";

const BASE = "http://localhost:3000";
const EMAIL = process.env.AUTHOR_EMAIL ?? "appdev7710@gmail.com";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

type Jar = Map<string, string>;
const newJar = (): Jar => new Map();
const cookieHeader = (jar: Jar) =>
  Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
const recordCookies = (jar: Jar, res: Response) => {
  const setCookies = (res.headers as any).getSetCookie?.() ?? [];
  for (const sc of setCookies) {
    const [pair] = sc.split(";");
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    jar.set(k, v);
  }
};

async function main() {
  const jar = newJar();

  console.log("→ fetch CSRF token");
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  recordCookies(jar, csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  console.log("→ POST /api/auth/signin/email");
  const signInRes = await fetch(`${BASE}/api/auth/signin/email`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({
      csrfToken,
      email: EMAIL,
      callbackUrl: `${BASE}/desk`,
    }).toString(),
    redirect: "manual",
  });
  recordCookies(jar, signInRes);
  console.log(`   status: ${signInRes.status}, location: ${signInRes.headers.get("location")}`);

  console.log("→ wait for verification token in DB");
  let token: string | null = null;
  for (let i = 0; i < 20; i++) {
    const rows = await db
      .select()
      .from(schema.verificationTokens)
      .where(eq(schema.verificationTokens.identifier, EMAIL))
      .orderBy(desc(schema.verificationTokens.expires))
      .limit(1);
    if (rows[0]) {
      token = rows[0].token;
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!token) throw new Error("No verification token created");
  console.log("   token:", token.slice(0, 12) + "…");

  // Construct the callback URL — must match what NextAuth would have emailed.
  const callback = new URL(`${BASE}/api/auth/callback/email`);
  callback.searchParams.set("callbackUrl", `${BASE}/desk`);
  callback.searchParams.set("token", token);
  callback.searchParams.set("email", EMAIL);

  console.log("→ GET callback");
  const cbRes = await fetch(callback.toString(), {
    redirect: "manual",
    headers: { cookie: cookieHeader(jar) },
  });
  recordCookies(jar, cbRes);
  console.log(`   status: ${cbRes.status}, location: ${cbRes.headers.get("location")}`);

  // Follow redirects manually until we reach a final 2xx.
  let location = cbRes.headers.get("location");
  let hops = 0;
  while (location && hops < 5) {
    const url = location.startsWith("http") ? location : `${BASE}${location}`;
    const r = await fetch(url, { redirect: "manual", headers: { cookie: cookieHeader(jar) } });
    recordCookies(jar, r);
    console.log(`   →  ${url}  ${r.status}`);
    location = r.headers.get("location");
    hops++;
  }

  console.log("→ probe /desk with session cookie");
  const deskRes = await fetch(`${BASE}/desk`, {
    redirect: "manual",
    headers: { cookie: cookieHeader(jar) },
  });
  console.log("   /desk status:", deskRes.status);
  if (deskRes.status === 307 || deskRes.status === 302) {
    console.log("   redirected to:", deskRes.headers.get("location"));
  } else {
    const html = await deskRes.text();
    const has = html.includes("The Author");
    console.log("   contains 'The Author':", has);
  }

  console.log("→ verify role in DB");
  const [u] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, EMAIL))
    .limit(1);
  console.log("   user:", { email: u?.email, role: u?.role, name: u?.name });
  if (u?.role !== "author") {
    console.error("✗ FAIL: AUTHOR_EMAIL did not get 'author' role");
    process.exit(1);
  }
  console.log("✓ author role assigned");

  if (deskRes.status !== 200) {
    console.error("✗ FAIL: /desk did not return 200 with session");
    process.exit(1);
  }
  console.log("✓ /desk reachable as the Author");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
