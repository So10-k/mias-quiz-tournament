import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { palette, fonts, shadows } from "../theme";
import { Sparkles } from "../components/Sparkles";

export const Review: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardIn = spring({ frame, fps, config: { damping: 14 } });

  const score = Math.min(6, Math.floor(frame / 18));
  const passed = score >= 4;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Sparkles start={0} count={26} />
      <div
        style={{
          background: "white",
          border: `4px solid ${palette.navy}`,
          borderRadius: 28,
          boxShadow: shadows.popLg,
          padding: "40px 56px",
          width: 880,
          textAlign: "center",
          transform: `scale(${0.86 + cardIn * 0.14})`,
        }}
      >
        <div style={{ fontSize: 110 }}>{passed ? "🌟" : "🌱"}</div>
        <p
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: 2.2,
            color: palette.coralDeep,
            textTransform: "uppercase",
            margin: "10px 0 8px",
          }}
        >
          Round 1 · Results
        </p>
        <h2
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 64,
            color: palette.navy,
            margin: "0 0 16px",
            lineHeight: 1.1,
          }}
        >
          You scored {score} / 6 🎉
        </h2>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <Stat label="Hearts left" value="❤️ ❤️" bg={palette.sun} />
          <Stat label="Bracket" value="advanced" bg={palette.grass} />
          <Stat label="Streak" value={`${score}🔥`} bg={palette.coral} />
        </div>
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: 22,
            color: palette.navySoft,
            margin: 0,
          }}
        >
          Great run! See you in the quarterfinal.
        </p>
      </div>
    </AbsoluteFill>
  );
};

const Stat: React.FC<{ label: string; value: string; bg: string }> = ({
  label,
  value,
  bg,
}) => (
  <div
    style={{
      background: bg,
      border: `3px solid ${palette.navy}`,
      borderRadius: 16,
      boxShadow: shadows.pop,
      padding: "12px 18px",
      minWidth: 150,
      color: palette.navy,
    }}
  >
    <p
      style={{
        fontFamily: fonts.display,
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: 1.6,
        textTransform: "uppercase",
        margin: 0,
      }}
    >
      {label}
    </p>
    <p
      style={{
        fontFamily: fonts.display,
        fontWeight: 700,
        fontSize: 22,
        margin: "4px 0 0",
      }}
    >
      {value}
    </p>
  </div>
);
