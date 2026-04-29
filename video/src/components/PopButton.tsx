import { palette, fonts, radii, shadows } from "../theme";

type Variant = "white" | "coral" | "yellow" | "grass" | "sky";

const variantBg: Record<Variant, string> = {
  white: palette.cloud,
  coral: palette.coral,
  yellow: palette.sun,
  grass: palette.grass,
  sky: palette.sky2,
};

const variantFg: Record<Variant, string> = {
  white: palette.navy,
  coral: "white",
  yellow: palette.navy,
  grass: "white",
  sky: "white",
};

export const PopButton: React.FC<{
  children: React.ReactNode;
  variant?: Variant;
  size?: "md" | "lg";
  pressed?: number; // 0..1 — how pressed in the button is (animation)
  style?: React.CSSProperties;
}> = ({ children, variant = "white", size = "md", pressed = 0, style }) => {
  const offset = (1 - pressed) * 4;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: size === "lg" ? "16px 28px" : "12px 22px",
        background: variantBg[variant],
        color: variantFg[variant],
        border: `3px solid ${palette.navy}`,
        borderRadius: radii.button,
        boxShadow: `${offset}px ${offset}px 0 0 ${palette.navy}`,
        transform: `translate(${(1 - offset / 4) * 4 - 4}px, ${(1 - offset / 4) * 4 - 4}px)`,
        fontFamily: fonts.display,
        fontWeight: 600,
        fontSize: size === "lg" ? 24 : 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
