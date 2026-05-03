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
      <div className="min-h-[calc(100vh-128px)] flex items-center justify-center px-4 py-8">
        <div className="card px-7 py-9 text-center max-w-md w-full relative overflow-hidden">
          <span
            aria-hidden
            className="absolute -top-3 -left-3 text-3xl select-none"
            style={{ filter: "drop-shadow(2px 2px 0 var(--navy))" }}
          >
            🛡️
          </span>
          <span
            aria-hidden
            className="absolute -bottom-3 -right-3 text-3xl select-none rotate-12"
            style={{ filter: "drop-shadow(2px 2px 0 var(--navy))" }}
          >
            🔒
          </span>

          <div className="flex flex-col items-center gap-3">
            <div
              className="w-20 h-20 rounded-2xl bg-coral border-3 border-navy flex items-center justify-center text-4xl"
              style={{ boxShadow: "var(--shadow-pop)" }}
            >
              🔐
            </div>
            <p className="font-display text-xs text-coral-deep uppercase tracking-[0.2em]">
              MiaAuth · Staff
            </p>
            <h1 className="font-display text-3xl md:text-4xl text-navy leading-tight">
              Staff portal
            </h1>
            <p className="font-body text-sm text-navy-soft mt-1 max-w-xs">
              Sign in with your invited staff account. We&rsquo;ll bounce you
              to MiaAuth for org-membership check + Duo Push, then back here.
            </p>
          </div>

          {sp.err ? (
            <div className="card-sm bg-coral-deep text-white px-4 py-3 mt-5 text-left">
              <p className="font-display text-sm">⚠️ Sign-in failed</p>
              <p className="font-body text-xs break-words mt-1 opacity-90">
                <code>{sp.err}</code>
              </p>
            </div>
          ) : null}

          {/* prefetch={false} is critical: Next would otherwise RSC-prefetch
              the OAuth start route, which 302s to a different origin and
              produces CORS errors in the console. It also burns a fresh
              state cookie for nothing. */}
          <Link
            href={`/api/auth/staff/signin?next=${encodeURIComponent(next)}`}
            prefetch={false}
            className="pop pop-coral text-xl mt-7 inline-flex items-center gap-2"
          >
            <span>🔐</span>
            <span>Continue with MiaAuth Staff</span>
          </Link>

          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            <div className="card-sm bg-white px-2 py-2">
              <p className="font-display text-base">🏛️</p>
              <p className="font-body text-[10px] text-navy-soft uppercase tracking-widest mt-1 leading-tight">
                Org-gated
              </p>
            </div>
            <div className="card-sm bg-white px-2 py-2">
              <p className="font-display text-base">📱</p>
              <p className="font-body text-[10px] text-navy-soft uppercase tracking-widest mt-1 leading-tight">
                Duo Push
              </p>
            </div>
            <div className="card-sm bg-white px-2 py-2">
              <p className="font-display text-base">📜</p>
              <p className="font-body text-[10px] text-navy-soft uppercase tracking-widest mt-1 leading-tight">
                Audited
              </p>
            </div>
          </div>

          <p className="font-body text-[11px] text-navy-soft mt-5 leading-relaxed">
            Identity is managed by <strong>Auth0 by Okta</strong>. Only
            invited members of the staff organization can sign in, and every
            session requires a fresh Duo Push approval.
          </p>

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
