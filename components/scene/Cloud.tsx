import { type SVGProps } from "react";

export function Cloud({ size = 120, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 0.55}
      viewBox="0 0 200 110"
      role="img"
      aria-hidden="true"
      {...rest}
    >
      <g>
        <ellipse cx="55" cy="70" rx="40" ry="32" fill="white" />
        <ellipse cx="100" cy="55" rx="48" ry="40" fill="white" />
        <ellipse cx="150" cy="68" rx="38" ry="30" fill="white" />
        <ellipse cx="80" cy="78" rx="34" ry="22" fill="white" />
        <ellipse cx="130" cy="80" rx="32" ry="20" fill="white" />
        {/* Outline */}
        <path
          d="M30 78 Q22 50 60 44 Q66 22 100 22 Q140 18 152 44 Q186 46 178 80 Q190 96 158 96 L46 96 Q22 96 30 78 Z"
          fill="none"
          stroke="var(--navy)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
