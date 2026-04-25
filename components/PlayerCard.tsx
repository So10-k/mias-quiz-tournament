"use client";

import { motion } from "framer-motion";

const ringColors = [
  "bg-coral",
  "bg-sun",
  "bg-grass",
  "bg-sky2",
  "bg-coral-deep",
  "bg-sun-deep",
];

function colorFor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ringColors[h % ringColors.length];
}

type Props = {
  name: string;
  strikeCount: number;
  strikeLimit: number;
  eliminated: boolean;
  isWinner?: boolean;
};

export function PlayerCard({
  name,
  strikeCount,
  strikeLimit,
  eliminated,
  isWinner,
}: Props) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const ring = colorFor(name);
  const livesLeft = Math.max(0, strikeLimit - strikeCount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className={
        "relative card-sm px-5 py-5 flex items-center gap-5 " +
        (eliminated ? "opacity-70" : "")
      }
    >
      <div
        className={
          "shrink-0 w-20 h-20 rounded-full border-3 border-navy flex items-center justify-center " +
          ring
        }
      >
        <span className="font-display text-4xl text-navy">{initial}</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-2xl text-navy truncate">{name}</h3>
        <div className="flex items-center gap-1 mt-2">
          {Array.from({ length: strikeLimit }).map((_, i) => (
            <span key={i} className="text-2xl" aria-hidden>
              {i < livesLeft ? "❤️" : "🤍"}
            </span>
          ))}
        </div>
      </div>

      {eliminated ? (
        <div className="absolute -top-3 -right-3 px-3 py-1 rounded-xl border-3 border-navy bg-coral-deep text-white font-display text-base shadow-pop-sm rotate-6">
          OUT!
        </div>
      ) : null}

      {isWinner ? (
        <div className="absolute -top-5 left-3 px-3 py-1 rounded-xl border-3 border-navy bg-sun font-display text-base shadow-pop-sm -rotate-3">
          👑 Champion!
        </div>
      ) : null}
    </motion.div>
  );
}
