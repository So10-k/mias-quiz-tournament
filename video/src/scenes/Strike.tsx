import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { palette, fonts, shadows } from "../theme";
import { PopButton } from "../components/PopButton";
import { QuizCard } from "../components/QuizCard";

const Q1 = {
  prompt: "What planet is closest to the Sun?",
  options: [
    { letter: "A", text: "Mercury" },
    { letter: "B", text: "Venus" },
    { letter: "C", text: "Mars" },
    { letter: "D", text: "Jupiter" },
  ],
};

// One scene component reused for strike 1 and strike 2 — message changes.
export const Strike: React.FC<{ which: 1 | 2 }> = ({ which }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const overlayIn = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.8 },
  });
  const fadeOut = interpolate(frame, [120, 150], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {/* The quiz card is dimmed in the background */}
      <div style={{ transform: "scale(0.95)", opacity: 0.55, filter: "blur(2px)" }}>
        <QuizCard
          questionNumber={1}
          totalQuestions={6}
          prompt={Q1.prompt}
          options={Q1.options}
          picked="A"
        />
      </div>

      {/* Backdrop scrim */}
      <AbsoluteFill
        style={{
          background: "rgba(27,42,78,0.78)",
          opacity: overlayIn * (1 - fadeOut),
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "absolute",
          background: "white",
          border: `4px solid ${palette.navy}`,
          borderRadius: 28,
          boxShadow: shadows.popLg,
          padding: "32px 40px",
          width: 540,
          textAlign: "center",
          transform: `scale(${0.86 + overlayIn * 0.14}) translateY(${
            (1 - overlayIn) * 30
          }px)`,
          opacity: overlayIn * (1 - fadeOut),
        }}
      >
        <div style={{ fontSize: 80 }}>{which === 1 ? "⚠️" : "🛑"}</div>
        <p
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 2.4,
            color: palette.coralDeep,
            textTransform: "uppercase",
            margin: "12px 0 6px",
          }}
        >
          Tab-leave detected
        </p>
        <h2
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 44,
            color: palette.navy,
            margin: "0 0 16px",
            lineHeight: 1.1,
          }}
        >
          Strike {which} of 2
        </h2>
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: 22,
            color: palette.navySoft,
            lineHeight: 1.4,
            margin: "0 0 22px",
          }}
        >
          {which === 1
            ? "Leaving the tab during a quiz counts as a strike. One more and you'll be on your last warning."
            : "Last warning! One more tab-leave and your answers reset and you start over."}
        </p>
        <PopButton variant="coral" size="lg">
          Got it
        </PopButton>
      </div>
    </AbsoluteFill>
  );
};
