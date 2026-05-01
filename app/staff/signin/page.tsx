import Link from "next/link";
import { Stage } from "@/components/Stage";

export const dynamic = "force-dynamic";

export default async function StaffSigninPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next ?? "/staff";
  return (
    <Stage>
      <div className="h-[calc(100vh-128px)] flex items-center justify-center px-4">
        <div className="card px-7 py-7 text-center max-w-md">
          <p className="font-display text-base text-coral-deep uppercase tracking-widest">
            Staff portal
          </p>
          <h1 className="font-display text-4xl text-navy mt-2 leading-none">
            Sign in via Duo
          </h1>
          <p className="font-body text-base text-navy-soft mt-4">
            Staff identities are managed in Duo SSO. You&rsquo;ll be redirected
            there for the MFA dance, then back here.
          </p>
          {sp.err ? (
            <p className="card-sm bg-coral-deep text-white px-4 py-3 mt-5 font-body text-sm break-words">
              ⚠️ Sign-in error: <code>{sp.err}</code>
            </p>
          ) : null}
          {/* `prefetch={false}` is critical: Next would otherwise RSC-prefetch
              the OAuth start route, which 302s to Duo on a different origin
              and produces CORS errors in the console. It also burns a fresh
              state cookie for nothing. */}
          <Link
            href={`/api/auth/staff/signin?next=${encodeURIComponent(next)}`}
            prefetch={false}
            className="pop pop-coral text-xl mt-6 inline-flex"
          >
            🔐 Continue to Duo →
          </Link>
          <p className="font-body text-xs text-navy-soft mt-6">
            Not a staff member? Player accounts live at{" "}
            <a
              href="https://quiz.miaswebsites.art"
              className="underline text-navy"
            >
              quiz.miaswebsites.art
            </a>
            .
          </p>
        </div>
      </div>
    </Stage>
  );
}
