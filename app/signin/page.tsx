import Link from "next/link";
import { Stage } from "@/components/Stage";
import { signInAction } from "./actions";
import { auth0SignInAction } from "./auth0-action";

export const dynamic = "force-dynamic";

const auth0Enabled =
  !!process.env.AUTH_AUTH0_ID &&
  !!process.env.AUTH_AUTH0_SECRET &&
  !!process.env.AUTH_AUTH0_ISSUER;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; legacy?: string }>;
}) {
  const { error, email, legacy } = await searchParams;
  // Magic-link form is hidden by default once Auth0 is live. Pass
  // ?legacy=1 to access the old flow as a break-glass option (e.g. if
  // Auth0 is having an outage). Not advertised on the page.
  const showLegacy = !auth0Enabled || legacy === "1";
  // Auth.js redirects here with ?error=AccessDenied when the signIn
  // callback returns false — that's how we surface "registration closed
  // for new players." Map known error codes to friendlier copy.
  const friendlyError =
    error === "AccessDenied"
      ? "Registration's closed for now — only existing players can sign in. If you think you should already have an account, double-check the email address."
      : error;

  return (
    <Stage>
      <div className="min-h-[calc(100vh-128px)] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="card px-6 py-8 md:px-9 md:py-10 relative overflow-hidden">
            {/* Decorative corner stars (purely cosmetic) */}
            <span
              aria-hidden
              className="absolute -top-3 -left-3 text-3xl select-none"
              style={{ filter: "drop-shadow(2px 2px 0 var(--navy))" }}
            >
              ✨
            </span>
            <span
              aria-hidden
              className="absolute -bottom-2 -right-3 text-3xl select-none rotate-12"
              style={{ filter: "drop-shadow(2px 2px 0 var(--navy))" }}
            >
              ✨
            </span>

            {/* MiaAuth lockup */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-20 h-20 rounded-2xl bg-sun border-3 border-navy flex items-center justify-center text-4xl"
                style={{ boxShadow: "var(--shadow-pop)" }}
              >
                🔐
              </div>
              <div className="text-center">
                <p className="font-display text-xs text-coral-deep uppercase tracking-[0.2em]">
                  MiaAuth
                </p>
                <h1 className="font-display text-3xl md:text-4xl text-navy mt-1 leading-tight">
                  Welcome back!
                </h1>
                <p className="font-body text-sm text-navy-soft mt-2 max-w-xs mx-auto">
                  Sign in to play. We&rsquo;ll send a one-time code to your email
                  — no passwords to remember.
                </p>
              </div>
            </div>

            {friendlyError ? (
              <div className="mt-6 card-sm bg-coral text-white px-4 py-3 text-center">
                <p className="font-display text-sm">⚠️ {friendlyError}</p>
              </div>
            ) : null}

            {auth0Enabled ? (
              <form
                action={auth0SignInAction}
                className="mt-7 flex flex-col items-center"
              >
                <button
                  type="submit"
                  className="pop pop-coral text-xl w-full max-w-[280px] inline-flex items-center justify-center gap-2"
                >
                  <span>🔐</span>
                  <span>Sign in with MiaAuth</span>
                </button>
                <p className="font-body text-xs text-navy-soft mt-3 text-center max-w-xs">
                  You&rsquo;ll get a one-time code in your inbox. Pop it in,
                  and you&rsquo;re back.
                </p>
              </form>
            ) : null}

            {/* Trust badges */}
            <div className="mt-7 grid grid-cols-3 gap-2 text-center">
              <div className="card-sm bg-white px-2 py-2">
                <p className="font-display text-base">🛡️</p>
                <p className="font-body text-[10px] text-navy-soft uppercase tracking-widest mt-1 leading-tight">
                  Bank-grade
                </p>
              </div>
              <div className="card-sm bg-white px-2 py-2">
                <p className="font-display text-base">🔑</p>
                <p className="font-body text-[10px] text-navy-soft uppercase tracking-widest mt-1 leading-tight">
                  No passwords
                </p>
              </div>
              <div className="card-sm bg-white px-2 py-2">
                <p className="font-display text-base">⚡️</p>
                <p className="font-body text-[10px] text-navy-soft uppercase tracking-widest mt-1 leading-tight">
                  10s sign-in
                </p>
              </div>
            </div>

            <p className="font-body text-[11px] text-navy-soft text-center mt-5 leading-relaxed">
              Sign-in is powered by <strong>Auth0 by Okta</strong> — the same
              identity platform used by Fortune 500 companies, healthcare
              systems and banks. Your email never touches our servers without
              MFA-grade protection. ✨
            </p>

            {showLegacy ? (
              <div className="mt-8 pt-6 border-t-2 border-dashed border-navy/15">
                <p className="font-body text-xs text-navy-soft text-center mb-3">
                  Break-glass: legacy sign-in flow
                </p>
                <form action={signInAction} className="flex flex-col gap-3">
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    defaultValue={email ?? ""}
                    placeholder="your@email.com"
                  />
                  {/* Legacy form errors are surfaced inline by signInAction
                      via the `?error=` param. The friendlyError block at
                      the top of the card already shows known codes; this
                      shows raw legacy errors only. */}
                  {error && error !== "AccessDenied" ? (
                    <p className="font-body text-sm text-coral-deep">
                      ⚠️ {error}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    className="pop pop-white text-sm self-center"
                  >
                    ✉️ Email me a magic link (legacy)
                  </button>
                </form>
              </div>
            ) : null}

            <p className="mt-7 text-sm text-navy-soft font-body text-center">
              New here?{" "}
              <Link
                href="/join"
                className="font-display text-coral-deep hover:underline"
              >
                Sign up →
              </Link>
            </p>
          </div>

          <p className="font-body text-[10px] text-navy-soft text-center mt-3 opacity-70">
            🌞 Mia&rsquo;s Quiz Tournament · MiaAuth v1
          </p>
        </div>
      </div>
    </Stage>
  );
}
