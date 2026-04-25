import { type SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
  size?: number;
};

// A slightly crooked, slightly faded "THE END." stamp.
// Pressed by hand. Used over eliminated reader cards.
export function EndStamp({ size = 220, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size * 0.4}
      viewBox="0 0 220 88"
      role="img"
      aria-label="The End."
      {...rest}
    >
      <g
        transform="rotate(-6 110 44)"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.85"
      >
        <rect x="6" y="8" width="208" height="72" rx="2" />
        <rect x="12" y="14" width="196" height="60" rx="1" opacity="0.5" />
      </g>
      <g
        transform="rotate(-6 110 44)"
        fill="currentColor"
        opacity="0.92"
        fontFamily="DM Serif Display, Georgia, serif"
        fontSize="42"
        textAnchor="middle"
        letterSpacing="3"
      >
        <text x="110" y="58">THE END.</text>
      </g>
      {/* Splatters to feel pressed */}
      <g fill="currentColor" opacity="0.5">
        <circle cx="22" cy="14" r="1.4" />
        <circle cx="200" cy="78" r="1.2" />
        <circle cx="180" cy="10" r="0.9" />
      </g>
    </svg>
  );
}
