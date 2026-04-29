import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { palette, fonts, shadows } from "../theme";
import { QuizCard } from "../components/QuizCard";
import { PopButton } from "../components/PopButton";

// 15s. Quick replay through three questions (each ~120 frames), then a
// confirm screen for ~90 frames. No tab-leaves this time — clean run.
export const ReplaySubmit: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardIn = spring({ frame, fps, config: { damping: 14 } });

  const questions = [
    {
      prompt: "What planet is closest to the Sun?",
      options: [
        { letter: "A", text: "Mercury" },
        { letter: "B", text: "Venus" },
        { letter: "C", text: "Mars" },
        { letter: "D", text: "Jupiter" },
      ],
      picked: "A",
    },
    {
      prompt: "Plants make food using…",
      options: [
        { letter: "A", text: "Photosynthesis" },
        { letter: "B", text: "Magic" },
        { letter: "C", text: "Sleep" },
        { letter: "D", text: "Sand" },
      ],
      picked: "A",
    },
    {
      prompt: "How many bones in a hand?",
      options: [
        { letter: "A", text: "10" },
        { letter: "B", text: "27" },
        { letter: "C", text: "5" },
        { letter: "D", text: "100" },
      ],
      picked: "B",
    },
  ];

  const PER = 120;
  const idx = Math.min(2, Math.floor(frame / PER));
  const localFrame = frame - idx * PER;
  const swap = interpolate(localFrame, [0, 14], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Confirm panel appears at frame >= 360.
  const showConfirm = frame >= 360;
  const confirmIn = spring({
    frame: frame - 365,
    fps,
    config: { damping: 14, mass: 0.7 },
  });

  if (showConfirm) {
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            background: "white",
            border: `4px solid ${palette.navy}`,
            borderRadius: 28,
            boxShadow: shadows.popLg,
            padding: "44px 56px",
            width: 720,
            textAlign: "center",
            transform: `scale(${0.86 + confirmIn * 0.14})`,
          }}
        >
          <div style={{ fontSize: 90 }}>🎯</div>
          <h2
            style={{
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 44,
              color: palette.navy,
              margin: "12px 0 12px",
              lineHeight: 1.1,
            }}
          >
            Ready to send your answers?
          </h2>
          <p
            style={{
              fontFamily: fonts.body,
              fontSize: 22,
              color: palette.navySoft,
              margin: "0 0 24px",
            }}
          >
            Once you send them, you can&rsquo;t change them.
          </p>
          <PopButton variant="coral" size="lg">
            📨 Send it!
          </PopButton>
        </div>
      </AbsoluteFill>
    );
  }

  const q = questions[idx];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          transform: `scale(${0.86 + cardIn * 0.14}) translateY(${swap}px)`,
        }}
      >
        <QuizCard
          questionNumber={idx + 1}
          totalQuestions={6}
          prompt={q.prompt}
          options={q.options}
          picked={localFrame > 50 ? q.picked : null}
        />
      </div>
    </AbsoluteFill>
  );
};
