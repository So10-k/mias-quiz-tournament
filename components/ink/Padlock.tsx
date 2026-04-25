import { type SVGProps } from "react";

// Single-line ink padlock for locked chapters.
export function Padlock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="14"
      height="16"
      viewBox="0 0 14 16"
      role="img"
      aria-label="Locked chapter"
      {...props}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      >
        <rect x="2" y="7" width="10" height="7.5" rx="1" />
        <path d="M4 7 V5 a3 3 0 0 1 6 0 V7" />
        <circle cx="7" cy="11" r="0.7" fill="currentColor" />
      </g>
    </svg>
  );
}
