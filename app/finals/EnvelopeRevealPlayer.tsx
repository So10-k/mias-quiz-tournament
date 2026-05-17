"use client";

// Wraps the Remotion EnvelopeReveal composition in @remotion/player.
// Renders a "Click to open" overlay first so the user kicks off the
// animation themselves (browser autoplay rules don't matter for
// muted videos but the gesture also lets us trigger the EventDetails
// reveal at the right moment).

import { useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  EnvelopeReveal,
  ENVELOPE_REVEAL_FPS,
  ENVELOPE_REVEAL_DURATION_FRAMES,
} from "@/remotion/EnvelopeReveal";

export function EnvelopeRevealPlayer({
  onRevealed,
}: {
  onRevealed: () => void;
}) {
  const playerRef = useRef<PlayerRef | null>(null);
  const [phase, setPhase] = useState<"poster" | "playing" | "done">("poster");

  const startReveal = () => {
    setPhase("playing");
    // Tiny delay so the player has mounted before we play.
    setTimeout(() => {
      playerRef.current?.play();
    }, 30);
    // Fire the parent reveal hook a beat after the animation
    // settles so the page transition feels intentional rather than
    // jumpy.
    setTimeout(() => {
      setPhase("done");
      onRevealed();
    }, (ENVELOPE_REVEAL_DURATION_FRAMES / ENVELOPE_REVEAL_FPS) * 1000 - 250);
  };

  return (
    <div className="relative w-full" style={{ aspectRatio: "4 / 3" }}>
      <Player
        ref={playerRef}
        component={EnvelopeReveal}
        durationInFrames={ENVELOPE_REVEAL_DURATION_FRAMES}
        fps={ENVELOPE_REVEAL_FPS}
        compositionWidth={1600}
        compositionHeight={1200}
        controls={false}
        loop={false}
        autoPlay={false}
        acknowledgeRemotionLicense
        style={{ width: "100%", height: "100%" }}
        inputProps={{ cardImageUrl: "/images/finals-invite.png" }}
      />
      {phase === "poster" ? (
        <button
          onClick={startReveal}
          className="absolute inset-0 flex items-center justify-center group"
          style={{ background: "transparent" }}
          aria-label="Open the envelope"
        >
          <span
            className="font-display px-8 py-4 bg-navy text-white border-4 border-navy rounded-full shadow-pop text-xl tracking-[0.16em] uppercase group-hover:-translate-y-1 transition-transform"
            style={{ boxShadow: "6px 6px 0 #FFD93D" }}
          >
            ✉️ Click to open
          </span>
        </button>
      ) : null}
    </div>
  );
}
