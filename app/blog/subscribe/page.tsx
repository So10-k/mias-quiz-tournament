// Public newsletter signup form.

import Link from "next/link";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { subscribeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const me = await currentUser();

  return (
    <Stage scrollable>
      <div className="max-w-xl mx-auto pt-6 px-4 pb-12 flex flex-col gap-4">
        <Link href="/blog" className="pop pop-white text-sm self-start">
          ← Blog
        </Link>

        <div className="card px-7 py-7 text-center">
          <div className="text-6xl bob">✉️</div>
          <h1 className="font-display text-3xl md:text-4xl text-navy mt-3">
            Subscribe to the Quiz Book blog
          </h1>
          <p className="font-body text-base text-navy-soft mt-2">
            Stories from Mia, behind-the-scenes from Sam, tournament
            recaps. Pick a cadence — opt out anytime.
          </p>
        </div>

        {sp.ok === "sent" ? (
          <div className="card-sm bg-grass text-white px-5 py-4">
            <p className="font-display text-base">
              ✓ Check your inbox — we sent a confirmation link.
            </p>
            <p className="font-body text-sm mt-1">
              Click the link to finish signing up. (Sometimes lands in
              promotions / spam.)
            </p>
          </div>
        ) : null}

        {sp.ok === "already-confirmed" ? (
          <div className="card-sm bg-grass text-white px-5 py-4">
            <p className="font-display text-base">
              ✓ You&rsquo;re on the list! Look out for the next digest.
            </p>
          </div>
        ) : null}

        {sp.ok === "unsubscribed" ? (
          <div className="card-sm bg-sky1 text-navy px-5 py-4">
            <p className="font-display text-base">
              ✓ Unsubscribed. You won&rsquo;t get any more digests. (Hop
              back on anytime by submitting the form below.)
            </p>
          </div>
        ) : null}

        {sp.error ? (
          <div className="card-sm bg-coral-deep text-white px-5 py-4">
            <p className="font-display text-base">⚠️ {sp.error}</p>
          </div>
        ) : null}

        <form action={subscribeAction} className="card px-6 py-6 flex flex-col gap-3">
          <label className="font-display text-sm text-navy">
            Email
            <input
              name="email"
              type="email"
              defaultValue={me?.email ?? ""}
              required
              maxLength={200}
              className="card-sm bg-white px-3 py-2 w-full mt-1 font-body text-base border-2 border-navy"
              placeholder="you@example.com"
            />
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className="font-display text-sm text-navy mb-1">
              Frequency
            </legend>
            {[
              {
                value: "daily",
                label: "Daily",
                blurb: "Every morning if there's something new.",
              },
              {
                value: "weekly",
                label: "Weekly",
                blurb:
                  "Sunday morning roundup of everything from the past week.",
              },
              {
                value: "monthly",
                label: "Monthly",
                blurb:
                  "First-of-the-month digest. The lightest cadence.",
              },
            ].map((f, i) => (
              <label
                key={f.value}
                className="card-sm bg-white px-3 py-2 flex items-start gap-3 cursor-pointer border-2 border-navy"
              >
                <input
                  type="radio"
                  name="frequency"
                  value={f.value}
                  defaultChecked={i === 1}
                  className="mt-1"
                />
                <span className="flex-1">
                  <p className="font-display text-base text-navy">
                    {f.label}
                  </p>
                  <p className="font-body text-xs text-navy-soft">
                    {f.blurb}
                  </p>
                </span>
              </label>
            ))}
          </fieldset>
          <button className="pop pop-coral text-base mt-2 self-start">
            ✨ Send confirmation email
          </button>
          <p className="font-body text-xs text-navy-soft">
            We&rsquo;ll send you one click-to-confirm email. Nothing
            else until you confirm.
          </p>
        </form>
      </div>
    </Stage>
  );
}
