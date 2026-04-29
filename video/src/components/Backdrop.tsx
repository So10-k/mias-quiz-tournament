import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { palette } from "../theme";
import { Sun } from "./Sun";
import { Cloud } from "./Cloud";
import { Hill } from "./Hill";

// The standing sky scene that lives behind every frame: drifting clouds,
// rotating sun, hill on the floor. Persists for the whole video so the
// world feels continuous between scene cuts.
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const t = frame;

  // Cloud drift — wraps so they keep travelling without ever popping.
  const drift = (speed: number, offset: number) => {
    const totalDist = width + 600;
    return ((offset + t * speed) % totalDist) - 300;
  };

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${palette.sky1} 0%, ${palette.sky2} 60%, ${palette.sky3} 100%)`,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", right: 90, top: 80 }}>
        <Sun size={260} rotate={t * 0.12} />
      </div>
      <div style={{ position: "absolute", left: drift(1.2, 0), top: 140 }}>
        <Cloud size={240} />
      </div>
      <div style={{ position: "absolute", left: drift(0.8, 700), top: 260 }}>
        <Cloud size={300} />
      </div>
      <div style={{ position: "absolute", left: drift(1.6, 1200), top: 380 }}>
        <Cloud size={180} />
      </div>
      <div style={{ position: "absolute", left: drift(0.6, 1700), top: 220 }}>
        <Cloud size={200} />
      </div>
      <div style={{ position: "absolute", left: 0, bottom: 0 }}>
        <Hill width={width} />
      </div>
      {/* a subtle vignette to keep the eye on the centre card */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(0,0,0,0.18) 100%)",
          pointerEvents: "none",
        }}
      />
      {void durationInFrames}
    </AbsoluteFill>
  );
};
