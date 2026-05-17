"use client";

// Custom audio player for Mia's site theme song.
//
// Picture-book themed: thick navy border, sun-yellow scrubber, big
// coral play button, animated equalizer bars while playing. Supports
// an optional vocals / instrumental toggle (the parent passes both
// URLs; we crossfade by swapping `src` and resyncing currentTime).
//
// Graceful: if the audio file isn't present (404), we show a
// "uploading soon" card instead of a broken player.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  src: string;
  // Optional alternate track — when set, a "vocals / instrumental"
  // toggle appears. Both files MUST be the same length so swapping
  // doesn't desync the scrubber.
  altSrc?: string;
  altLabel?: string;
  primaryLabel?: string;
  // Optional cover art. Fallback is a sun-gradient with 🌞 emoji.
  coverImageUrl?: string;
  title: string;
  artist: string;
  // Compact = a slimmer card (good for homepage feature). Default is
  // the full hero card.
  variant?: "hero" | "compact";
  // When true, autoplay-attempts on mount. Browsers block this until
  // the user interacts; we silently fall back to "press play".
  autoPlay?: boolean;
};

function fmtTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ThemeSongPlayer({
  src,
  altSrc,
  altLabel = "Instrumental",
  primaryLabel = "Vocals",
  coverImageUrl,
  title,
  artist,
  variant = "hero",
  autoPlay,
}: Props) {
  const [activeSrc, setActiveSrc] = useState(src);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [missing, setMissing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Track-swap: keep currentTime when toggling vocal/instrumental.
  const swap = (next: string) => {
    if (next === activeSrc) return;
    const a = audioRef.current;
    const t = a?.currentTime ?? 0;
    const wasPlaying = !a?.paused;
    setActiveSrc(next);
    // Re-attach + seek + resume on the next render.
    queueMicrotask(() => {
      const n = audioRef.current;
      if (!n) return;
      n.currentTime = t;
      if (wasPlaying) n.play().catch(() => {});
    });
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    if (!autoPlay) return;
    const a = audioRef.current;
    if (!a) return;
    a.play().catch(() => {
      // Autoplay blocked — leave it to the user.
    });
  }, [autoPlay]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  };

  const seek = (pct: number) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    a.currentTime = Math.max(0, Math.min(duration, pct * duration));
  };

  if (missing) {
    return (
      <div className="card px-6 py-5 text-center">
        <div className="text-5xl">🎵</div>
        <h3 className="font-display text-xl text-navy mt-3">
          Theme song coming soon
        </h3>
        <p className="font-body text-sm text-navy-soft mt-2">
          Sam&rsquo;s mixing the final cut. Check back in a sec.
        </p>
      </div>
    );
  }

  const isHero = variant === "hero";

  return (
    <div
      className={
        "card relative overflow-hidden " +
        (isHero ? "px-5 py-5 md:px-6 md:py-6" : "px-4 py-3")
      }
    >
      <audio
        ref={audioRef}
        src={activeSrc}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setMissing(true)}
      />

      <div className={isHero ? "flex gap-5 items-stretch" : "flex gap-3 items-center"}>
        {/* Cover */}
        <div
          className={
            "shrink-0 rounded-2xl border-3 border-navy overflow-hidden flex items-center justify-center " +
            (isHero ? "w-32 h-32 md:w-40 md:h-40" : "w-14 h-14")
          }
          style={{
            background:
              coverImageUrl
                ? "transparent"
                : "linear-gradient(135deg,#FFE873 0%,#FFB627 60%,#FF8C42 100%)",
            boxShadow: isHero ? "5px 5px 0 0 var(--navy)" : "3px 3px 0 0 var(--navy)",
          }}
        >
          {coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span className={isHero ? "text-7xl" : "text-3xl"}>🌞</span>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p
              className={
                "font-display text-navy truncate " +
                (isHero ? "text-2xl md:text-3xl" : "text-base")
              }
            >
              {title}
            </p>
            {playing ? <Equalizer /> : null}
          </div>
          <p
            className={
              "font-body text-navy-soft truncate " +
              (isHero ? "text-base mt-1" : "text-xs")
            }
          >
            {artist}
          </p>

          {/* Scrubber */}
          <div
            className={
              "mt-3 group cursor-pointer " + (isHero ? "" : "mt-2")
            }
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              seek(pct);
            }}
          >
            <div className="h-3 rounded-full border-2 border-navy bg-white relative overflow-hidden">
              <div
                className="h-full bg-sun"
                style={{
                  width: duration ? `${(position / duration) * 100}%` : "0%",
                  transition: "width 0.15s linear",
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-1 font-body text-xs text-navy-soft">
              <span>{fmtTime(position)}</span>
              <span>{fmtTime(duration)}</span>
            </div>
          </div>

          {/* Controls row */}
          <div
            className={
              "flex items-center gap-2 flex-wrap " +
              (isHero ? "mt-3" : "mt-2")
            }
          >
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? "Pause" : "Play"}
              className={
                "pop pop-coral inline-flex items-center justify-center " +
                (isHero
                  ? "w-14 h-14 text-2xl rounded-full"
                  : "w-10 h-10 text-base rounded-full p-0")
              }
            >
              {playing ? "⏸" : "▶"}
            </button>

            {altSrc ? (
              <div className="card-sm bg-white px-1 py-1 inline-flex border-2 border-navy rounded-full text-xs">
                <button
                  type="button"
                  onClick={() => swap(src)}
                  className={
                    "font-display px-3 py-1 rounded-full " +
                    (activeSrc === src
                      ? "bg-coral text-white"
                      : "text-navy")
                  }
                >
                  {primaryLabel}
                </button>
                <button
                  type="button"
                  onClick={() => swap(altSrc)}
                  className={
                    "font-display px-3 py-1 rounded-full " +
                    (activeSrc === altSrc
                      ? "bg-coral text-white"
                      : "text-navy")
                  }
                >
                  {altLabel}
                </button>
              </div>
            ) : null}

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Unmute" : "Mute"}
                className="font-display text-base px-2 py-1 rounded-full border-2 border-navy bg-white text-navy"
              >
                {muted || volume === 0 ? "🔇" : volume > 0.6 ? "🔊" : "🔉"}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  if (v > 0 && muted) setMuted(false);
                }}
                aria-label="Volume"
                className={
                  isHero
                    ? "w-24 accent-coral-deep"
                    : "w-16 accent-coral-deep"
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Decorative animated note bursts when playing — only on hero
          variant (compact stays calm). */}
      {isHero ? (
        <AnimatePresence>
          {playing
            ? [0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  initial={{
                    opacity: 0,
                    y: 20,
                    x: 0,
                    rotate: 0,
                  }}
                  animate={{
                    opacity: [0, 1, 0],
                    y: [-30, -120],
                    x: [0, i % 2 === 0 ? 30 : -30],
                    rotate: [0, i % 2 === 0 ? 25 : -25],
                  }}
                  transition={{
                    duration: 2.4,
                    delay: i * 0.6,
                    repeat: Infinity,
                  }}
                  aria-hidden
                  className="absolute pointer-events-none text-3xl"
                  style={{
                    bottom: 16,
                    left: 80 + i * 14,
                  }}
                >
                  {["🎵", "🎶", "✨"][i]}
                </motion.span>
              ))
            : null}
        </AnimatePresence>
      ) : null}
    </div>
  );
}

// Tiny animated equalizer bars rendered next to the title while
// playback is active.
function Equalizer() {
  return (
    <span className="inline-flex items-end gap-0.5 h-4">
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          animate={{ height: ["20%", "100%", "40%", "80%", "30%"] }}
          transition={{
            duration: 0.6 + i * 0.12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="w-1 bg-coral-deep rounded-sm"
        />
      ))}
    </span>
  );
}
