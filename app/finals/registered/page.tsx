// Post-registration landing — formerly the redirect target for Zoho
// registration. Since the finals are now pre-taped, registration is
// effectively closed; this page now serves as a friendly "we got you,
// we'll email the video" landing.

import type { Metadata } from "next";
import Link from "next/link";
import { Stage } from "@/components/Stage";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "You're on the list — Mia's Quiz Tournament finals",
  description:
    "The finals are going pre-taped. We'll email you the watch-anytime video link as soon as it's edited.",
  alternates: { canonical: `${SITE_URL}/finals/registered` },
  robots: { index: false, follow: false },
};

export default function RegisteredLanding() {
  return (
    <Stage scrollable>
      <div className="max-w-2xl mx-auto pt-10 px-4 pb-12 flex flex-col gap-4">
        <section className="card px-7 py-8 text-center border-4 border-grass shadow-pop">
          <div className="text-7xl bob inline-block">📼</div>
          <p className="font-display text-sm uppercase tracking-[0.22em] text-coral-deep mt-3">
            You&rsquo;re on the list
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-navy mt-2 drop-shadow-[4px_4px_0_var(--navy)]">
            We&rsquo;ll email the video.
          </h1>
          <p className="font-body text-base text-navy mt-4">
            Plans changed: the Saturday live broadcast is cancelled.
            We&rsquo;re recording all three rounds and editing them
            into one watch-anytime video. You&rsquo;ll get the link by
            email when it&rsquo;s ready.
          </p>
        </section>

        <section className="card px-6 py-6 bg-sun">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
            🗓 New plan
          </p>
          <h2 className="font-display text-2xl text-navy mt-1">
            Pre-taped · watch on your own time
          </h2>
          <p className="font-body text-sm text-navy mt-2">
            Mia hosts. Karen vs Marc in the Winners&rsquo; Bracket
            Final. Grandpa vs Sam in the Losers&rsquo;. WB winner vs
            LB winner in the Championship. Aiming for Sat May 23
            delivery — I&rsquo;ll send a new ETA if that slips.
          </p>
        </section>

        <section className="card px-6 py-6">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
            While you wait
          </p>
          <h2 className="font-display text-xl text-navy mt-1">
            Three things to do this week
          </h2>
          <ul className="mt-3 list-disc pl-5 flex flex-col gap-2 font-body text-base text-navy">
            <li>
              <strong>Pick your bracket.</strong> The prediction game
              closes when the video drops —{" "}
              <Link href="/standings" className="text-coral-deep underline">
                see the bracket
              </Link>
              .
            </li>
            <li>
              <strong>Watch the QOTD streak.</strong>{" "}
              <Link href="/qotd" className="text-coral-deep underline">
                Question of the Day
              </Link>{" "}
              keeps running.
            </li>
            <li>
              <strong>Join the Discourse.</strong> Hot takes go in{" "}
              <a
                href="https://discuss.miaswebsites.art/c/tournament-talk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-coral-deep underline"
              >
                Tournament Talk
              </a>
              .
            </li>
          </ul>
        </section>

        <section className="card px-6 py-6 bg-sky1 text-center">
          <p className="font-body text-base text-navy">
            Need to update your email?{" "}
            <a
              href="mailto:appdev7710@gmail.com"
              className="text-coral-deep underline"
            >
              Email Sam
            </a>{" "}
            and we&rsquo;ll fix it.
          </p>
        </section>

        <p className="font-body text-xs text-navy-soft text-center italic">
          Mia&rsquo;s Quiz Tournament · Season 1 · The Grand Final
          (pre-taped edition)
        </p>
      </div>
    </Stage>
  );
}
