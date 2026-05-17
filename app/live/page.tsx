// Recording room — pre-taped finals edition.
//
// The Saturday live broadcast was cancelled. This page is now the
// gated recording room: finalists, host, and cohosts join a Zoho
// video call to record their bracket round, and the host drives the
// LiveRoundClient quiz UI exactly the way they would have lived.
// We just capture the recording offline and edit it into a video.
//
// Same access gating as before: finalists + host + cohosts only;
// spectators get bounced to /watch.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { ZohoWebinarFrame } from "./ZohoWebinarFrame";
import { LiveRoundClient } from "@/components/LiveRoundClient";
import { getCurrentLiveRound, getLiveRoundState } from "@/lib/live";
import { evaluateFinalsAccess } from "@/lib/finals-access";
import { getZohoWebinar } from "@/lib/zoho-webinar";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recording room",
  description:
    "Pre-taped recording session for the Mia's Quiz Tournament finals. Finalists + host only.",
  alternates: { canonical: `${SITE_URL}/live` },
  robots: { index: false, follow: false },
};

const ROLE_BADGE: Record<string, string> = {
  host: "🛡️ host",
  cohost: "🎤 cohost",
  finalist: "🏆 finalist",
};

export default async function LivePage() {
  const me = await currentUser();
  if (!me) redirect("/signin?next=/live");

  const access = await evaluateFinalsAccess({
    userId: me.id,
    userRole: me.role,
  });
  if (!access.allowed) {
    // Spectators get bounced to /watch — they can follow the broadcast
    // there. We don't 404 because that would be confusing for someone
    // who clicked the SMS link expecting the show.
    redirect("/watch");
  }

  const webinar = await getZohoWebinar();
  const activeRound = await getCurrentLiveRound();
  const liveState = activeRound
    ? await getLiveRoundState({
        roundId: activeRound.id,
        viewerUserId: me.id,
      })
    : null;

  return (
    <Stage>
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4">
        <header className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.2em] text-coral-deep">
              Recording room · pre-taped
            </p>
            <h1 className="font-display text-3xl md:text-5xl text-navy mt-1 drop-shadow-[3px_3px_0_var(--navy)]">
              📼 The Finals Room
            </h1>
            <p className="font-body text-sm text-navy-soft mt-2">
              Signed in as <strong>{me.name ?? me.email}</strong> ·{" "}
              {ROLE_BADGE[access.role] ?? "🎟️ guest"}
            </p>
            <p className="font-body text-xs text-navy-soft mt-1 italic">
              No live audience — Sam records each round one-on-one
              and edits them together. Same questions, same effects,
              just no Saturday broadcast.
            </p>
          </div>
          <a
            href="https://discuss.miaswebsites.art/c/finals-room"
            className="pop pop-coral text-sm bob"
            target="_blank"
            rel="noopener noreferrer"
          >
            💬 Finals Room chat
          </a>
        </header>

        <ZohoWebinarFrame
          joinUrl={webinar.joinUrl}
          embedUrl={webinar.embedUrl}
          displayName={me.name ?? me.email ?? "Finalist"}
        />

        {liveState ? (
          <section className="card px-3 py-3">
            <p className="font-display text-xs uppercase tracking-[0.18em] text-coral-deep mb-2">
              {liveState.isFinalist
                ? "Your live question — answer right here"
                : "Live question"}
            </p>
            <p className="font-body text-xs text-navy-soft mb-3">
              {liveState.isFinalist
                ? "No need to open another tab. Tap your answer below as the host advances each question."
                : "You're seeing the broadcast as host/cohost. The two finalists in this matchup get the answer buttons."}
            </p>
            <LiveRoundClient
              roundId={liveState.roundId}
              viewerUserId={me.id}
              initialState={liveState}
            />
          </section>
        ) : (
          <section className="card px-5 py-6 text-center bg-sky1">
            <p className="font-display text-lg text-navy">
              📺 Waiting for the host
            </p>
            <p className="font-body text-sm text-navy-soft mt-2">
              The live question will appear here when the host kicks off
              the round. Stay on this page.
            </p>
          </section>
        )}

        <details className="card px-5 py-4 text-sm font-body text-navy">
          <summary className="font-display text-base cursor-pointer">
            🤔 Having trouble?
          </summary>
          <ul className="mt-3 list-disc pl-5 flex flex-col gap-1.5">
            <li>
              <strong>Webinar didn&rsquo;t open?</strong> Click the orange
              button above again — your browser may have blocked the
              first popup. Or paste the link from the registration email
              into a new tab.
            </li>
            <li>
              <strong>Camera/mic not working?</strong> Inside Zoho, click
              the camera/mic icons in the toolbar. If the toolbar shows a
              red strike-through, your browser is blocking it — open the
              site permissions and allow them.
            </li>
            <li>
              <strong>Answers not showing?</strong> Make sure you&rsquo;re
              still signed in (top right of this page). Refresh once.
            </li>
            <li>
              <strong>Safari issues?</strong> Try Chrome or Firefox.
            </li>
          </ul>
        </details>
      </div>
    </Stage>
  );
}
