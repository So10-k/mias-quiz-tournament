import { type SVGProps } from "react";

export function Sun({ size = 160, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-hidden="true"
      {...rest}
    >
      <g>
        {/* Rays */}
        <g stroke="var(--navy)" strokeWidth="3" strokeLinecap="round">
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            const x1 = 100 + Math.cos(a) * 80;
            const y1 = 100 + Math.sin(a) * 80;
            const x2 = 100 + Math.cos(a) * 96;
            const y2 = 100 + Math.sin(a) * 96;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>
        <g stroke="var(--navy)" strokeWidth="3">
          {Array.from({ length: 12 }).map((_, i) => {
            const a = ((i * 30 + 15) * Math.PI) / 180;
            const x1 = 100 + Math.cos(a) * 78;
            const y1 = 100 + Math.sin(a) * 78;
            const x2 = 100 + Math.cos(a) * 92;
            const y2 = 100 + Math.sin(a) * 92;
            return <line key={"b" + i} x1={x1} y1={y1} x2={x2} y2={y2} strokeLinecap="round" />;
          })}
        </g>
        {/* Sun face */}
        <circle cx="100" cy="100" r="64" fill="var(--sun)" stroke="var(--navy)" strokeWidth="3" />
        <circle cx="80" cy="92" r="6" fill="var(--navy)" />
        <circle cx="120" cy="92" r="6" fill="var(--navy)" />
        <path
          d="M78 116 Q100 138 122 116"
          fill="none"
          stroke="var(--navy)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="74" cy="112" r="6" fill="var(--coral)" opacity="0.7" />
        <circle cx="126" cy="112" r="6" fill="var(--coral)" opacity="0.7" />
      </g>
    </svg>
  );
}
