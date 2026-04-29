import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { palette, fonts } from "../theme";
import { Sun } from "../components/Sun";

export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sunRise = spring({ frame, fps, config: { damping: 14, mass: 1 } });
  const sunY = interpolate(sunRise, [0, 1], [220, 0]);
  const titlePop = spring({
    frame: frame - 30,
    fps,
    config: { damping: 12, mass: 0.6 },
  });
  const subtitleOp = interpolate(frame, [55, 85], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transform: `translateY(${sunY}px) scale(${0.4 + sunRise * 0.6})`,
          marginBottom: 30,
        }}
      >
        <Sun size={260} rotate={frame * 0.6} />
      </div>
      <h1
        style={{
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 130,
          color: palette.cloud,
          textShadow: `8px 8px 0 ${palette.navy}`,
          lineHeight: 1,
          margin: 0,
          transform: `scale(${titlePop})`,
          opacity: titlePop,
        }}
      >
        Mia&rsquo;s Quiz Tournament
      </h1>
      <p
        style={{
          fontFamily: fonts.body,
          fontWeight: 600,
          fontSize: 30,
          color: palette.navy,
          marginTop: 30,
          background: "rgba(255,255,255,0.8)",
          padding: "10px 28px",
          borderRadius: 999,
          border: `3px solid ${palette.navy}`,
          opacity: subtitleOp,
        }}
      >
        Quizzes! Friends! Adventure!
      </p>
    </AbsoluteFill>
  );
};
