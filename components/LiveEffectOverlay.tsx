"use client";

// Renders the host-triggered live effects on every connected client.
//
// The component takes the current `effect` snapshot from the live state
// (effect type + ISO timestamp + optional message). Whenever the
// timestamp changes, the matching overlay plays for ~3-5 seconds then
// auto-fades. Same effect re-fired with a new timestamp plays again —
// useful for double confetti, multiple drumrolls, etc.
//
// Implementation note: we don't depend on a confetti library — emoji
// rain via framer-motion gives us 80% of the joy at 0% of the bundle.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type LiveEffectId =
  | "confetti"
  | "fanfare"
  | "boom"
  | "fireworks"
  | "drumroll"
  | "approve"
  | "tomato"
  | "hearts"
  | "pressure"
  | "banner";

type Props = {
  effect: LiveEffectId | null;
  // ISO string. Used as the play-once dedup key.
  at: string | null;
  message: string | null;
};

// Lifetime per effect, in ms. Effects auto-clear from the screen after
// this elapses; the host can also re-arm a fresh play earlier.
const EFFECT_DURATION: Record<LiveEffectId, number> = {
  confetti: 4500,
  fanfare: 3500,
  boom: 800,
  fireworks: 3500,
  drumroll: 4500,
  approve: 3500,
  tomato: 1800,
  hearts: 4500,
  pressure: 5000,
  banner: 5000,
};

export function LiveEffectOverlay({ effect, at, message }: Props) {
  // `current` = the effect actively playing. We store it locally so it
  // can outlive the server-side row (which the host might clear or
  // overwrite while ours is still animating).
  const [current, setCurrent] = useState<{
    effect: LiveEffectId;
    at: string;
    message: string | null;
    nonce: number;
  } | null>(null);
  const lastPlayedAtRef = useRef<string | null>(null);
  const nonceRef = useRef(0);

  useEffect(() => {
    if (!effect || !at) return;
    if (lastPlayedAtRef.current === at) return; // already played
    lastPlayedAtRef.current = at;
    nonceRef.current += 1;
    setCurrent({ effect, at, message, nonce: nonceRef.current });
    const t = setTimeout(() => {
      // Only clear if a new effect didn't preempt us.
      setCurrent((c) =>
        c && c.nonce === nonceRef.current ? null : c
      );
    }, EFFECT_DURATION[effect] ?? 3500);
    return () => clearTimeout(t);
  }, [effect, at, message]);

  return (
    <AnimatePresence>
      {current ? (
        <motion.div
          key={`${current.effect}-${current.nonce}`}
          className="fixed inset-0 z-[80] pointer-events-none overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <EffectBody
            effect={current.effect}
            message={current.message}
            nonce={current.nonce}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function EffectBody({
  effect,
  message,
  nonce,
}: {
  effect: LiveEffectId;
  message: string | null;
  nonce: number;
}) {
  switch (effect) {
    case "confetti":
      return <Confetti emojis={["🎉", "✨", "🌟", "🎊", "💫"]} count={50} nonce={nonce} />;
    case "fireworks":
      return <Confetti emojis={["💥", "🎆", "🎇", "✨"]} count={40} nonce={nonce} />;
    case "hearts":
      return <Confetti emojis={["❤️", "💖", "💗", "💕", "💞"]} count={40} nonce={nonce} />;
    case "fanfare":
      return <Fanfare text={message ?? "🏆 NICE!"} />;
    case "approve":
      return <ApproveStamp />;
    case "tomato":
      return <TomatoSplat />;
    case "boom":
      return <Boom />;
    case "drumroll":
      return <Drumroll />;
    case "pressure":
      return <Pressure />;
    case "banner":
      return <Banner text={message ?? "🎙️ HEADS UP"} />;
    default:
      return null;
  }
}

// ─── Effects ───────────────────────────────────────────────────────

function Confetti({
  emojis,
  count,
  nonce,
}: {
  emojis: string[];
  count: number;
  nonce: number;
}) {
  // Generate stable random positions per render so each fire feels new.
  // useMemo would be the right tool if React.useMemo wasn't dispensable
  // here — re-keying the component (via nonce) re-mounts and we
  // recompute fresh.
  const drops = Array.from({ length: count }).map((_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.6;
    const duration = 2.2 + Math.random() * 2;
    const size = 28 + Math.floor(Math.random() * 26);
    const rotate = (Math.random() - 0.5) * 540;
    const emoji = emojis[i % emojis.length];
    return { left, delay, duration, size, rotate, emoji, key: `${nonce}-${i}` };
  });
  return (
    <>
      {drops.map((d) => (
        <motion.span
          key={d.key}
          initial={{ y: -80, x: 0, opacity: 1, rotate: 0 }}
          animate={{
            y: typeof window !== "undefined" ? window.innerHeight + 60 : 1000,
            rotate: d.rotate,
          }}
          transition={{ delay: d.delay, duration: d.duration, ease: "linear" }}
          style={{
            position: "absolute",
            left: `${d.left}%`,
            fontSize: d.size,
            filter: "drop-shadow(2px 2px 0 rgba(27,42,78,0.45))",
          }}
        >
          {d.emoji}
        </motion.span>
      ))}
    </>
  );
}

function Fanfare({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-6">
      <motion.div
        initial={{ scale: 0.4, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: -3, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{
          type: "spring",
          stiffness: 320,
          damping: 14,
        }}
        className="font-display text-white text-5xl md:text-7xl px-8 py-6 rounded-3xl border-4 border-navy"
        style={{
          background:
            "linear-gradient(135deg,#FFD93D 0%,#FF8C42 50%,#FF6B9D 100%)",
          boxShadow: "12px 12px 0 0 rgba(27,42,78,1)",
          textShadow: "4px 4px 0 rgba(27,42,78,1)",
        }}
      >
        {text}
      </motion.div>
    </div>
  );
}

function ApproveStamp() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        initial={{ scale: 4, rotate: -25, opacity: 0 }}
        animate={{ scale: 1, rotate: -8, opacity: 1 }}
        exit={{ scale: 1.05, opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="font-display text-3xl md:text-5xl px-8 py-5 border-8 rounded-lg"
        style={{
          color: "#E94B7E",
          borderColor: "#E94B7E",
          background: "rgba(255,255,255,0.92)",
          textShadow: "none",
          letterSpacing: "0.08em",
        }}
      >
        ⭐ MIA APPROVES ⭐
      </motion.div>
    </div>
  );
}

function TomatoSplat() {
  // A handful of tomato emoji splats randomly across the screen + a
  // big red splat overlay. Quick and punishing.
  const splats = Array.from({ length: 8 }).map((_, i) => ({
    left: 5 + Math.random() * 90,
    top: 5 + Math.random() * 90,
    delay: Math.random() * 0.18,
    rotate: (Math.random() - 0.5) * 180,
    size: 50 + Math.random() * 50,
    key: i,
  }));
  return (
    <>
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.35, 0] }}
        transition={{ duration: 1.6 }}
        style={{ background: "rgba(220,38,38,0.4)" }}
      />
      {splats.map((s) => (
        <motion.span
          key={s.key}
          initial={{ scale: 0, opacity: 0, rotate: 0 }}
          animate={{ scale: 1, opacity: 1, rotate: s.rotate }}
          exit={{ opacity: 0 }}
          transition={{ delay: s.delay, duration: 0.25, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: `${s.left}%`,
            top: `${s.top}%`,
            fontSize: s.size,
            filter: "drop-shadow(3px 3px 0 rgba(80,0,0,0.5))",
          }}
        >
          🍅
        </motion.span>
      ))}
    </>
  );
}

function Boom() {
  return (
    <>
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0] }}
        transition={{ duration: 0.6, times: [0, 0.2, 1] }}
        style={{ background: "#FF4D4D" }}
      />
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{
          scale: [0.5, 1.4, 1.1],
          opacity: [0, 1, 0],
          x: [0, -8, 8, -6, 6, 0],
        }}
        transition={{ duration: 0.7 }}
      >
        <span
          className="font-display text-7xl md:text-9xl text-white"
          style={{ textShadow: "8px 8px 0 #1B2A4E" }}
        >
          💥 BOOM
        </span>
      </motion.div>
    </>
  );
}

function Drumroll() {
  return (
    <div className="absolute inset-x-0 bottom-10 flex items-center justify-center">
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="font-display text-3xl md:text-5xl px-7 py-4 rounded-2xl border-4 border-navy bg-sun text-navy"
        style={{ boxShadow: "8px 8px 0 0 rgba(27,42,78,1)" }}
      >
        <motion.span
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 0.18, repeat: 24 }}
          style={{ display: "inline-block" }}
        >
          🥁
        </motion.span>{" "}
        DRUMROLL…
      </motion.div>
    </div>
  );
}

function Pressure() {
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, 0.45, 0.1, 0.45, 0.1, 0.45, 0.1, 0.45, 0],
      }}
      transition={{ duration: 5, ease: "linear" }}
      style={{
        background:
          "radial-gradient(ellipse at center, transparent 30%, rgba(220,38,38,0.55) 100%)",
      }}
    />
  );
}

function Banner({ text }: { text: string }) {
  return (
    <div className="absolute inset-x-0 top-1/3 flex items-center justify-center px-4">
      <motion.div
        initial={{ y: -40, scale: 0.8, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 40, scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="font-display text-3xl md:text-5xl text-white text-center px-8 py-6 rounded-3xl border-4 border-navy max-w-3xl"
        style={{
          background:
            "linear-gradient(135deg,#1B2A4E 0%,#3B4A7E 50%,#E94B7E 100%)",
          boxShadow: "10px 10px 0 0 rgba(27,42,78,1)",
          textShadow: "3px 3px 0 rgba(27,42,78,1)",
        }}
      >
        {text}
      </motion.div>
    </div>
  );
}
