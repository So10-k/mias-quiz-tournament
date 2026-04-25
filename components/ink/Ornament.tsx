import { type SVGProps } from "react";

// A small vine/fleuron ornament. Used between sections.
export function Ornament(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="64"
      height="14"
      viewBox="0 0 64 14"
      role="img"
      aria-hidden="true"
      {...props}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      >
        <path d="M2 7 L24 7" />
        <path d="M40 7 L62 7" />
        <path d="M28 7 c0 -3 4 -3 4 0 c0 3 -4 3 -4 0 z" />
        <path d="M32 7 c2 -2 6 -2 6 0 c0 2 -4 2 -6 0z" opacity=".75" />
        <path d="M32 7 c-2 -2 -6 -2 -6 0 c0 2 4 2 6 0z" opacity=".75" />
        <circle cx="32" cy="7" r="0.9" fill="currentColor" />
      </g>
    </svg>
  );
}
