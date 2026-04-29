import { interpolate, useCurrentFrame } from "remotion";
import { palette } from "../theme";

// Confetti-like sparkles that drift up and fade. Used in the review scene.
export const Sparkles: React.FC<{ start: number; count?: number }> = ({
  start,
  count = 30,
}) => {
  const frame = useCurrentFrame();
  const local = frame - start;
  if (local < 0 || local > 180) return null;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const seed = i * 137.508;
        const x = (Math.sin(seed) * 0.5 + 0.5) * 1920;
        const delay = (Math.cos(seed * 1.3) * 0.5 + 0.5) * 60;
        const t = local - delay;
        if (t < 0) return null;
        const y = 1080 - t * 6 - (Math.sin(seed * 2) * 200 + 200);
        const op = interpolate(t, [0, 30, 120], [0, 1, 0], {
          extrapolateRight: "clamp",
        });
        const colorPick = i % 4;
        const color = [palette.coral, palette.sun, palette.grass, palette.sky2][colorPick];
        const size = 8 + (i % 3) * 4;
        const rot = t * (i % 2 === 0 ? 4 : -4);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              background: color,
              border: `2px solid ${palette.navy}`,
              borderRadius: i % 2 === 0 ? 999 : 4,
              opacity: op,
              transform: `rotate(${rot}deg)`,
              zIndex: 100,
            }}
          />
        );
      })}
    </>
  );
};
