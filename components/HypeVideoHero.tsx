"use client";

// Front-and-center hype-video player for the homepage.
//
// Behavior:
//   • Autoplays muted on mount (browser autoplay rules require it).
//   • A loud "🔊 Tap to unmute" overlay invites the first interaction;
//     clicking flips the audio on so the embedded theme song plays.
//   • Loops forever — visitors landing mid-loop see a complete cycle
//     without intervention.
//   • If the video file is missing (404), falls back to a friendly
//     "rendering soon" card that still links to /listen so people can
//     hear the song.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  videoSrc: string;
  posterSrc?: string;
  audioFallbackSrc: string;
};

export function HypeVideoHero({
  videoSrc,
  posterSrc,
  audioFallbackSrc,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [missing, setMissing] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);

  // Autoplay attempt on mount. Muted-autoplay is universally allowed.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tryPlay = () => v.play().catch(() => {});
    if (v.readyState >= 2) tryPlay();
    else v.addEventListener("canplay", tryPlay, { once: true });
  }, []);

  const unmute = () => {
    const v = videoRef.current;
    if (v) {
      v.muted = false;
      setMuted(false);
      v.play().catch(() => {});
    }
  };

  const playAudioFallback = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => {});
      setPlayingAudio(true);
    } else {
      a.pause();
      setPlayingAudio(false);
    }
  };

  if (missing) {
    return (
      <div className="card relative w-full max-w-3xl px-6 py-7 overflow-hidden">
        <div className="text-center">
          <p className="font-display text-xs uppercase tracking-[0.25em] text-coral-deep">
            🎬 Hype video
          </p>
          <h2 className="font-display text-2xl md:text-3xl text-navy mt-2">
            Rendering — should be up soon
          </h2>
          <p className="font-body text-base text-navy-soft mt-2">
            In the meantime, hit play on the theme song.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={playAudioFallback}
              className="pop pop-coral text-base"
            >
              {playingAudio ? "⏸ Pause song" : "▶ Play theme song"}
            </button>
            <Link href="/listen" className="pop pop-yellow text-base">
              🎵 Open listen page
            </Link>
          </div>
        </div>
        <audio
          ref={audioRef}
          src={audioFallbackSrc}
          onEnded={() => setPlayingAudio(false)}
          preload="metadata"
        />
      </div>
    );
  }

  return (
    <div className="hype-hero relative w-full max-w-3xl mx-auto overflow-hidden">
      <video
        ref={videoRef}
        src={videoSrc}
        poster={posterSrc}
        muted={muted}
        loop
        playsInline
        autoPlay
        onError={() => setMissing(true)}
        className="w-full block"
        style={{ aspectRatio: "16 / 9", background: "#1B2A4E" }}
      />

      {/* Tap-to-unmute overlay — fades when user unmutes */}
      <AnimatePresence>
        {muted ? (
          <motion.button
            key="unmute"
            type="button"
            onClick={unmute}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            aria-label="Tap to unmute"
            style={{ background: "rgba(27,42,78,0.18)" }}
          >
            <div
              className="font-display text-white text-xl md:text-2xl px-6 py-4 rounded-2xl border-4 border-navy bob"
              style={{
                background: "var(--coral)",
                boxShadow: "5px 5px 0 0 var(--navy)",
                textShadow: "2px 2px 0 var(--navy)",
              }}
            >
              🔊&nbsp;Tap to unmute
            </div>
          </motion.button>
        ) : null}
      </AnimatePresence>

      {/* Always-visible mute toggle in the corner once unmuted */}
      {!muted ? (
        <button
          type="button"
          onClick={() => {
            const v = videoRef.current;
            if (v) {
              v.muted = true;
              setMuted(true);
            }
          }}
          className="absolute top-3 right-3 font-display text-xs px-3 py-1 rounded-full border-2 border-navy bg-white text-navy"
          aria-label="Mute"
        >
          🔇 Mute
        </button>
      ) : null}

      <style>{`
        .hype-hero {
          border: 4px solid var(--navy);
          border-radius: 22px;
          box-shadow: 8px 8px 0 0 var(--navy);
        }
      `}</style>
    </div>
  );
}
