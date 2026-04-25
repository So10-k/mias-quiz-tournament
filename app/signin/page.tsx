import Link from "next/link";
import { Stage } from "@/components/Stage";
import { signInAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  const { error, email } = await searchParams;

  return (
    <Stage>
      <div className="h-[calc(100vh-128px)] flex items-center justify-center px-4">
        <div className="w-full max-w-xl">
          <div className="card px-7 py-7">
            <h1 className="font-display text-4xl md:text-5xl text-navy text-center">
              Welcome back! 👋
            </h1>
            <p className="font-display text-xl md:text-2xl text-navy mt-3 text-center">
              Just your email — we&rsquo;ll send a magic link.
            </p>

            <form action={signInAction} className="mt-7 flex flex-col gap-5">
              <label className="flex flex-col gap-2">
                <span className="font-display text-xl text-navy">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  defaultValue={email ?? ""}
                  autoFocus
                  placeholder="grown-up@email.com"
                />
              </label>

              {error ? (
                <p className="font-display text-coral-deep">⚠️ {error}</p>
              ) : null}

              <button
                type="submit"
                className="pop pop-coral text-xl mt-2 self-center"
              >
                ✉️ Send me a magic link
              </button>
            </form>

            <p className="mt-7 text-base text-navy-soft font-body text-center">
              New here?{" "}
              <Link
                href="/join"
                className="font-display text-coral-deep hover:underline"
              >
                Sign up →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </Stage>
  );
}
