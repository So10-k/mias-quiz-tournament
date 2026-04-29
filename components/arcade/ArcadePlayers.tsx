import { ArcadeCard, type ArcadeGlow } from "./Card";
import { RarityBadge, type Rarity } from "./RarityBadge";

type Player = {
  id: string;
  name: string | null;
  email: string | null;
  hearts: number;
  isOut: boolean;
  isAuthor?: boolean;
};

// Map a player's standing to a rarity tag. Author always Legendary.
// Last-rank still-in player Common, mid-tier Rare, top tier Epic.
function rarityFor(
  p: Player,
  rank: number,
  totalIn: number
): Rarity {
  if (p.isOut) return "out";
  if (p.isAuthor) return "legendary";
  if (totalIn <= 1) return "legendary";
  if (rank === 1) return "epic";
  if (rank <= Math.max(1, Math.floor(totalIn / 3))) return "rare";
  return "common";
}

const GLOW_FOR_RARITY: Record<Rarity, ArcadeGlow> = {
  common: "white",
  rare: "green",
  epic: "purple",
  legendary: "gold",
  out: "magenta",
};

export function ArcadePlayers({ players }: { players: Player[] }) {
  const totalIn = players.filter((p) => !p.isOut).length;
  // Stable rank by hearts (desc), still-in first.
  const ranked = [...players]
    .map((p) => ({ ...p }))
    .sort((a, b) => {
      if (a.isOut !== b.isOut) return a.isOut ? 1 : -1;
      return b.hearts - a.hearts;
    });

  return (
    <div className="px-4 pb-12">
      <div
        className="grid gap-4 mx-auto"
        style={{
          maxWidth: 1200,
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        }}
      >
        {ranked.map((p, idx) => {
          const rank = ranked.filter((q) => !q.isOut).indexOf(p) + 1;
          const rarity = rarityFor(p, rank, totalIn);
          const glow = GLOW_FOR_RARITY[rarity];
          return (
            <ArcadeCard
              key={p.id}
              glow={glow}
              style={{ padding: 16 }}
            >
              <div className="flex items-center justify-between mb-3">
                <RarityBadge rarity={rarity} />
                {p.isAuthor ? (
                  <span style={{ fontSize: 22 }} title="Author">👑</span>
                ) : null}
              </div>
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  background:
                    "radial-gradient(ellipse at 50% 35%, rgba(255,255,255,0.12) 0%, transparent 70%), linear-gradient(180deg, rgba(178,58,255,0.18) 0%, rgba(0,240,255,0.12) 100%)",
                  border: "1px solid rgba(178,58,255,0.35)",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Fredoka, sans-serif",
                  fontWeight: 700,
                  fontSize: 56,
                  color: "#FFCC00",
                  textShadow: "0 0 20px rgba(255,204,0,0.5), 0 4px 0 rgba(0,0,0,0.5)",
                  marginBottom: 12,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {(p.name ?? p.email ?? "?")
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 40%)",
                    pointerEvents: "none",
                  }}
                />
              </div>
              <p
                style={{
                  margin: 0,
                  fontFamily: "Fredoka, sans-serif",
                  fontWeight: 700,
                  fontSize: 18,
                  color: "#F4ECFF",
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.name ?? "(no name)"}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span
                  style={{
                    fontFamily: "Quicksand, sans-serif",
                    fontSize: 12,
                    color: "rgba(244,236,255,0.55)",
                  }}
                >
                  Rank #{idx + 1}
                </span>
                <span
                  style={{
                    fontFamily: "Fredoka, sans-serif",
                    fontWeight: 700,
                    fontSize: 16,
                    color: p.isOut ? "rgba(244,236,255,0.4)" : "#FF2D75",
                    letterSpacing: "0.05em",
                  }}
                >
                  {p.isOut ? "💀" : "❤️".repeat(p.hearts) || "❤️"}
                </span>
              </div>
            </ArcadeCard>
          );
        })}
      </div>
    </div>
  );
}
