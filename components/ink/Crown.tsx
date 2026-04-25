import { type SVGProps } from "react";

// A foil crown. Used ONCE in the entire app, on the winner page.
export function Crown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="120"
      height="68"
      viewBox="0 0 120 68"
      role="img"
      aria-label="Champion's crown"
      {...props}
    >
      <defs>
        <linearGradient id="foil" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#a07b34" />
          <stop offset="35%" stopColor="#c8a04c" />
          <stop offset="55%" stopColor="#efd896" />
          <stop offset="75%" stopColor="#c8a04c" />
          <stop offset="100%" stopColor="#a07b34" />
        </linearGradient>
      </defs>
      <g fill="url(#foil)" stroke="#8e6c2c" strokeWidth="0.8">
        <path d="M10 50 L22 22 L36 42 L60 14 L84 42 L98 22 L110 50 Z" />
        <rect x="8" y="50" width="104" height="10" rx="1" />
      </g>
      <g fill="#fff7df" opacity="0.9">
        <circle cx="22" cy="22" r="2" />
        <circle cx="60" cy="14" r="2.4" />
        <circle cx="98" cy="22" r="2" />
        <circle cx="40" cy="56" r="1.6" />
        <circle cx="60" cy="56" r="1.6" />
        <circle cx="80" cy="56" r="1.6" />
      </g>
    </svg>
  );
}
