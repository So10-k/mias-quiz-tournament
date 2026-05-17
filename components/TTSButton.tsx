"use client";

// Tiny play/stop button that streams Groq Orpheus TTS for arbitrary text
// via /api/tts. We hash the text in the browser (Web Crypto SHA-1) so the
// URL is stable and CDN-cacheable.
//
// First click: HTTP request → Groq generates → audio plays. Subsequent
// clicks for the same text are CDN-cached and instant. We also keep a
// per-instance Audio() reference so toggle stops the current playback.

import { useEffect, useRef, useState } from "react";

async function sha1Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-1", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Props = {
  text: string;
  className?: string;
  // Compact mode = icon-only button; default = icon + label.
  compact?: boolean;
  label?: string;
  // Auto-play when text changes — used inside ChapterRunner so each new
  // question reads automatically when reached. Players can still tap to
  // mute mid-sentence.
  autoPlay?: boolean;
};

export function TTSButton({
  text,
  className,
  compact,
  label,
  autoPlay,
}: Props) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTextRef = useRef<string>("");

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setState("idle");
  };

  const play = async (forText: string) => {
    if (!forText.trim()) return;
    stop();
    setError(null);
    setState("loading");
    let hash: string;
    try {
      hash = await sha1Hex(forText);
    } catch (e) {
      setState("idle");
      setError("hash unavailable");
      return;
    }
    const url = `/api/tts?h=${encodeURIComponent(
      hash
    )}&t=${encodeURIComponent(forText)}`;
    const a = new Audio(url);
    audioRef.current = a;
    currentTextRef.current = forText;
    a.addEventListener("playing", () => setState("playing"));
    a.addEventListener("ended", () => {
      setState("idle");
      audioRef.current = null;
    });
    a.addEventListener("error", () => {
      setState("idle");
      setError("audio failed");
      audioRef.current = null;
    });
    try {
      await a.play();
    } catch {
      // Autoplay may be blocked until first user gesture — silent fail and
      // wait for explicit click.
      setState("idle");
    }
  };

  // Auto-play when text changes (used inside the runner).
  useEffect(() => {
    if (!autoPlay) return;
    if (currentTextRef.current === text) return;
    play(text);
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, autoPlay]);

  // Stop any in-flight audio when the component unmounts.
  useEffect(() => {
    return () => stop();
  }, []);

  const onClick = () => {
    if (state === "playing" || state === "loading") {
      stop();
    } else {
      play(text);
    }
  };

  const icon = state === "loading" ? "⏳" : state === "playing" ? "⏸" : "🔊";
  const tip =
    state === "playing"
      ? "Stop"
      : state === "loading"
        ? "Loading…"
        : "Read aloud";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={tip}
      title={error ?? tip}
      className={
        className ??
        "pop pop-sky text-sm px-3 py-1.5 inline-flex items-center gap-1.5"
      }
    >
      <span aria-hidden>{icon}</span>
      {compact ? null : <span>{label ?? "Listen"}</span>}
    </button>
  );
}
