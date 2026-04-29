import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { QuizCard } from "../components/QuizCard";
import { Cursor } from "../components/Cursor";

const Q1 = {
  prompt: "What planet is closest to the Sun?",
  options: [
    { letter: "A", text: "Mercury" },
    { letter: "B", text: "Venus" },
    { letter: "C", text: "Mars" },
    { letter: "D", text: "Jupiter" },
  ],
};

// 10s scene. ~50f read prompt, pick option around 90, advance to next at 150,
// "this round will resume after the strike" at 240+.
export const Question: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardIn = spring({ frame, fps, config: { damping: 14 } });
  const picked = frame > 80 ? "A" : null;

  const cursorX = interpolate(
    frame,
    [0, 60, 90, 130, 200, 260],
    [1700, 700, 700, 1450, 1450, 1450],
    { extrapolateRight: "clamp" }
  );
  const cursorY = interpolate(
    frame,
    [0, 60, 90, 130, 200, 260],
    [900, 540, 540, 760, 760, 760],
    { extrapolateRight: "clamp" }
  );
  const click1 = interpolate(frame, [82, 96], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const click2 = interpolate(frame, [180, 200], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const click = Math.max(click1, click2);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${0.86 + cardIn * 0.14})` }}>
        <QuizCard
          questionNumber={1}
          totalQuestions={6}
          prompt={Q1.prompt}
          options={Q1.options}
          picked={picked}
        />
      </div>
      <Cursor x={cursorX} y={cursorY} click={click} />
    </AbsoluteFill>
  );
};
