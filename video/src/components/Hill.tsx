import { palette } from "../theme";

export const Hill: React.FC<{ width: number }> = ({ width }) => {
  return (
    <svg width={width} height={180} viewBox="0 0 1920 180" preserveAspectRatio="none">
      <path
        d="M0 180 L0 90 Q280 30 640 70 Q1000 110 1380 50 Q1700 18 1920 60 L1920 180 Z"
        fill={palette.grass}
        stroke={palette.navy}
        strokeWidth={4}
      />
      <path
        d="M0 180 L0 130 Q360 100 720 120 Q1100 150 1500 110 Q1750 90 1920 120 L1920 180 Z"
        fill={palette.grassDeep}
        opacity={0.55}
      />
    </svg>
  );
};
