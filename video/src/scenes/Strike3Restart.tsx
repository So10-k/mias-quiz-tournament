import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { palette, fonts, shadows } from "../theme";
import { PopButton } from "../components/PopButton";
import { Cursor } from "../components/Cursor";
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

// 10s scene — strike 3 hits, big restart overlay arrives, cursor flies to
// the "Start over" button and clicks. Then we cut back to a fresh question.
export const Strike3Restart: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const overlayIn = spring({ frame, fps, config: { damping: 12, mass: 0.7 } });
  const cursorX = interpolate(frame, [0, 90, 180], [1700, 960, 960], {
    extrapolateRight: "clamp",
  });
  const cursorY = interpolate(frame, [0, 90, 180], [900, 700, 700], {
    extrapolateRight: "clamp",
  });
  const click = interpolate(frame, [170, 195], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // After click the overlay clears + answers reset.
  const clearOut = interpolate(frame, [195, 230], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {/* Background quiz card resets to a clean state after click */}
      <div
        style={{
          transform: "scale(0.95)",
          opacity: 0.55 + clearOut * 0.4,
          filter: clearOut > 0.5 ? "none" : "blur(2px)",
        }}
      >
        <QuizCard
          questionNumber={1}
          totalQuestions={6}
          prompt={Q1.prompt}
          options={Q1.options}
          picked={clearOut > 0.5 ? null : "A"}
        />
      </div>

      <AbsoluteFill
        style={{
          background: "rgba(27,42,78,0.88)",
          opacity: (1 - clearOut) * overlayIn,
        }}
      />

      <div
        style={{
          position: "absolute",
          background: "white",
          border: `4px solid ${palette.navy}`,
          borderRadius: 28,
          boxShadow: shadows.popLg,
          padding: "32px 40px",
          width: 580,
          textAlign: "center",
          transform: `scale(${0.86 + overlayIn * 0.14})`,
          opacity: overlayIn * (1 - clearOut),
        }}
      >
        <div style={{ fontSize: 90 }}>🚫</div>
        <h2
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 44,
            color: palette.navy,
            margin: "16px 0 14px",
            lineHeight: 1.1,
          }}
        >
          Tab-leave limit reached
        </h2>
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: 22,
            color: palette.navySoft,
            lineHeight: 1.4,
            margin: "0 0 24px",
          }}
        >
          You left the tab too many times — your answers on this round have
          been wiped. Start over from the top.
        </p>
        <PopButton variant="coral" size="lg" pressed={click * 0.6}>
          Start over
        </PopButton>
      </div>

      <Cursor x={cursorX} y={cursorY} click={click} />
    </AbsoluteFill>
  );
};
