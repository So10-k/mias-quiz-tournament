// Public landing for "The Writing Session" — anyone with a 4-digit
// PIN can drop into the script. No sign-in required; the PIN is the
// authorization. PINs are minted by Sam from /host/writing-session.

import type { Metadata } from "next";
import { Stage } from "@/components/Stage";
import { submitPinAction } from "./actions";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Writing Session",
  description:
    "Collaborative script workspace for Mia's Quiz Tournament finals.",
  alternates: { canonical: `${SITE_URL}/writing-session` },
  robots: { index: false, follow: false },
};

export default async function WritingSessionLanding({
  searchParams,
}: {
  searchParams: Promise<{ bad?: string }>;
}) {
  const sp = await searchParams;
  const bad = !!sp.bad;
  return (
    <Stage>
      <div className="max-w-xl mx-auto pt-12 px-4">
        <div className="card px-7 py-7 text-center">
          <div className="text-6xl bob inline-block">✍️</div>
          <p className="font-display text-sm uppercase tracking-[0.22em] text-coral-deep mt-3">
            Mia's Quiz Tournament
          </p>
          <h1 className="font-display text-3xl md:text-4xl text-navy mt-1 drop-shadow-[3px_3px_0_var(--navy)]">
            The Writing Session
          </h1>
          <p className="font-body text-base text-navy mt-4">
            Sam will text you a 4-digit code. Drop it in below to open the
            script and start editing your lines.
          </p>
          <form
            action={submitPinAction}
            className="mt-6 flex flex-col items-center gap-3"
          >
            <input
              name="pin"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              minLength={4}
              pattern="\d{4}"
              placeholder="0000"
              required
              className="bg-white text-navy text-center text-5xl font-display border-4 border-navy rounded-2xl w-48 py-3 tracking-[0.4em]"
            />
            <button className="pop pop-coral text-base">→ Enter</button>
          </form>
          {bad ? (
            <p className="font-body text-sm text-coral-deep mt-4">
              That PIN didn&rsquo;t match anything active. Ask Sam to
              re-send.
            </p>
          ) : null}
          <p className="font-body text-xs text-navy-soft mt-6 italic">
            This page is open to anyone with a code. Don&rsquo;t share
            your PIN.
          </p>
        </div>
      </div>
    </Stage>
  );
}
