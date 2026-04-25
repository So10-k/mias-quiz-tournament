import Link from "next/link";
import { Stage } from "@/components/Stage";
import { AUTHOR_NAME } from "@/lib/author";
import { sendMagicLink } from "./actions";
import { getActiveTournament } from "@/lib/engine";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    email?: string;
    newHere?: string;
  }>;
}) {
  const { error, email, newHere } = await searchParams;
  const t = await getActiveTournament();
  const open = t ? t.registrationOpen : true;

  return (
    <Stage>
      <div className="h-[calc(100vh-128px)] flex items-center justify-center px-4">
        <div className="w-full max-w-xl">
          <div className="card px-7 py-7">
            <h1 className="font-display text-4xl md:text-5xl text-navy text-center">
              {newHere ? "Almost there! 🎈" : "Hi! 👋"}
            </h1>
            <p className="font-display text-xl md:text-2xl text-navy mt-3 text-center">
              {newHere
                ? "Tell me your name and I'll set up your account."
                : "Tell me your name and I'll send you a magic link."}
            </p>

            {!open ? (
              <p className="mt-7 font-display text-xl text-coral-deep text-center">
                Sign-ups are closed for now. The first round drops soon!
              </p>
            ) : (
              <form action={sendMagicLink} className="mt-7 flex flex-col gap-5">
                <label className="flex flex-col gap-2">
                  <span className="font-display text-xl text-navy">Your name</span>
                  <input
                    name="name"
                    required
                    maxLength={80}
                    autoComplete="name"
                    placeholder="What should we call you?"
                    autoFocus={!!newHere}
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="font-display text-xl text-navy">Your email</span>
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    defaultValue={email ?? ""}
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
            )}

            <p className="mt-7 text-base text-navy-soft font-body text-center">
              Already have an account?{" "}
              <Link
                href="/signin"
                className="font-display text-coral-deep hover:underline"
              >
                Sign in →
              </Link>
            </p>
            <p className="mt-2 text-sm text-navy-soft font-body text-center">
              No passwords here — {AUTHOR_NAME} promises. ✨
            </p>
          </div>
        </div>
      </div>
    </Stage>
  );
}
