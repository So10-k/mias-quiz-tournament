// Rarity tag stolen straight from the Brawl Stars store: COMMON / RARE /
// EPIC / LEGENDARY / OUT. Used on player cards based on score-position.

export type Rarity = "common" | "rare" | "epic" | "legendary" | "out";

const STYLES: Record<
  Rarity,
  { label: string; from: string; to: string; text: string; ring: string }
> = {
  common: {
    label: "PLAYER",
    from: "#A0A8C8",
    to: "#5C648A",
    text: "#FFFFFF",
    ring: "#A0A8C8",
  },
  rare: {
    label: "RARE",
    from: "#2CFF8A",
    to: "#0E9C4F",
    text: "#0B1F12",
    ring: "#2CFF8A",
  },
  epic: {
    label: "EPIC",
    from: "#B23AFF",
    to: "#5E0FB5",
    text: "#FFFFFF",
    ring: "#B23AFF",
  },
  legendary: {
    label: "LEGENDARY",
    from: "#FFCC00",
    to: "#FF6B00",
    text: "#1B0440",
    ring: "#FFCC00",
  },
  out: {
    label: "ELIMINATED",
    from: "#3B1F70",
    to: "#1B0440",
    text: "#FFFFFF",
    ring: "#FF2D75",
  },
};

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  const s = STYLES[rarity];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 12px",
        fontFamily: "Fredoka, Quicksand, system-ui, sans-serif",
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: s.text,
        background: `linear-gradient(180deg, ${s.from} 0%, ${s.to} 100%)`,
        border: `1px solid ${s.ring}`,
        borderRadius: 4,
        boxShadow: `0 0 12px ${s.ring}55, 0 1px 0 rgba(0,0,0,0.6)`,
        clipPath:
          "polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)",
      }}
    >
      {s.label}
    </span>
  );
}
