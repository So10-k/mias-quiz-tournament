// Thin strip rendered above the page when a banner is configured at
// /host/intercom. Server component — reads the banner state on every
// request (root layout is force-dynamic via the Intercom boot).

import Link from "next/link";
import type { SiteBanner as Banner } from "@/lib/site-banner";

const STYLE_PALETTE: Record<
  Banner["style"],
  { bg: string; fg: string; accent: string; pulse?: boolean }
> = {
  info: { bg: "#B7E5FF", fg: "#1B2A4E", accent: "#1B2A4E" },
  live: { bg: "#C9296A", fg: "#FFFFFF", accent: "#FFD93D", pulse: true },
  warn: { bg: "#FF8C42", fg: "#1B2A4E", accent: "#1B2A4E" },
  celebrate: { bg: "#FFD93D", fg: "#1B2A4E", accent: "#C9296A" },
};

export function SiteBanner({ banner }: { banner: Banner }) {
  if (!banner.visible || !banner.text) return null;
  const palette = STYLE_PALETTE[banner.style];
  const inner = (
    <div
      className="w-full flex items-center justify-center gap-3 px-4 py-2"
      style={{
        background: palette.bg,
        color: palette.fg,
        borderBottom: `3px solid ${palette.accent}`,
        fontFamily: "Fredoka, sans-serif",
        fontWeight: 700,
        fontSize: 15,
        letterSpacing: "0.06em",
        textAlign: "center",
      }}
    >
      {palette.pulse ? (
        <span
          aria-hidden
          className="inline-block w-3 h-3 rounded-full"
          style={{
            background: palette.accent,
            boxShadow: `0 0 0 0 ${palette.accent}`,
            animation: "site-banner-pulse 1.4s ease-in-out infinite",
          }}
        />
      ) : null}
      <span>{banner.text}</span>
      {banner.href ? (
        <span
          style={{
            fontSize: 12,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            opacity: 0.85,
          }}
        >
          →
        </span>
      ) : null}
      <style>{`
        @keyframes site-banner-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.4); opacity: 0.35; }
        }
      `}</style>
    </div>
  );
  return banner.href ? (
    <Link href={banner.href} style={{ display: "block", textDecoration: "none" }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}
