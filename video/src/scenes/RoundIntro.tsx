import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { palette, fonts, shadows } from "../theme";
import { PopButton } from "../components/PopButton";

export const RoundIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardIn = spring({ frame, fps, config: { damping: 14 } });
  const fadeOut = interpolate(frame, [120, 150], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          background: "white",
          border: `4px solid ${palette.navy}`,
          borderRadius: 28,
          boxShadow: shadows.popLg,
          padding: "44px 56px",
          width: 1000,
          textAlign: "left",
          transform: `scale(${0.85 + cardIn * 0.15})`,
          opacity: 1 - fadeOut,
        }}
      >
        <p
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: 2.4,
            color: palette.coralDeep,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Round 1
        </p>
        <h1
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 96,
            color: palette.navy,
            margin: "10px 0 18px",
            lineHeight: 1,
          }}
        >
          Science! 🔬
        </h1>
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: 26,
            color: palette.navy,
            lineHeight: 1.45,
          }}
        >
          Six questions about how the world works. Pick your favourite, no
          time pressure — just have fun.
        </p>
        <div style={{ marginTop: 28 }}>
          <PopButton variant="coral" size="lg">
            Let&rsquo;s go! →
          </PopButton>
        </div>
      </div>
    </AbsoluteFill>
  );
};
