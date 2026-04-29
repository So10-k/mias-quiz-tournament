import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { palette, fonts } from "../theme";
import { PopButton } from "../components/PopButton";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleIn = spring({ frame, fps, config: { damping: 14 } });
  const ctaIn = spring({ frame: frame - 30, fps, config: { damping: 14 } });
  const fade = interpolate(frame, [120, 150], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          textAlign: "center",
          transform: `scale(${0.85 + titleIn * 0.15})`,
          opacity: 1 - fade,
        }}
      >
        <h1
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: 110,
            color: palette.cloud,
            textShadow: `8px 8px 0 ${palette.navy}`,
            lineHeight: 1,
            margin: 0,
          }}
        >
          Mia&rsquo;s Quiz Tournament
        </h1>
        <p
          style={{
            fontFamily: fonts.body,
            fontSize: 30,
            color: palette.navy,
            background: "rgba(255,255,255,0.85)",
            display: "inline-block",
            padding: "10px 26px",
            borderRadius: 999,
            border: `3px solid ${palette.navy}`,
            margin: "26px 0 0",
          }}
        >
          quiz.miaswebsites.art
        </p>
        <div
          style={{
            marginTop: 30,
            transform: `scale(${0.85 + ctaIn * 0.15})`,
            opacity: ctaIn,
          }}
        >
          <PopButton variant="coral" size="lg">
            Join the tournament →
          </PopButton>
        </div>
      </div>
    </AbsoluteFill>
  );
};
