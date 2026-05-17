// "Finals Hype" video composition.
//
// 6-scene picture-book hype reel for the upcoming Grand Final. We're
// still in the semis — no finalists known yet, no date set — so the
// video stays cinematic-vague: stakes, atmosphere, the trophy. As soon
// as we know who's playing, swap WhosNext for an actual VS card.
//
// The total duration auto-matches the theme-song length (see Root.tsx's
// calculateMetadata); each scene's duration is computed as a
// proportional share of the total via SCENE_WEIGHTS so retiming the
// music auto-retimes the video.
//
// Scene weights (units, normalized to fill total):
//   intro splash         → 6
//   "GRAND FINAL" card   → 14
//   stakes / who's next  → 22
//   live-mode preview    → 22
//   confetti hype        → 18
//   outro                → 18

import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const FINALS_HYPE_FPS = 30;

const NAVY = "#1B2A4E";
const SUN = "#FFD93D";
const SUN_DEEP = "#F4A93A";
const CORAL = "#E94B7E";
const SKY = "#87CEEB";
const SKY_LIGHT = "#B7E5FF";
const GRASS = "#4FB04F";
const WHITE = "#FFFFFF";

const SCENE_WEIGHTS = [6, 14, 22, 22, 18, 18];

function computeSlots(totalFrames: number): { from: number; duration: number }[] {
  const sum = SCENE_WEIGHTS.reduce((a, b) => a + b, 0);
  const slots: { from: number; duration: number }[] = [];
  let cursor = 0;
  for (let i = 0; i < SCENE_WEIGHTS.length; i++) {
    const isLast = i === SCENE_WEIGHTS.length - 1;
    const duration = isLast
      ? totalFrames - cursor
      : Math.round((SCENE_WEIGHTS[i] / sum) * totalFrames);
    slots.push({ from: cursor, duration });
    cursor += duration;
  }
  return slots;
}

export const FinalsHype: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const slots = computeSlots(durationInFrames);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${SKY_LIGHT} 0%, ${SKY} 60%, ${GRASS} 100%)`,
        fontFamily: "Fredoka, Quicksand, system-ui, sans-serif",
      }}
    >
      {/* Audio bakes the theme song into the rendered MP4. */}
      <Audio src={staticFile("audio/theme.mp3")} volume={1} />

      <Sequence from={slots[0].from} durationInFrames={slots[0].duration}>
        <Intro />
      </Sequence>
      <Sequence from={slots[1].from} durationInFrames={slots[1].duration}>
        <TitleCard />
      </Sequence>
      <Sequence from={slots[2].from} durationInFrames={slots[2].duration}>
        <WhosNext />
      </Sequence>
      <Sequence from={slots[3].from} durationInFrames={slots[3].duration}>
        <LiveModePreview />
      </Sequence>
      <Sequence from={slots[4].from} durationInFrames={slots[4].duration}>
        <HypeMontage />
      </Sequence>
      <Sequence from={slots[5].from} durationInFrames={slots[5].duration}>
        <Outro />
      </Sequence>

      {/* Persistent ticker across the bottom edge */}
      <Ticker />
    </AbsoluteFill>
  );
};

// ─── scenes ────────────────────────────────────────────────────────

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sunScale = spring({ frame, fps, config: { damping: 8 } });
  const titleY = interpolate(frame, [10, 50], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleOpacity = interpolate(frame, [10, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          fontSize: 360,
          transform: `scale(${sunScale})`,
          filter: `drop-shadow(8px 8px 0 ${NAVY})`,
        }}
      >
        🌞
      </div>
      <div
        style={{
          marginTop: 24,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontSize: 72,
          fontWeight: 700,
          color: NAVY,
          textShadow: `4px 4px 0 ${SUN}`,
          letterSpacing: 2,
        }}
      >
        MIA&rsquo;S QUIZ TOURNAMENT
      </div>
    </AbsoluteFill>
  );
};

const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 6 } });
  const wobble = Math.sin(frame / 6) * 4;
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, ${CORAL} 0%, ${SUN_DEEP} 100%)`,
      }}
    >
      <div
        style={{
          fontSize: 36,
          color: WHITE,
          letterSpacing: 8,
          textTransform: "uppercase",
          marginBottom: 16,
          textShadow: `3px 3px 0 ${NAVY}`,
        }}
      >
        Coming up
      </div>
      <div
        style={{
          fontSize: 36,
          color: WHITE,
          letterSpacing: 4,
          marginBottom: 18,
          opacity: 0.9,
        }}
      >
        🏆
      </div>
      <div
        style={{
          fontSize: 220,
          fontWeight: 700,
          color: WHITE,
          textShadow: `8px 8px 0 ${NAVY}`,
          transform: `scale(${scale}) rotate(${wobble * 0.05}deg)`,
          letterSpacing: 4,
          whiteSpace: "nowrap",
        }}
      >
        GRAND FINAL
      </div>
      <div
        style={{
          fontSize: 36,
          color: WHITE,
          letterSpacing: 4,
          marginTop: 18,
          opacity: 0.9,
        }}
      >
        🏆
      </div>
    </AbsoluteFill>
  );
};

// "Who's next?" — silhouette VS card. Stays anonymous because we
// genuinely don't know who's making the final. As soon as the bracket
// settles, swap this for a named card variant.
const WhosNext: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const aProgress = spring({ frame: frame - 6, fps, config: { damping: 10 } });
  const bProgress = spring({ frame: frame - 36, fps, config: { damping: 10 } });
  const pulse = (Math.sin(frame / 12) + 1) / 2;
  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", gap: 40 }}
    >
      <div
        style={{
          fontSize: 32,
          color: NAVY,
          letterSpacing: 6,
          textTransform: "uppercase",
        }}
      >
        Semi-finals underway
      </div>
      <div
        style={{
          fontSize: 88,
          color: NAVY,
          fontWeight: 700,
          textShadow: `5px 5px 0 ${SUN}`,
        }}
      >
        Who will it be?
      </div>
      <div
        style={{
          display: "flex",
          gap: 60,
          alignItems: "center",
        }}
      >
        <SilhouetteCard
          color={CORAL}
          x={(1 - aProgress) * -800}
          opacity={aProgress}
          glow={pulse}
        />
        <div
          style={{
            fontSize: 80,
            color: NAVY,
            fontWeight: 700,
            opacity: Math.min(aProgress, bProgress),
          }}
        >
          VS
        </div>
        <SilhouetteCard
          color={SUN}
          x={(1 - bProgress) * 800}
          opacity={bProgress}
          glow={pulse}
        />
      </div>
    </AbsoluteFill>
  );
};

const SilhouetteCard: React.FC<{
  color: string;
  x: number;
  opacity: number;
  glow: number;
}> = ({ color, x, opacity, glow }) => {
  return (
    <div
      style={{
        background: color,
        color: NAVY,
        padding: "60px 80px",
        borderRadius: 28,
        border: `8px solid ${NAVY}`,
        boxShadow: `12px 12px 0 0 ${NAVY}`,
        fontSize: 200,
        fontWeight: 700,
        transform: `translateX(${x}px) scale(${1 + glow * 0.04})`,
        opacity,
        textShadow: `4px 4px 0 ${WHITE}`,
        minWidth: 300,
        minHeight: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      ?
    </div>
  );
};

const LiveModePreview: React.FC = () => {
  const frame = useCurrentFrame();
  // Simulate a 4-option question card with a timer ticking.
  const seconds = Math.max(0, 30 - Math.floor((frame % 180) / 6));
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        background: SKY_LIGHT,
      }}
    >
      <div
        style={{
          background: WHITE,
          border: `8px solid ${NAVY}`,
          borderRadius: 32,
          boxShadow: `12px 12px 0 0 ${NAVY}`,
          padding: 48,
          width: 1200,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <span
            style={{
              fontSize: 28,
              color: NAVY,
              opacity: 0.7,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            Live · Question 1 of 10
          </span>
          <span
            style={{
              fontSize: 32,
              padding: "6px 20px",
              borderRadius: 999,
              border: `4px solid ${NAVY}`,
              background: seconds <= 5 ? CORAL : SUN,
              color: seconds <= 5 ? WHITE : NAVY,
              fontWeight: 700,
            }}
          >
            ⏱ {seconds}s
          </span>
        </div>
        <div
          style={{
            fontSize: 64,
            color: NAVY,
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          What&rsquo;s bigger — a blue whale or a school bus?
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginTop: 40,
          }}
        >
          {["A. Blue whale", "B. School bus", "C. The same", "D. Depends"].map(
            (label, i) => (
              <div
                key={i}
                style={{
                  background: WHITE,
                  border: `4px solid ${NAVY}`,
                  borderRadius: 16,
                  padding: "18px 24px",
                  fontSize: 36,
                  color: NAVY,
                  fontWeight: 600,
                  boxShadow: `4px 4px 0 0 ${NAVY}`,
                }}
              >
                {label}
              </div>
            )
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const HypeMontage: React.FC = () => {
  const frame = useCurrentFrame();
  const drops = Array.from({ length: 36 }).map((_, i) => {
    const seed = (i * 9301 + 49297) % 233280;
    const left = (seed / 233280) * 100;
    const fall = ((frame - i * 4) % 80) / 80;
    const emoji = ["🎉", "✨", "🎊", "💥", "⭐", "🌟", "💖"][i % 7];
    return { left, fall, emoji, key: i };
  });
  const flashOpacity = (Math.sin(frame / 4) + 1) / 2;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${CORAL} 0%, ${SUN} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{ background: WHITE, opacity: flashOpacity * 0.15 }}
      />
      {drops.map((d) => (
        <span
          key={d.key}
          style={{
            position: "absolute",
            left: `${d.left}%`,
            top: `${d.fall * 100}%`,
            fontSize: 72,
            transform: `rotate(${d.fall * 360}deg)`,
            filter: `drop-shadow(3px 3px 0 ${NAVY})`,
          }}
        >
          {d.emoji}
        </span>
      ))}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            fontSize: 180,
            fontWeight: 700,
            color: WHITE,
            textShadow: `10px 10px 0 ${NAVY}`,
            letterSpacing: 4,
          }}
        >
          DON&rsquo;T MISS IT
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleScale = spring({ frame, fps, config: { damping: 10 } });
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        background: NAVY,
      }}
    >
      <div
        style={{
          fontSize: 36,
          color: SUN,
          letterSpacing: 8,
          textTransform: "uppercase",
          marginBottom: 24,
        }}
      >
        🎙️ Live · spectator-friendly
      </div>
      <div
        style={{
          fontSize: 200,
          fontWeight: 700,
          color: WHITE,
          textShadow: `10px 10px 0 ${CORAL}`,
          transform: `scale(${titleScale})`,
          whiteSpace: "nowrap",
        }}
      >
        STAY TUNED
      </div>
      <div
        style={{
          fontSize: 76,
          color: SUN,
          marginTop: 18,
          fontWeight: 700,
          textShadow: `5px 5px 0 ${CORAL}`,
        }}
      >
        the grand final is coming
      </div>
      <div
        style={{
          marginTop: 50,
          fontSize: 36,
          color: WHITE,
          opacity: 0.8,
          letterSpacing: 4,
        }}
      >
        quiz.miaswebsites.art
      </div>
    </AbsoluteFill>
  );
};

const Ticker: React.FC = () => {
  const frame = useCurrentFrame();
  const scrollX = (frame * 6) % 2400;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        background: SUN,
        borderTop: `6px solid ${NAVY}`,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          whiteSpace: "nowrap",
          fontSize: 32,
          color: NAVY,
          fontWeight: 700,
          letterSpacing: 6,
          paddingLeft: 24,
          transform: `translateX(${-scrollX}px)`,
        }}
      >
        🏆 GRAND FINAL · COMING SOON · 🎙️ LIVE BROADCAST · 🍿 BRING SNACKS
        · 🏆 GRAND FINAL · COMING SOON · 🎙️ LIVE BROADCAST · 🍿 BRING
        SNACKS ·
      </div>
    </div>
  );
};
