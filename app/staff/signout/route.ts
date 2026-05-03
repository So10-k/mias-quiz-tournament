import { NextResponse } from "next/server";
import { signOutStaff } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STAFF_ORIGIN =
  process.env.STAFF_ORIGIN ?? "https://staff.miaswebsites.art";

// POST-only on purpose. A GET handler here is dangerous: Next.js will
// prefetch any `<Link href="/staff/signout">` in the background, which
// would silently sign every staff user out on every page load. Use a
// form with method="POST" to trigger this.
export async function POST() {
  // 1. Clear our DB-backed staff session + cookie.
  await signOutStaff();

  // 2. Federated logout: bounce through Auth0's /v2/logout so the SSO
  // cookie at the IdP is also killed. Without this, hitting the staff
  // sign-in button again silently re-auths the user (skipping Duo Push,
  // skipping the org gate, skipping the email-OTP step) which makes it
  // impossible to actually test the new flow. `returnTo` must be in
  // the staff Auth0 app's "Allowed Logout URLs" — we set that to
  // https://staff.miaswebsites.art back when wiring the app.
  const issuer = process.env.AUTH_AUTH0_STAFF_ISSUER;
  const clientId = process.env.AUTH_AUTH0_STAFF_ID;
  if (!issuer || !clientId) {
    // Auth0 not configured (e.g. local dev with only DUO_* set, or vars
    // missing). Just bounce home — there's no upstream session to clear.
    return NextResponse.redirect(`${STAFF_ORIGIN}/staff/signin`, 302);
  }
  const url = new URL("/v2/logout", issuer.replace(/\/$/, ""));
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("returnTo", `${STAFF_ORIGIN}/staff/signin`);
  return NextResponse.redirect(url.toString(), 302);
}
