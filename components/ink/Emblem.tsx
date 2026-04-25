"use client";
import { type SVGProps } from "react";
import { useState } from "react";

type Props = SVGProps<SVGSVGElement> & { className?: string };

// Prefers /illustrations/emblem.svg if Mia has dropped one in. Falls back to
// a drawn quill-and-book motif. Replace the file (or scan and drop a new one)
// to make the cover hers — no code edit required.
export function Emblem({ className, ...rest }: Props) {
  const [scanFailed, setScanFailed] = useState(false);
  if (!scanFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/illustrations/emblem.svg"
        alt=""
        width={160}
        height={160}
        className={className}
        onError={() => setScanFailed(true)}
      />
    );
  }
  return (
    <svg
      width="160"
      height="160"
      viewBox="0 0 160 160"
      role="img"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M28 110 L80 96 L132 110 L132 126 L80 112 L28 126 Z" />
        <path d="M80 96 L80 112" />
        <path d="M28 110 L28 126" opacity="0.5" />
        <path d="M132 110 L132 126" opacity="0.5" />
        <path d="M30 116 L78 104" opacity="0.35" />
        <path d="M82 104 L130 116" opacity="0.35" />
        <path d="M58 86 C70 60 96 38 122 30 C118 56 100 82 76 96 Z" />
        <path d="M70 80 L60 92" />
        <path d="M64 90 L52 98" />
        <path
          d="M110 118 c0 -3 4 -3 4 0 c0 3 -4 3 -4 0 z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
