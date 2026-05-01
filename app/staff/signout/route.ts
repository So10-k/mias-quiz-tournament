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
  await signOutStaff();
  return NextResponse.redirect(`${STAFF_ORIGIN}/staff/signin`, 302);
}
