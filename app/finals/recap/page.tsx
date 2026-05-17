// Post-webinar landing. Paste this URL into Zoho Webinars'
// "Redirect URL after the webinar ends" setting. Anyone who shows up
// to /live or /watch after the show ends gets sent here too (the
// gate is added separately in app/live/page.tsx + app/watch/page.tsx
// when SHOW_OVER is true).
//
// Pulls the latest tournament champion + finalist set out of the DB
// so the page is accurate as soon as Sam sets the winner in /host.
//
// URL: /finals/recap

import type { Metadata } from "next";
import Link from "next/link";
import { Stage } from "@/components/Stage";
import { SITE_URL } from "@/lib/seo";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import {
  getBracketChampionId,
  getBracket,
  getBracketUsers,
} from "@/lib/bracket";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thanks for watching — Mia's Quiz Tournament finals",
  description:
    "Recap of the Mia's Quiz Tournament finals broadcast. Champion announced, replay coming soon.",
  alternates: { canonical: `${SITE_URL}/finals/recap` },
  robots: { index: false, follow: false },
};

export default async function RecapLanding() {
  const tournament =
    (await getActiveTournament()) ?? (await getLatestTournament());

  let championName: string | null = null;
  let runnersUp: string[] = [];
  if (tournament) {
    const championId = await getBracketChampionId(tournament.id);
    const [mainBracket, losersBracket, users] = await Promise.all([
      getBracket(tournament.id, "main"),
      getBracket(tournament.id, "losers"),
      getBracketUsers(tournament.id),
    ]);

    if (championId) {
      const u = users.get(championId);
      championName = u?.name ?? u?.email ?? null;
    }

    const finalIds = new Set<string>();
    for (const b of [mainBracket, losersBracket]) {
      if (b.length === 0) continue;
      const maxR = Math.max(...b.map((r) => r.roundIndex));
      const final = b.find((r) => r.roundIndex === maxR);
      if (!final) continue;
      for (const m of final.matchups) {
        if (m.playerAUserId) finalIds.add(m.playerAUserId);
        if (m.playerBUserId) finalIds.add(m.playerBUserId);
      }
    }
    if (championId) finalIds.delete(championId);
    runnersUp = Array.from(finalIds)
      .map((id) => users.get(id))
      .map((u) => u?.name ?? u?.email ?? null)
      .filter((n): n is string => !!n);
  }

  return (
    <Stage scrollable>
      <div className="max-w-2xl mx-auto pt-10 px-4 pb-12 flex flex-col gap-4">
        <section className="card px-7 py-8 text-center border-4 border-coral-deep shadow-pop">
          <div className="text-7xl bob inline-block">🌞</div>
          <p className="font-display text-sm uppercase tracking-[0.22em] text-coral-deep mt-3">
            That's a wrap
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-navy mt-2 drop-shadow-[4px_4px_0_var(--navy)]">
            Thanks for watching.
          </h1>
          <p className="font-body text-base text-navy mt-4">
            Mia, Juliette, and Sam had a blast putting Season One on for
            you. Here&rsquo;s where to go next.
          </p>
        </section>

        {championName ? (
          <section className="card px-6 py-6 bg-sun border-4 border-navy">
            <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
              👑 Season 1 champion
            </p>
            <h2 className="font-display text-3xl text-navy mt-1">
              {championName}
            </h2>
            {runnersUp.length > 0 ? (
              <p className="font-body text-sm text-navy mt-2">
                <strong>Runners-up:</strong> {runnersUp.join(", ")}.
                Incredible season from all four.
              </p>
            ) : null}
          </section>
        ) : (
          <section className="card px-6 py-6 bg-sky1">
            <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
              Champion
            </p>
            <h2 className="font-display text-xl text-navy mt-1">
              Standings posting shortly.
            </h2>
            <p className="font-body text-sm text-navy mt-2">
              Sam is updating the bracket. Refresh in a minute or check{" "}
              <Link href="/standings" className="text-coral-deep underline">
                /standings
              </Link>
              .
            </p>
          </section>
        )}

        <section className="card px-6 py-6">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
            Three things now
          </p>
          <h2 className="font-display text-xl text-navy mt-1">
            Stay in the loop
          </h2>
          <ul className="mt-3 list-disc pl-5 flex flex-col gap-2 font-body text-base text-navy">
            <li>
              <strong>Replay</strong> — going up here once Zoho finishes
              encoding. Bookmark this page; we&rsquo;ll embed it
              tomorrow.
            </li>
            <li>
              <strong>The Aftershow</strong> — Sam &amp; Mia recap the
              night on{" "}
              <a
                href="https://discuss.miaswebsites.art/c/tournament-talk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-coral-deep underline"
              >
                Tournament Talk
              </a>
              . Three emoji ceiling per post; bedtime takes precedence.
            </li>
            <li>
              <strong>Season 2</strong> — drops on the homepage{" "}
              <Link href="/" className="text-coral-deep underline">
                quiz.miaswebsites.art
              </Link>
              . Subscribe to the digest and we&rsquo;ll text you when
              sign-ups open.
            </li>
          </ul>
        </section>

        <section className="card px-6 py-6 bg-sun">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
            🏆 Final standings
          </p>
          <h2 className="font-display text-xl text-navy mt-1">
            See the full bracket
          </h2>
          <p className="font-body text-sm text-navy mt-2">
            Eight weeks. Eleven players. The whole journey, frozen in
            time.
          </p>
          <div className="mt-4">
            <Link href="/standings" className="pop pop-coral text-base">
              📊 Open standings
            </Link>
          </div>
        </section>

        <p className="font-body text-xs text-navy-soft text-center italic">
          Mia's Quiz Tournament · Season 1 · The Grand Final
        </p>
      </div>
    </Stage>
  );
}
