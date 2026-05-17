// Picture-book event slide — TV-broadcast edition.
//
// One reusable Remotion composition for every "round intro /
// transition" beat in the show. Tuned for two uses:
//   • on the TV behind the hosts during recording (b-roll backdrop)
//   • as a full-frame cutaway in the final edit
//
// Pacing (12s total at 30fps):
//   0.0–0.8s   broadcast chrome wipes in (top ticker + lower-third bar)
//   0.8–2.0s   show kicker pops in (mini "card" pill above the title)
//   1.6–3.5s   title rises + locks with accent shadow
//   3.0–4.5s   subtitle types under
//   4.5–6.5s   matchup pill / bullet rail staggers in (when present)
//   6.5–11.5s  rest state — slow parallax on the BG shapes
//   11.5–12s   gentle fade-down so the cut is forgiving
//
// All durations are derived from the slide's actual frame count so
// the same composition works if a runbook entry lengthens it.

import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import React from "react";

export type EventSlideProps = {
  kicker?: string;
  title: string;
  subtitle?: string;
  emoji?: string;
  accent?: string; // CSS color — used for title shadow + accents
  bg?: string; // CSS color (top of gradient)
  bg2?: string; // CSS color (bottom of gradient)
  bullets?: string[];
  // Broadcast-chrome metadata. All optional — slides without these
  // just render without the corresponding chrome element.
  chapter?: string; // top-left chip ("ROUND 1 · LOSERS' BRACKET")
  showLabel?: string; // top-right station ident ("MIA'S QUIZ · S1")
  lowerThird?: string; // bottom strap ("Tonight's first match")
  matchup?: { left: string; right: string }; // big VS card under title
};

export const EVENT_SLIDE_FPS = 30;
export const EVENT_SLIDE_DURATION_FRAMES = EVENT_SLIDE_FPS * 12; // 12s

// ── timing constants in seconds, converted to frames at render time ──
const T_CHROME_IN = 0.0;
const T_CHROME_DONE = 0.8;
const T_KICKER = 0.8;
const T_TITLE = 1.6;
const T_SUBTITLE = 3.0;
const T_BULLETS = 4.5;
const T_FADE_OUT = 11.5;
const T_END = 12.0;

export const EventSlide: React.FC<EventSlideProps> = ({
  kicker = "",
  title,
  subtitle = "",
  emoji = "🌞",
  accent = "#E94B7E",
  bg = "#FFD93D",
  bg2 = "#FF8C42",
  bullets = [],
  chapter,
  showLabel = "MIA'S QUIZ · SEASON 1",
  lowerThird,
  matchup,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps; // seconds

  // ── springs ──
  const chromeIn = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 130 },
    durationInFrames: Math.round((T_CHROME_DONE - T_CHROME_IN) * fps),
  });
  const kickerIn = spring({
    frame: Math.max(0, frame - T_KICKER * fps),
    fps,
    config: { damping: 16, stiffness: 110 },
  });
  const titleIn = spring({
    frame: Math.max(0, frame - T_TITLE * fps),
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const emojiIn = spring({
    frame: Math.max(0, frame - T_TITLE * fps),
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  const subIn = spring({
    frame: Math.max(0, frame - T_SUBTITLE * fps),
    fps,
    config: { damping: 18, stiffness: 100 },
  });

  // Slow parallax — drifts the bg shapes the entire duration so the
  // rest state still feels alive instead of frozen.
  const drift = interpolate(
    frame,
    [0, EVENT_SLIDE_DURATION_FRAMES],
    [-30, 30]
  );
  const driftRot = interpolate(
    frame,
    [0, EVENT_SLIDE_DURATION_FRAMES],
    [-3, 3]
  );
  // Gentle ease-out at the end so cuts feel intentional.
  const tailFade = interpolate(
    t,
    [T_FADE_OUT, T_END],
    [1, 0.55],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${bg} 0%, ${bg2} 100%)`,
        fontFamily: "Fredoka, Quicksand, system-ui, sans-serif",
        color: "#1B2A4E",
        overflow: "hidden",
      }}
    >
      {/* ── BG decorative shapes ─────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: -160 + drift,
          top: -140,
          width: 460,
          height: 460,
          background: "rgba(255,255,255,0.32)",
          borderRadius: "50%",
          transform: `rotate(${driftRot}deg)`,
          filter: "blur(0.5px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -140 - drift * 0.6,
          bottom: -160,
          width: 420,
          height: 420,
          background: "rgba(27,42,78,0.16)",
          borderRadius: "50%",
        }}
      />
      {/* Subtle film-grain-ish vignette via radial overlay */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(27,42,78,0) 55%, rgba(27,42,78,0.28) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── TOP TICKER ────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 36,
          left: 36,
          right: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          opacity: chromeIn,
          transform: `translateY(${(1 - chromeIn) * -28}px)`,
        }}
      >
        <Chip
          background="#1B2A4E"
          color="#FFD93D"
          accent={accent}
          label={chapter ?? "📼 PRE-TAPED · S1"}
        />
        <Chip
          background="rgba(255,255,255,0.92)"
          color="#1B2A4E"
          accent={accent}
          label={showLabel}
        />
      </div>

      {/* ── MAIN STAGE ────────────────────────────────────────── */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "150px 120px 200px",
          opacity: tailFade,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 1600 }}>
          <div
            style={{
              fontSize: 200,
              lineHeight: 1,
              transform: `scale(${emojiIn}) rotate(${(1 - emojiIn) * -10}deg)`,
              filter: "drop-shadow(8px 12px 0 rgba(27,42,78,0.45))",
            }}
          >
            {emoji}
          </div>

          {kicker ? (
            <div
              style={{
                display: "inline-block",
                marginTop: 28,
                padding: "8px 24px",
                background: "rgba(255,255,255,0.95)",
                border: `3px solid #1B2A4E`,
                borderRadius: 999,
                boxShadow: `4px 4px 0 ${accent}`,
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: accent,
                opacity: Math.min(1, kickerIn),
                transform: `translateY(${(1 - kickerIn) * 20}px)`,
              }}
            >
              {kicker}
            </div>
          ) : null}

          <div
            style={{
              marginTop: 28,
              fontSize: 138,
              fontWeight: 700,
              lineHeight: 1.02,
              textShadow: `8px 8px 0 ${accent}`,
              transform: `translateY(${(1 - titleIn) * 60}px) scale(${0.88 + titleIn * 0.12})`,
              opacity: Math.min(1, titleIn),
              letterSpacing: "-0.012em",
            }}
          >
            {title}
          </div>

          {subtitle ? (
            <div
              style={{
                marginTop: 32,
                fontSize: 50,
                fontWeight: 500,
                color: "#1B2A4E",
                opacity: Math.min(1, subIn),
                transform: `translateY(${(1 - subIn) * 22}px)`,
                maxWidth: 1400,
                margin: "32px auto 0",
                lineHeight: 1.2,
              }}
            >
              {subtitle}
            </div>
          ) : null}

          {matchup ? (
            <MatchupCard left={matchup.left} right={matchup.right} accent={accent} />
          ) : null}

          {bullets.length > 0 ? (
            <div
              style={{
                marginTop: 44,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                alignItems: "center",
              }}
            >
              {bullets.map((b, i) => (
                <BulletLine key={i} text={b} index={i} accent={accent} />
              ))}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>

      {/* ── LOWER-THIRD STRAP ─────────────────────────────────── */}
      {lowerThird ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            opacity: chromeIn,
            transform: `translateY(${(1 - chromeIn) * 36}px)`,
          }}
        >
          {/* Accent strip above the lower-third (TV bug bar) */}
          <div
            style={{
              height: 10,
              background: `linear-gradient(90deg, ${accent} 0%, #FFD93D 50%, ${accent} 100%)`,
              borderTop: "2px solid #1B2A4E",
              borderBottom: "2px solid #1B2A4E",
            }}
          />
          <div
            style={{
              padding: "22px 60px",
              background: "#1B2A4E",
              color: "#FFFFFF",
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: "0.03em",
              display: "flex",
              alignItems: "center",
              gap: 24,
            }}
          >
            <span
              style={{
                background: accent,
                color: "#FFFFFF",
                padding: "6px 14px",
                borderRadius: 999,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              ON DECK
            </span>
            <span>{lowerThird}</span>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ── Chip / pill component (used for top ticker chips) ───────────────
const Chip: React.FC<{
  background: string;
  color: string;
  accent: string;
  label: string;
}> = ({ background, color, accent, label }) => (
  <div
    style={{
      background,
      color,
      padding: "8px 18px",
      borderRadius: 999,
      border: `3px solid #1B2A4E`,
      boxShadow: `4px 4px 0 ${accent}`,
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
    }}
  >
    {label}
  </div>
);

// ── Big matchup card under the title (Karen vs Marc, etc.) ──────────
const MatchupCard: React.FC<{
  left: string;
  right: string;
  accent: string;
}> = ({ left, right, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: Math.max(0, frame - T_BULLETS * fps),
    fps,
    config: { damping: 16, stiffness: 110 },
  });
  return (
    <div
      style={{
        marginTop: 44,
        display: "inline-flex",
        alignItems: "center",
        gap: 28,
        padding: "20px 40px",
        background: "rgba(255,255,255,0.95)",
        border: "4px solid #1B2A4E",
        borderRadius: 24,
        boxShadow: `8px 8px 0 ${accent}`,
        opacity: Math.min(1, enter),
        transform: `translateY(${(1 - enter) * 30}px) scale(${0.94 + enter * 0.06})`,
      }}
    >
      <span style={{ fontSize: 64, fontWeight: 700, color: "#1B2A4E" }}>
        {left}
      </span>
      <span
        style={{
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: "0.24em",
          color: accent,
          padding: "4px 16px",
          background: "#1B2A4E",
          borderRadius: 999,
        }}
      >
        VS
      </span>
      <span style={{ fontSize: 64, fontWeight: 700, color: "#1B2A4E" }}>
        {right}
      </span>
    </div>
  );
};

const BulletLine: React.FC<{ text: string; index: number; accent: string }> = ({
  text,
  index,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: Math.max(0, frame - (T_BULLETS + index * 0.3) * fps),
    fps,
    config: { damping: 16, stiffness: 110 },
  });
  return (
    <div
      style={{
        fontSize: 42,
        fontWeight: 600,
        padding: "12px 32px",
        background: "rgba(255,255,255,0.94)",
        border: `4px solid #1B2A4E`,
        borderRadius: 20,
        boxShadow: `6px 6px 0 ${accent}`,
        opacity: Math.min(1, enter),
        transform: `translateY(${(1 - enter) * 34}px)`,
      }}
    >
      {text}
    </div>
  );
};
