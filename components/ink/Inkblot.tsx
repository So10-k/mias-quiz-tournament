import { type SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
  size?: number;
  filled?: boolean;
};

// An irregular blob with one or two splatters. The "filled" variant is the
// strike mark; "empty" is the placeholder slot before a strike is given.
export function Inkblot({ size = 16, filled = true, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-hidden="true"
      {...rest}
    >
      {filled ? (
        <g fill="currentColor">
          <path d="M22 8c-4 1-8 4-10 9-2 5-1 11 2 14-3 3-4 8-2 13 2 6 8 10 14 11 5 1 11-1 15-5 2-2 4-5 5-8 2-5 1-10-3-14 2-3 2-7 0-10-2-3-6-5-10-6-3-1-8-1-11 0-2 0 2-3 0-4z" />
          <circle cx="50" cy="14" r="2.5" />
          <circle cx="56" cy="22" r="1.6" />
          <circle cx="14" cy="50" r="2" />
        </g>
      ) : (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeOpacity="0.45"
        >
          <path d="M22 8c-4 1-8 4-10 9-2 5-1 11 2 14-3 3-4 8-2 13 2 6 8 10 14 11 5 1 11-1 15-5 2-2 4-5 5-8 2-5 1-10-3-14 2-3 2-7 0-10-2-3-6-5-10-6-3-1-8-1-11 0-2 0 2-3 0-4z" />
        </g>
      )}
    </svg>
  );
}
