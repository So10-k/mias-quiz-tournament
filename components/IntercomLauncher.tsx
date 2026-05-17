"use client";

// Custom picture-book launcher for Intercom chat.
//
// Replaces Intercom's stock blue circle with a hand-crafted sun-
// mascot button that fits the rest of the site. Subscribes to
// Intercom's unread-count event so it can render a coral badge when
// there's a new message.
//
// Clicking shows Intercom's Messenger window (which the host can
// theme via the Intercom Messenger Settings page — primary color,
// avatars, greeting, etc.).

import { useEffect, useState } from "react";

export function IntercomLauncher({ enabled }: { enabled: boolean }) {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [bobble, setBobble] = useState(0);

  // Subscribe to Intercom events once the SDK is ready. Polled with
  // a short interval because the SDK might not be loaded on the
  // first render of this component.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const attach = () => {
      if (cancelled) return;
      if (typeof window === "undefined" || typeof window.Intercom !== "function") {
        setTimeout(attach, 400);
        return;
      }
      try {
        window.Intercom("onUnreadCountChange", (count: number) => {
          if (!cancelled) setUnread(count);
        });
        window.Intercom("onShow", () => !cancelled && setOpen(true));
        window.Intercom("onHide", () => !cancelled && setOpen(false));
      } catch {
        // SDK is being torn down — ignore.
      }
    };
    attach();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Tiny pulse cycle so the button gently bobs every few seconds and
  // catches the eye. CSS-only would work but driving it via state
  // also lets us suppress the pulse when the messenger is open.
  useEffect(() => {
    if (!enabled || open) return;
    const id = setInterval(() => setBobble((b) => b + 1), 3200);
    return () => clearInterval(id);
  }, [enabled, open]);

  if (!enabled) return null;

  const handleClick = () => {
    if (typeof window.Intercom !== "function") return;
    if (open) {
      window.Intercom("hide");
      return;
    }
    // If a contextual starter is set by IntercomTracker (e.g. on
    // /play/round/3 → "I'm stuck on this round…"), open Messenger
    // to a new conversation with the body pre-filled. Otherwise just
    // show the inbox.
    const starter = window.__miaIntercomStarter;
    if (starter) {
      try {
        window.Intercom("showNewMessage", starter);
        return;
      } catch {
        /* fall through to plain show */
      }
    }
    window.Intercom("show");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={open ? "Close chat" : "Chat with Sam + Mia"}
      style={{
        position: "fixed",
        right: 22,
        bottom: 22,
        zIndex: 2147483600, // beat Zoho / Discourse embeds, beat
                            // everyone — Intercom uses ~2^31, we
                            // sit just under it
        width: 76,
        height: 76,
        borderRadius: "50%",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        animation: open
          ? "none"
          : `mia-launcher-bob 3.2s ease-in-out ${bobble % 2 === 0 ? "0s" : "1.6s"} infinite`,
      }}
    >
      <SunMascot open={open} />
      {unread > 0 ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            minWidth: 26,
            height: 26,
            padding: "0 6px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#C9296A",
            color: "#FFFFFF",
            border: "3px solid #1B2A4E",
            borderRadius: 999,
            fontFamily: "Fredoka, sans-serif",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.02em",
            boxShadow: "2px 2px 0 #1B2A4E",
          }}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
      <style jsx>{`
        @keyframes mia-launcher-bob {
          0%,
          100% {
            transform: translateY(0) rotate(-2deg);
          }
          50% {
            transform: translateY(-6px) rotate(2deg);
          }
        }
      `}</style>
    </button>
  );
}

function SunMascot({ open }: { open: boolean }) {
  // 76×76 sun with a face, framed by a navy ring and dropping a sun-
  // yellow shadow. When the messenger is open, the face winks (one
  // eye becomes an arc).
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
      {/* shadow */}
      <ellipse cx={50} cy={92} rx={32} ry={5} fill="rgba(0,0,0,0.25)" />
      {/* rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const r1 = 36;
        const r2 = 46;
        const rad = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={50 + r1 * Math.cos(rad)}
            y1={50 + r1 * Math.sin(rad)}
            x2={50 + r2 * Math.cos(rad)}
            y2={50 + r2 * Math.sin(rad)}
            stroke="#1B2A4E"
            strokeWidth={5}
            strokeLinecap="round"
          />
        );
      })}
      {/* sun body */}
      <circle
        cx={50}
        cy={50}
        r={32}
        fill="#FFD93D"
        stroke="#1B2A4E"
        strokeWidth={5}
      />
      {/* face — left eye */}
      <circle cx={40} cy={46} r={3.2} fill="#1B2A4E" />
      {/* face — right eye (winks when open) */}
      {open ? (
        <path
          d="M 56 46 Q 60 49 64 46"
          fill="none"
          stroke="#1B2A4E"
          strokeWidth={3}
          strokeLinecap="round"
        />
      ) : (
        <circle cx={60} cy={46} r={3.2} fill="#1B2A4E" />
      )}
      {/* smile */}
      <path
        d="M 38 58 Q 50 68 62 58"
        fill="none"
        stroke="#1B2A4E"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      {/* blush */}
      <circle cx={36} cy={56} r={3.2} fill="#FF9EBA" opacity={0.85} />
      <circle cx={64} cy={56} r={3.2} fill="#FF9EBA" opacity={0.85} />
      {/* tiny speech-bubble tail in the corner so it reads as a chat
          launcher even at a glance */}
      <path
        d="M 76 64 L 88 78 L 70 78 Z"
        fill="#FFD93D"
        stroke="#1B2A4E"
        strokeWidth={4}
        strokeLinejoin="round"
      />
    </svg>
  );
}
