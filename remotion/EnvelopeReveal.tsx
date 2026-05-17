// Frame-perfect envelope reveal. ~5s sequence:
//   0.0 – 1.0   closed envelope idles with a soft bob; wax seal lit
//   1.0 – 1.4   wax seal cracks + spins + fades
//   1.4 – 2.3   flap rotates up via scaleY (pivoted to top edge)
//   2.3 – 3.6   card emerges from the envelope pocket
//   3.6 – 5.0   card lifts + scales to its hero pose; confetti burst
//
// Rendered live in the browser via @remotion/player on /finals.

import {
  AbsoluteFill,
  Img,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import React from "react";

export const ENVELOPE_REVEAL_FPS = 30;
export const ENVELOPE_REVEAL_DURATION_FRAMES = ENVELOPE_REVEAL_FPS * 5; // 5s

const NAVY = "#1B2A4E";
const SUN = "#FFD93D";
const CORAL = "#E94B7E";
const PAPER_TOP = "#FFFDF0";
const PAPER_BOT = "#E8D89A";

// Envelope footprint inside the 1600×1200 stage.
const ENV_W = 880;
const ENV_H = 560;

export type EnvelopeRevealProps = {
  /** Card image — defaults to the finals invitation PNG. */
  cardImageUrl?: string;
};

export const EnvelopeReveal: React.FC<EnvelopeRevealProps> = ({
  cardImageUrl,
}) => {
  // When rendered via the Remotion CLI we need staticFile() to
  // resolve assets out of public/; when played in the browser via
  // @remotion/player a plain "/images/foo.png" path works too. The
  // helper accepts either and yields a URL Remotion can fetch.
  const resolvedCardImage = (() => {
    if (cardImageUrl) {
      // External URLs and data URLs pass through unchanged.
      if (/^(https?:|data:)/.test(cardImageUrl)) return cardImageUrl;
      const trimmed = cardImageUrl.replace(/^\//, "");
      return staticFile(trimmed);
    }
    return staticFile("images/finals-invite.png");
  })();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // ── timeline knobs ──────────────────────────────────────────────
  const sealOpacity = interpolate(t, [1.0, 1.4], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sealScale = interpolate(t, [1.0, 1.25, 1.4], [1, 1.25, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sealRotate = interpolate(t, [1.0, 1.4], [0, 35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const flapSpring = spring({
    frame: Math.max(0, frame - fps * 1.4),
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  // Open via scaleY from 1 → -1 with pivot at the top of the flap.
  const flapScaleY = 1 - flapSpring * 2; // 1 → -1

  const cardRise = spring({
    frame: Math.max(0, frame - fps * 2.3),
    fps,
    config: { damping: 16, stiffness: 70 },
  });
  const cardHero = spring({
    frame: Math.max(0, frame - fps * 3.6),
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // Closed-envelope idle bob — only before frame 30.
  const idleBob = t < 1 ? Math.sin(frame * 0.18) * 4 : 0;

  // Card vertical position. Starts inside the envelope pocket
  // (y ≈ 120 below env center) → rises to just-above-envelope
  // (y ≈ -90) → settles in frame at hero (y ≈ -40).
  // Note: with the envelope FADING during the hero beat, the card no
  // longer needs to fly far up to clear it — it can just stay
  // centered in the stage.
  const cardY = interpolate(
    cardHero,
    [0, 1],
    [interpolate(cardRise, [0, 1], [120, -90]), -40]
  );
  const cardScale = interpolate(cardRise, [0, 1], [0.6, 0.95]) *
    interpolate(cardHero, [0, 1], [1, 1.25]);
  const cardRotation = interpolate(cardRise, [0, 1], [-3, -1]) *
    (1 - cardHero);

  // Envelope (body + flap + pocket) fades out during the hero beat
  // so the letter stands alone at the end of the sequence. Fade
  // starts when the card begins lifting (cardHero > 0) and finishes
  // by the time the hero settles.
  const envelopeOpacity = interpolate(cardHero, [0, 0.4, 1], [1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at center, #DDEFFF 0%, #B7E5FF 60%, #87CEEB 100%)",
      }}
    >
      {/* Confetti burst around the hero card */}
      <ConfettiBurst t={t} />

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: ENV_W,
            height: ENV_H,
            transform: `translateY(${idleBob}px)`,
          }}
        >
          {/* ── envelope body (back face) ──────────────────────── */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(160deg, ${PAPER_TOP} 0%, ${PAPER_BOT} 100%)`,
              border: `8px solid ${NAVY}`,
              borderRadius: 22,
              boxShadow: "0 18px 36px rgba(0,0,0,0.35)",
              opacity: envelopeOpacity,
            }}
          />

          {/* ── V-fold seam (drawn beneath flap; revealed when open) ── */}
          <svg
            viewBox={`0 0 ${ENV_W} ${ENV_H}`}
            width={ENV_W}
            height={ENV_H}
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: envelopeOpacity,
            }}
          >
            <path
              d={`M 8 8 L ${ENV_W / 2} ${ENV_H * 0.55} L ${ENV_W - 8} 8`}
              stroke={NAVY}
              strokeWidth={3}
              fill="none"
              opacity={t > 1.4 ? 0 : 0.35}
            />
          </svg>

          {/* ── flap (front face when closed, back face when open) ── */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: ENV_W,
              height: ENV_H * 0.6,
              transformOrigin: "top center",
              transform: `scaleY(${flapScaleY})`,
              opacity: envelopeOpacity,
              zIndex: 4,
            }}
          >
            <svg
              viewBox={`0 0 ${ENV_W} ${ENV_H * 0.6}`}
              width={ENV_W}
              height={ENV_H * 0.6}
              style={{ display: "block" }}
            >
              <defs>
                <linearGradient id="flapFront" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFF5D0" />
                  <stop offset="100%" stopColor={PAPER_BOT} />
                </linearGradient>
              </defs>
              <path
                d={`M 8 8 L ${ENV_W - 8} 8 L ${ENV_W / 2} ${ENV_H * 0.55} Z`}
                fill="url(#flapFront)"
                stroke={NAVY}
                strokeWidth={8}
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* ── wax seal at the V-fold tip ──────────────────────── */}
          {sealOpacity > 0 ? (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: ENV_H * 0.55,
                width: 150,
                height: 150,
                marginLeft: -75,
                marginTop: -75,
                opacity: sealOpacity,
                transform: `scale(${sealScale}) rotate(${sealRotate}deg)`,
                zIndex: 8,
              }}
            >
              <WaxSeal />
            </div>
          ) : null}

          {/* ── card emerging from inside the envelope ─────────── */}
          {cardRise > 0 ? (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                width: 360,
                height: 480,
                marginLeft: -180,
                transformOrigin: "bottom center",
                transform: `translateY(${cardY}px) scale(${cardScale}) rotate(${cardRotation}deg)`,
                zIndex: 3,
                filter: "drop-shadow(0 22px 28px rgba(0,0,0,0.32))",
              }}
            >
              <Img
                src={resolvedCardImage}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  borderRadius: 18,
                }}
              />
            </div>
          ) : null}

          {/* ── front pocket (covers the bottom half; always on top) ── */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: ENV_H * 0.55,
              background: `linear-gradient(180deg, ${PAPER_BOT} 0%, #D4BD75 100%)`,
              border: `8px solid ${NAVY}`,
              borderTop: "none",
              borderRadius: "0 0 22px 22px",
              boxShadow: "inset 0 6px 12px rgba(0,0,0,0.18)",
              opacity: envelopeOpacity,
              zIndex: 5,
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ──────────────────────────────────────────────────────────────────────
// Wax seal — circular, with a wax-y radial gradient + drips + "M".
// ──────────────────────────────────────────────────────────────────────

const WaxSeal: React.FC = () => (
  <svg viewBox="0 0 100 100" width="100%" height="100%">
    <defs>
      <radialGradient id="wax-grad" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#FF6B6B" />
        <stop offset="55%" stopColor="#C9296A" />
        <stop offset="100%" stopColor="#8B1538" />
      </radialGradient>
    </defs>
    <circle cx={50} cy={50} r={42} fill="url(#wax-grad)" stroke="#5C0B22" strokeWidth={2} />
    <path
      d="M 8 52 Q 12 60 16 52  M 92 48 Q 88 58 84 50  M 30 86 Q 34 92 38 86  M 70 86 Q 74 92 78 86"
      fill="none"
      stroke="#8B1538"
      strokeWidth={3}
      strokeLinecap="round"
    />
    <text
      x={50}
      y={64}
      textAnchor="middle"
      fontFamily="Fredoka, sans-serif"
      fontWeight={700}
      fontSize={42}
      fill={SUN}
      stroke="#5C0B22"
      strokeWidth={0.5}
    >
      M
    </text>
  </svg>
);

// ──────────────────────────────────────────────────────────────────────
// Confetti burst once the card hits its hero pose.
// ──────────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [SUN, CORAL, "#87CEEB", "#5BCE7A", "#FF8C42"];

const ConfettiBurst: React.FC<{ t: number }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Only burst from the moment the card starts its hero lift.
  if (t < 3.6) return null;
  const pieces = 70;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: pieces }).map((_, i) => {
        const startSec = 3.6 + (i % 8) * 0.04;
        const startFrame = Math.floor(startSec * fps);
        const localFrame = frame - startFrame;
        if (localFrame < 0) return null;
        const life = 1.6 * fps;
        const p = Math.min(1, localFrame / life);
        if (p >= 1) return null;
        const angle = random(`a-${i}`) * Math.PI * 2;
        const speed = 350 + random(`s-${i}`) * 350;
        const x = 800 + Math.cos(angle) * speed * p;
        const y = 600 + Math.sin(angle) * speed * p + 600 * p * p; // gravity
        const rot = random(`r-${i}`) * 720 * p;
        const size = 8 + random(`sz-${i}`) * 8;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const alpha = 1 - p;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size * 1.4,
              background: color,
              border: "2px solid #1B2A4E",
              borderRadius: 3,
              opacity: alpha,
              transform: `rotate(${rot}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

