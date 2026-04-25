"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  src: string;
  poster?: string;
  triggerLabel?: string;
};

// A picture-book-style video player overlay. Click to open, custom controls,
// auto-closes with a sun-burst when the video finishes.
export function MeetMiaPlayer({
  src,
  poster,
  triggerLabel = "🎬 Meet Mia",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pop pop-yellow text-lg"
      >
        {triggerLabel}
      </button>
      <AnimatePresence>
        {open ? (
          <PlayerModal src={src} poster={poster} onClose={() => setOpen(false)} />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function PlayerModal({
  src,
  poster,
  onClose,
}: {
  src: string;
  poster?: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [bursting, setBursting] = useState(false);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") triggerClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setHasStarted(true);
    } else {
      v.pause();
    }
  }, []);

  const seek = (frac: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const t = Math.min(duration, Math.max(0, frac * duration));
    v.currentTime = t;
    setTime(t);
  };

  const triggerClose = () => {
    const v = videoRef.current;
    if (v) v.pause();
    onClose();
  };

  const onEnded = () => {
    // Play a brief celebratory burst then auto-close.
    setBursting(true);
    setTimeout(() => onClose(), 900);
  };

  const fmt = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = (s % 60).toString().padStart(2, "0");
    return `${m}:${r}`;
  };

  const progressFrac = duration > 0 ? Math.min(1, time / duration) : 0;

  return (
    <motion.div
      key="scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={triggerClose}
      style={{ background: "rgba(27, 42, 78, 0.55)", backdropFilter: "blur(4px)" }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16, rotate: -1, opacity: 0 }}
        animate={
          bursting
            ? { scale: 1.06, rotate: 1, opacity: 0 }
            : { scale: 1, y: 0, rotate: 0, opacity: 1 }
        }
        exit={{ scale: 0.92, y: 16, opacity: 0 }}
        transition={{ duration: bursting ? 0.6 : 0.24, ease: [0.2, 0.8, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative card w-full max-w-2xl bg-cloud overflow-hidden"
        style={{ borderRadius: 24 }}
      >
        {/* Banner */}
        <div className="flex items-center justify-between px-5 py-3 border-b-3 border-navy bg-sun">
          <span className="font-display text-lg text-navy">🌞 Meet Mia</span>
          <button
            type="button"
            onClick={triggerClose}
            aria-label="Close"
            className="pop pop-white text-sm px-3 py-1"
          >
            ✕
          </button>
        </div>

        {/* Video */}
        <div className="relative bg-navy">
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) =>
              setDuration((e.currentTarget as HTMLVideoElement).duration || 0)
            }
            onTimeUpdate={(e) =>
              setTime((e.currentTarget as HTMLVideoElement).currentTime || 0)
            }
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={onEnded}
            onClick={togglePlay}
            className="w-full block aspect-video object-contain bg-navy cursor-pointer"
          />
          {/* Big tap-to-play overlay (shown while paused) */}
          {!playing ? (
            <button
              type="button"
              onClick={togglePlay}
              aria-label={hasStarted ? "Play" : "Start the video"}
              className="absolute inset-0 flex items-center justify-center group"
            >
              <motion.span
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.18 }}
                className="flex items-center justify-center w-24 h-24 rounded-full border-4 border-navy bg-coral text-white shadow-pop-lg group-hover:bg-coral-deep"
              >
                <span className="text-5xl translate-x-[2px]">▶</span>
              </motion.span>
            </button>
          ) : null}

          {/* Sun-burst on close */}
          <AnimatePresence>
            {bursting ? <SunBurst /> : null}
          </AnimatePresence>
        </div>

        {/* Custom controls */}
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="pop pop-coral w-12 h-12 p-0 flex items-center justify-center text-2xl rounded-full"
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <span className="font-display text-sm text-navy w-14 text-center">
            {fmt(time)}
          </span>
          <ScrubBar
            progress={progressFrac}
            onSeek={seek}
            disabled={duration === 0}
          />
          <span className="font-display text-sm text-navy-soft w-14 text-center">
            {fmt(duration)}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// A draggable progress bar with picture-book styling.
function ScrubBar({
  progress,
  onSeek,
  disabled,
}: {
  progress: number;
  onSeek: (frac: number) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const fracFromEvent = (clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    onSeek(fracFromEvent(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    onSeek(fracFromEvent(e.clientX));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      ref={ref}
      className={
        "flex-1 h-6 rounded-full border-3 border-navy bg-white relative " +
        (disabled ? "opacity-50" : "cursor-pointer")
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="slider"
      aria-label="Video progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      <div
        className="h-full rounded-full bg-coral"
        style={{ width: `${progress * 100}%`, transition: dragging ? "none" : "width 100ms linear" }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-3 border-navy bg-sun shadow-pop-sm pointer-events-none"
        style={{
          left: `calc(${progress * 100}% - 14px)`,
          transition: dragging ? "none" : "left 100ms linear",
        }}
      />
    </div>
  );
}

// Tiny animation: a sun expanding outward + sparkles flying out.
function SunBurst() {
  const sparkles = Array.from({ length: 12 }, (_, i) => i);
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.85, ease: "easeOut" }}
    >
      <motion.div
        initial={{ scale: 0.4, rotate: 0 }}
        animate={{ scale: 2.4, rotate: 80 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="text-7xl"
      >
        🌞
      </motion.div>
      {sparkles.map((i) => {
        const angle = (i / sparkles.length) * Math.PI * 2;
        const distance = 200;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        return (
          <motion.span
            key={i}
            className="absolute text-3xl"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
            animate={{ x: dx, y: dy, opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            {i % 2 === 0 ? "✨" : "⭐"}
          </motion.span>
        );
      })}
    </motion.div>
  );
}
