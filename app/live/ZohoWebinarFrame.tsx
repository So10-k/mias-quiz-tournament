"use client";

// Render the Zoho Webinar inside /live.
//
// Two modes:
//   - embedUrl present: iframe the webinar so the finalist never leaves
//     the picture-book shell. They still get camera/mic prompts; that's
//     handled by the iframe permission attributes.
//   - embedUrl empty: render a big "Open the webinar" button that pops
//     the join URL in a new tab. Used during early setup before Sam has
//     pasted the embed URL.

import { useState } from "react";

export function ZohoWebinarFrame({
  joinUrl,
  embedUrl,
  displayName,
}: {
  joinUrl: string;
  embedUrl: string;
  displayName: string;
}) {
  const [opened, setOpened] = useState(false);

  if (embedUrl) {
    // Append display-name hint via query string if the embed URL doesn't
    // already carry one. Zoho's webinar URLs typically accept `?name=`.
    const u = appendName(embedUrl, displayName);
    return (
      <div className="card p-3 md:p-4">
        <iframe
          src={u}
          allow="camera; microphone; autoplay; clipboard-read; clipboard-write; display-capture; fullscreen"
          className="w-full rounded-xl border-3 border-navy"
          style={{ minHeight: 620, background: "#1B2A4E" }}
        />
        <p className="font-body text-[11px] text-navy-soft mt-2 italic">
          Trouble seeing video? Click the lock 🔒 in the address bar →
          allow camera + microphone, then refresh. Or{" "}
          <a
            href={appendName(joinUrl || embedUrl, displayName)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-coral-deep underline"
          >
            open in a new tab
          </a>
          .
        </p>
      </div>
    );
  }

  if (!joinUrl) {
    return (
      <div className="card px-5 py-6 text-center bg-sky1">
        <p className="font-display text-lg text-navy">
          🎙️ Webinar URL hasn&rsquo;t been set yet
        </p>
        <p className="font-body text-sm text-navy-soft mt-2">
          The host needs to paste the Zoho Webinar link in{" "}
          <strong>/host/finals-control</strong>. Sit tight — refresh in a
          minute.
        </p>
      </div>
    );
  }

  return (
    <div className="card px-5 py-8 text-center">
      <p className="font-display text-sm uppercase tracking-[0.2em] text-coral-deep">
        Live broadcast
      </p>
      <h2 className="font-display text-3xl text-navy mt-2">
        🎙️ Time to join the webinar
      </h2>
      <p className="font-body text-base text-navy mt-3 max-w-xl mx-auto">
        Click below — Zoho will open in a new tab. Allow camera and
        microphone when it asks. Keep <em>this</em> page open too — your
        answer buttons will appear here below as soon as the host kicks
        off the first round.
      </p>
      <a
        href={appendName(joinUrl, displayName)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setOpened(true)}
        className="pop pop-coral text-lg mt-5 inline-block bob"
      >
        🚪 Open Zoho Webinar →
      </a>
      {opened ? (
        <p className="font-body text-xs text-navy-soft mt-4 italic">
          Webinar opened in a new tab. Switch back here for the quiz
          buttons.
        </p>
      ) : null}
    </div>
  );
}

function appendName(url: string, name: string): string {
  if (!url) return url;
  if (/[?&](name|attendee_name)=/i.test(url)) return url;
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return url;
  return url + (url.includes("?") ? "&" : "?") + "name=" + encodeURIComponent(trimmed);
}
