// Dark glass card with neon edge + diagonal corner cut. Inspired by the
// Supercell-store product tiles. Use with `glow="cyan" | "magenta" | "gold"
// | "green" | "white"` to set the accent rim and shadow.

const GLOWS = {
  cyan: { rim: "#00F0FF", shadow: "rgba(0,240,255,0.45)" },
  magenta: { rim: "#FF2D75", shadow: "rgba(255,45,117,0.45)" },
  gold: { rim: "#FFCC00", shadow: "rgba(255,204,0,0.45)" },
  green: { rim: "#2CFF8A", shadow: "rgba(44,255,138,0.45)" },
  purple: { rim: "#B23AFF", shadow: "rgba(178,58,255,0.45)" },
  white: { rim: "#FFFFFF", shadow: "rgba(255,255,255,0.30)" },
} as const;
export type ArcadeGlow = keyof typeof GLOWS;

export function ArcadeCard({
  children,
  glow = "cyan",
  cornerCut = true,
  className = "",
  style,
}: {
  children: React.ReactNode;
  glow?: ArcadeGlow;
  cornerCut?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { rim, shadow } = GLOWS[glow];
  const clip = cornerCut
    ? "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)"
    : undefined;
  return (
    <div
      className={className}
      style={{
        position: "relative",
        background:
          "linear-gradient(180deg, rgba(31,14,63,0.92) 0%, rgba(15,5,35,0.96) 100%)",
        border: `2px solid ${rim}`,
        boxShadow: `0 0 0 1px rgba(0,0,0,0.5) inset, 0 12px 32px ${shadow}, 0 0 24px ${shadow}`,
        clipPath: clip,
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${shadow} 0%, transparent 35%, transparent 65%, ${shadow} 100%)`,
          opacity: 0.45,
          pointerEvents: "none",
          clipPath: clip,
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}
