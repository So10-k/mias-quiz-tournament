"use client";

import { motion } from "framer-motion";

// A literal sunset scene — dusk gradient, the friendly sun half-sunk behind
// a hill silhouette, a few first stars, two birds gliding away. The whole
// page is the design; the words sit lightly on top.

export function SunsetScene({ authorName }: { authorName: string }) {
  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #1F1B4F 0%, #4B3F7E 28%, #B86C8E 56%, #F1A07C 78%, #FFC894 92%, #2A2247 100%)",
      }}
    >
      {/* Stars */}
      <Stars />

      {/* Birds */}
      <Birds />

      {/* The setting sun — sits low so the hill clips its bottom half */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.6, ease: [0.2, 0.8, 0.3, 1], delay: 0.1 }}
        className="absolute inset-x-0"
        style={{ bottom: "16vh" }}
      >
        <SunSetting />
      </motion.div>

      {/* Hill silhouette */}
      <Hill />

      {/* Text — lightweight, lower-third. Crammed into the warm horizon glow */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center pointer-events-none">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.6 }}
          className="font-display leading-none drop-shadow-[3px_3px_0_rgba(27,42,78,0.6)]"
          style={{
            color: "#FFE9C7",
            fontSize: "clamp(54px, 12vw, 132px)",
            letterSpacing: "-0.01em",
          }}
        >
          Sunsetted.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, ease: "easeOut", delay: 1.2 }}
          className="font-display mt-5 max-w-xl"
          style={{ color: "#FFEFD2", fontSize: "clamp(18px, 2.4vw, 24px)" }}
        >
          {authorName}&rsquo;s Quiz Tournament has been discarded for internal reasons.
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, ease: "easeOut", delay: 1.7 }}
          className="font-display mt-3"
          style={{
            color: "rgba(255, 233, 199, 0.7)",
            fontSize: "clamp(14px, 1.6vw, 16px)",
          }}
        >
          Thanks to everyone who signed up. Please contact me for more information, or what is coming next. &nbsp;— Sam
        </motion.p>
      </div>
    </div>
  );
}

// ─── scene parts ─────────────────────────────────────────────────────────────

function SunSetting() {
  return (
    <svg
      viewBox="0 0 600 600"
      className="mx-auto block"
      style={{ width: "min(70vw, 480px)", height: "auto" }}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="sunglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD08C" />
          <stop offset="60%" stopColor="#FFB07A" />
          <stop offset="100%" stopColor="#FF8E68" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sunbody" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFE2A8" />
          <stop offset="100%" stopColor="#FFB05A" />
        </linearGradient>
      </defs>

      {/* outer halo */}
      <circle cx="300" cy="300" r="280" fill="url(#sunglow)" opacity="0.85" />
      {/* soft inner halo */}
      <circle cx="300" cy="300" r="200" fill="url(#sunglow)" opacity="0.6" />

      {/* sun face */}
      <g>
        <circle
          cx="300"
          cy="300"
          r="130"
          fill="url(#sunbody)"
          stroke="#1B2A4E"
          strokeWidth="3"
        />
        {/* eyes */}
        <circle cx="265" cy="285" r="7" fill="#1B2A4E" />
        <circle cx="335" cy="285" r="7" fill="#1B2A4E" />
        {/* a soft, wistful little smile */}
        <path
          d="M260 332 Q300 348 340 332"
          fill="none"
          stroke="#1B2A4E"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* peach cheeks */}
        <circle cx="252" cy="312" r="9" fill="#F58A6F" opacity="0.55" />
        <circle cx="348" cy="312" r="9" fill="#F58A6F" opacity="0.55" />
      </g>
    </svg>
  );
}

function Hill() {
  return (
    <svg
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
      className="absolute bottom-0 left-0 w-full pointer-events-none"
      style={{ height: "30vh" }}
      role="img"
      aria-hidden="true"
    >
      {/* far hill (lighter) */}
      <path
        d="M0 200 C 220 130 460 140 720 175 C 980 210 1220 200 1440 150 L 1440 320 L 0 320 Z"
        fill="#3B2D5C"
        opacity="0.9"
      />
      {/* near hill (darker, in front) */}
      <path
        d="M0 240 C 240 190 480 200 720 230 C 960 260 1200 250 1440 220 L 1440 320 L 0 320 Z"
        fill="#1B1539"
      />
    </svg>
  );
}

function Stars() {
  // Sprinkle a few stars in the upper third — twinkly, varied opacity.
  const stars = [
    { x: 8, y: 8, s: 2, d: 0.6, a: 0.7 },
    { x: 16, y: 18, s: 1, d: 1.2, a: 0.5 },
    { x: 24, y: 6, s: 1.6, d: 0.9, a: 0.85 },
    { x: 36, y: 12, s: 1.2, d: 1.8, a: 0.6 },
    { x: 48, y: 4, s: 2.2, d: 1.0, a: 0.95 },
    { x: 58, y: 14, s: 1.4, d: 1.5, a: 0.55 },
    { x: 68, y: 8, s: 1, d: 0.7, a: 0.6 },
    { x: 78, y: 22, s: 1.8, d: 1.4, a: 0.75 },
    { x: 88, y: 10, s: 1.2, d: 0.8, a: 0.55 },
    { x: 92, y: 18, s: 2, d: 1.6, a: 0.8 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((s, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, s.a, s.a * 0.6, s.a] }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            repeatType: "mirror",
            delay: s.d,
          }}
          className="absolute rounded-full bg-white"
          style={{
            top: `${s.y}vh`,
            left: `${s.x}vw`,
            width: `${s.s}px`,
            height: `${s.s}px`,
            boxShadow: "0 0 6px rgba(255,255,255,0.7)",
          }}
        />
      ))}
    </div>
  );
}

function Birds() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <motion.svg
        initial={{ x: "-10vw", y: 0, opacity: 0 }}
        animate={{ x: "110vw", y: -16, opacity: [0, 1, 1, 0] }}
        transition={{ duration: 18, ease: "linear", delay: 0.5, repeat: Infinity, repeatDelay: 8 }}
        className="absolute"
        style={{ top: "30vh" }}
        width="44"
        height="20"
        viewBox="0 0 44 20"
        aria-hidden="true"
      >
        <path
          d="M2 12 Q8 2 14 10 Q20 4 26 12 Q32 4 38 10 Q40 12 42 12"
          fill="none"
          stroke="#1B1539"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </motion.svg>
      <motion.svg
        initial={{ x: "-10vw", y: 0, opacity: 0 }}
        animate={{ x: "110vw", y: -8, opacity: [0, 1, 1, 0] }}
        transition={{
          duration: 22,
          ease: "linear",
          delay: 4,
          repeat: Infinity,
          repeatDelay: 6,
        }}
        className="absolute"
        style={{ top: "38vh" }}
        width="32"
        height="16"
        viewBox="0 0 32 16"
        aria-hidden="true"
      >
        <path
          d="M2 10 Q7 3 12 9 Q17 3 22 9 Q26 4 30 9"
          fill="none"
          stroke="#1B1539"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </motion.svg>
    </div>
  );
}
