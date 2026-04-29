import { palette } from "../theme";

// Ported from app/components/scene/Sun.tsx so the video uses the literal
// same illustration as the live site.
export const Sun: React.FC<{ size?: number; rotate?: number }> = ({
  size = 200,
  rotate = 0,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <g stroke={palette.navy} strokeWidth={3} strokeLinecap="round">
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * 80}
              y1={100 + Math.sin(a) * 80}
              x2={100 + Math.cos(a) * 96}
              y2={100 + Math.sin(a) * 96}
            />
          );
        })}
      </g>
      <g stroke={palette.navy} strokeWidth={3} strokeLinecap="round">
        {Array.from({ length: 12 }).map((_, i) => {
          const a = ((i * 30 + 15) * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * 78}
              y1={100 + Math.sin(a) * 78}
              x2={100 + Math.cos(a) * 92}
              y2={100 + Math.sin(a) * 92}
            />
          );
        })}
      </g>
      <circle cx={100} cy={100} r={64} fill={palette.sun} stroke={palette.navy} strokeWidth={3} />
      <circle cx={80} cy={92} r={6} fill={palette.navy} />
      <circle cx={120} cy={92} r={6} fill={palette.navy} />
      <path d="M78 116 Q100 138 122 116" fill="none" stroke={palette.navy} strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={74} cy={112} r={6} fill={palette.coral} opacity={0.7} />
      <circle cx={126} cy={112} r={6} fill={palette.coral} opacity={0.7} />
    </svg>
  );
};
