"use client";

// Gameshow chrome — auto-firing animations + always-visible podiums
// driven off the live state polling. Each component is self-contained
// and triggered by parent state transitions; the parent component
// (LiveRoundClient) owns the "show / don't show" logic so each effect
// fires once per transition.

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Round-start splash ──────────────────────────────────────────

export function StartSplash({
  finalists,
  onDone,
  isPracticeMode,
}: {
  finalists: { name: string | null }[];
  onDone: () => void;
  isPracticeMode: boolean;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  const a = finalists[0]?.name ?? "Player A";
  const b = finalists[1]?.name ?? "Player B";
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(27,42,78,0.96) 30%, rgba(27,42,78,0.99) 100%)",
        }}
      />
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.1, opacity: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="relative px-8 py-10 max-w-2xl text-center"
      >
        <p
          className="font-display text-sm tracking-[0.4em] uppercase"
          style={{ color: "#FFD93D" }}
        >
          {isPracticeMode ? "Practice Round" : "The Grand Final"}
        </p>
        <h1
          className="font-display text-white mt-3 leading-none"
          style={{
            fontSize: "clamp(48px, 9vw, 110px)",
            textShadow: "5px 5px 0 #E94B7E",
          }}
        >
          🏆
        </h1>
        {finalists.length >= 2 && !isPracticeMode ? (
          <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
            <PlayerCard name={a} color="#FF6B9D" delay={0.3} />
            <span
              className="font-display text-3xl text-white"
              style={{ textShadow: "3px 3px 0 #E94B7E" }}
            >
              VS
            </span>
            <PlayerCard name={b} color="#FFD93D" delay={0.45} />
          </div>
        ) : (
          <p
            className="font-display text-3xl md:text-5xl text-white mt-4"
            style={{ textShadow: "3px 3px 0 #E94B7E" }}
          >
            LET&rsquo;S&nbsp;GO!
          </p>
        )}
      </motion.div>
    </div>
  );
}

function PlayerCard({
  name,
  color,
  delay,
}: {
  name: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, type: "spring", stiffness: 220, damping: 18 }}
      className="font-display text-2xl md:text-4xl px-5 py-3 rounded-2xl border-4 border-white"
      style={{
        background: color,
        color: "#1B2A4E",
        boxShadow: "5px 5px 0 0 #E94B7E",
      }}
    >
      {name}
    </motion.div>
  );
}

// ─── Question transition splash ──────────────────────────────────

export function QuestionTransition({
  index,
  total,
  scores,
  onDone,
}: {
  index: number;
  total: number;
  scores: { name: string | null; score: number }[];
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed inset-0 z-[88] flex items-center justify-center pointer-events-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.85 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0"
        style={{ background: "rgba(27,42,78,0.92)" }}
      />
      <motion.div
        initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, rotate: -3, opacity: 1 }}
        exit={{ scale: 1.1, opacity: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 18 }}
        className="relative px-10 py-7 rounded-3xl border-4 border-navy"
        style={{
          background:
            "linear-gradient(135deg,#FFD93D 0%,#FF8C42 50%,#FF6B9D 100%)",
          boxShadow: "10px 10px 0 0 #1B2A4E",
        }}
      >
        <p className="font-display text-sm uppercase tracking-[0.3em] text-navy">
          Question
        </p>
        <p
          className="font-display text-7xl md:text-9xl text-white leading-none"
          style={{ textShadow: "5px 5px 0 #1B2A4E" }}
        >
          {index} <span className="text-3xl text-navy">/&nbsp;{total}</span>
        </p>
        {scores.length > 0 ? (
          <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
            {scores.map((s, i) => (
              <div
                key={i}
                className="font-display text-base text-navy bg-white px-3 py-1 rounded-full border-3 border-navy shadow-pop-sm"
              >
                {s.name ?? "—"}: <strong>{s.score}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

// ─── Last-5-second countdown ─────────────────────────────────────

export function FinalCountdown({ seconds }: { seconds: number }) {
  if (seconds <= 0 || seconds > 5) return null;
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={seconds}
          initial={{ scale: 1.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="font-display leading-none"
          style={{
            fontSize: "clamp(120px, 28vw, 320px)",
            color: "#FFFFFF",
            textShadow:
              seconds <= 3
                ? "10px 10px 0 #E94B7E, 0 0 60px rgba(233,75,126,0.6)"
                : "10px 10px 0 #1B2A4E",
          }}
        >
          {seconds}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Reveal flash on lock ────────────────────────────────────────

export function RevealFlash({
  variant,
  onDone,
}: {
  variant: "correct" | "wrong" | "neutral";
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [onDone]);
  const colors = {
    correct: { bg: "rgba(34,197,94,0.55)", emoji: "✅", text: "CORRECT" },
    wrong: { bg: "rgba(220,38,38,0.55)", emoji: "❌", text: "WRONG" },
    neutral: { bg: "rgba(27,42,78,0.55)", emoji: "🔒", text: "LOCKED" },
  }[variant];
  return (
    <div className="fixed inset-0 z-[86] flex items-center justify-center pointer-events-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.4, times: [0, 0.15, 1] }}
        className="absolute inset-0"
        style={{ background: colors.bg }}
      />
      <motion.div
        initial={{ scale: 4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="font-display text-white text-6xl md:text-8xl leading-none"
        style={{
          textShadow: "5px 5px 0 rgba(27,42,78,0.9)",
        }}
      >
        {colors.emoji} {colors.text}
      </motion.div>
    </div>
  );
}

// ─── Champion ceremony ───────────────────────────────────────────

export function ChampionCeremony({
  scoreboard,
  total,
}: {
  scoreboard: { name: string | null; userId: string; score: number }[];
  total: number;
}) {
  const sorted = scoreboard
    .slice()
    .sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const tied =
    sorted.length > 1 && sorted[0].score === sorted[1].score;
  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center px-4 pointer-events-none overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center,#FFE873 0%,#FF8C42 50%,#1B2A4E 100%)",
        }}
      />
      {/* confetti rain — same approach as LiveEffectOverlay's Confetti */}
      <ChampConfetti />
      <motion.div
        initial={{ scale: 0.4, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        className="relative px-8 py-7 rounded-3xl border-4 border-navy text-center max-w-2xl"
        style={{
          background: "rgba(255,255,255,0.95)",
          boxShadow: "12px 12px 0 0 #1B2A4E",
        }}
      >
        <motion.p
          animate={{ rotate: [-8, 8, -8] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-7xl md:text-8xl"
        >
          👑
        </motion.p>
        {tied ? (
          <>
            <p className="font-display text-2xl uppercase tracking-[0.3em] text-coral-deep mt-3">
              Tied
            </p>
            <p className="font-display text-3xl md:text-4xl text-navy mt-2">
              Sudden death — host&rsquo;s call.
            </p>
          </>
        ) : top ? (
          <>
            <p className="font-display text-sm uppercase tracking-[0.3em] text-coral-deep mt-3">
              The Champion
            </p>
            <h1
              className="font-display text-navy mt-2 leading-none"
              style={{
                fontSize: "clamp(40px, 8vw, 84px)",
                textShadow: "4px 4px 0 #FFD93D",
              }}
            >
              {top.name ?? "—"}
            </h1>
            <p className="font-display text-2xl text-navy-soft mt-3">
              {top.score}{" "}
              <span className="text-base font-body">/ {total}</span>
            </p>
          </>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          {sorted.map((s, i) => (
            <div
              key={s.userId}
              className={
                "card-sm px-3 py-2 flex items-center gap-3 " +
                (i === 0 && !tied ? "bg-grass text-white" : "bg-white")
              }
            >
              <span className="font-display text-2xl">{s.score}</span>
              <span className="font-display text-base">
                {s.name ?? "—"}
              </span>
              <span className="ml-auto font-body text-xs opacity-80">
                / {total}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function ChampConfetti() {
  const drops = Array.from({ length: 60 }).map((_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.8;
    const duration = 2.5 + Math.random() * 2.5;
    const size = 26 + Math.floor(Math.random() * 30);
    const rotate = (Math.random() - 0.5) * 720;
    const emoji = ["🎉", "✨", "🎊", "🌟", "⭐", "💫"][i % 6];
    return { left, delay, duration, size, rotate, emoji, key: i };
  });
  return (
    <>
      {drops.map((d) => (
        <motion.span
          key={d.key}
          initial={{ y: -100, x: 0, rotate: 0 }}
          animate={{
            y:
              typeof window !== "undefined"
                ? window.innerHeight + 80
                : 1200,
            rotate: d.rotate,
          }}
          transition={{
            delay: d.delay,
            duration: d.duration,
            ease: "linear",
            repeat: Infinity,
          }}
          style={{
            position: "absolute",
            left: `${d.left}%`,
            fontSize: d.size,
            filter: "drop-shadow(2px 2px 0 rgba(27,42,78,0.5))",
          }}
        >
          {d.emoji}
        </motion.span>
      ))}
    </>
  );
}

// ─── Always-visible finalist podiums ─────────────────────────────

export function FinalistPodiums({
  finalists,
  myUserId,
  showAnswered,
}: {
  finalists: {
    userId: string;
    name: string | null;
    currentPickOptionId: string | null;
  }[];
  myUserId: string | null;
  // Whether to show "ANSWERED" indicator. Off when locked (so we don't
  // give away picks before reveal). On during running so finalists know
  // the other has locked in.
  showAnswered: boolean;
}) {
  if (finalists.length === 0) return null;
  return (
    <div className="card px-4 py-3 flex items-center justify-around gap-3 flex-wrap">
      {finalists.map((f, i) => {
        const me = f.userId === myUserId;
        const answered = !!f.currentPickOptionId;
        const colors = ["#FF6B9D", "#FFD93D", "#7BC4A4", "#87CEEB"];
        const color = colors[i % colors.length];
        return (
          <div
            key={f.userId}
            className="flex flex-col items-center gap-1 flex-1 min-w-[120px]"
          >
            <div
              className="font-display text-lg md:text-xl px-4 py-2 rounded-2xl border-3 border-navy w-full text-center"
              style={{
                background: color,
                color: "#1B2A4E",
                boxShadow: "3px 3px 0 0 #1B2A4E",
              }}
            >
              {f.name ?? "—"}
              {me ? <span className="ml-1 text-xs">(you)</span> : null}
            </div>
            <span
              className={
                "font-display text-xs px-2 py-0.5 rounded-full border-2 border-navy " +
                (showAnswered && answered
                  ? "bg-grass text-white"
                  : "bg-white text-navy-soft")
              }
            >
              {showAnswered
                ? answered
                  ? "✓ LOCKED IN"
                  : "Thinking…"
                : "Standing by"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sound toggle pill ───────────────────────────────────────────

export function SoundToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  // Use a ref to debounce rapid taps, but otherwise just delegate.
  const lockedRef = useRef(false);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        if (lockedRef.current) return;
        lockedRef.current = true;
        setTimeout(() => (lockedRef.current = false), 200);
        onChange(!on);
      }}
      className={
        "font-display text-xs px-3 py-1 rounded-full border-2 border-navy " +
        (on ? "bg-grass text-white" : "bg-white text-navy")
      }
      title={on ? "Sounds on — click to mute" : "Sounds muted — click to enable"}
    >
      {on ? "🔊 Sounds on" : "🔇 Muted"}
    </button>
  );
}
