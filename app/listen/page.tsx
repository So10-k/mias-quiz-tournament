// Dedicated listen page — full-screen experience for the site theme
// song. Picture-book album-art card, vocals/instrumental toggle, and
// a "share" button that copies a link to the page.

import Link from "next/link";
import type { Metadata } from "next";
import { Stage } from "@/components/Stage";
import { ThemeSongPlayer } from "@/components/ThemeSongPlayer";
import { AnswerCapsule } from "@/components/AnswerCapsule";
import { ld, musicRecordingLD, breadcrumbLD, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Theme Song",
  description:
    "Listen to The Quiz Book Theme — the official theme song of Mia's Quiz Tournament, written and performed by Sam.",
  alternates: { canonical: `${SITE_URL}/listen` },
};

export default async function ListenPage() {
  return (
    <Stage scrollable>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ld(musicRecordingLD())}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ld(
          breadcrumbLD([
            { name: "Home", url: SITE_URL },
            { name: "Theme Song", url: `${SITE_URL}/listen` },
          ])
        )}
      />
      <div className="max-w-2xl mx-auto pt-6 px-4 pb-14 flex flex-col gap-5">
        <AnswerCapsule
          topic="theme-song"
          question="What is the Quiz Book theme song?"
          answer="The Quiz Book Theme is the official theme song of Mia's Quiz Tournament — a short instrumental written, performed, and produced by Sam for his sister Mia. It plays over the homepage hype video, in the pre-taped finals video, and any time you tap the play button below."
        />
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <Link href="/" className="pop pop-white text-sm">
            ← Home
          </Link>
          <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
            🎵 Theme song
          </p>
        </div>

        <div className="text-center">
          <h1 className="font-display text-4xl md:text-6xl text-navy leading-none drop-shadow-[3px_3px_0_var(--navy)]">
            Mia&rsquo;s Quiz Tournament
          </h1>
          <p className="font-display text-xl md:text-2xl text-navy mt-3">
            The official theme song
          </p>
          <p className="font-body text-base text-navy-soft mt-2">
            Made for Mia, for the site, for the finals.
          </p>
        </div>

        <ThemeSongPlayer
          src="/audio/theme.mp3"
          title="The Quiz Book Theme"
          artist="By Sam · feat. Mia"
          variant="hero"
        />

        <div className="card px-6 py-5 text-center">
          <p className="font-body text-base text-navy-soft">
            Hum it. Sing along. Play it loud during the finals.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            <Link href="/" className="pop pop-coral text-base">
              ← Back home
            </Link>
            <Link href="/blog" className="pop pop-sky text-base">
              📝 Read the blog
            </Link>
          </div>
        </div>
      </div>
    </Stage>
  );
}
