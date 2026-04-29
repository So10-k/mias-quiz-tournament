import { ArcadeCard } from "./Card";

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  score: number;
  hearts: number;
  isOut: boolean;
  isYou?: boolean;
};

const TIER_FOR_RANK = (rank: number) => {
  if (rank === 1) return { label: "#1 CHAMP", glow: "gold" as const, color: "#FFCC00" };
  if (rank === 2) return { label: "#2 RUNNER-UP", glow: "purple" as const, color: "#B23AFF" };
  if (rank === 3) return { label: "#3 BRONZE", glow: "magenta" as const, color: "#FF2D75" };
  return { label: `#${rank}`, glow: "cyan" as const, color: "#00F0FF" };
};

export function ArcadeStandings({ rows }: { rows: Row[] }) {
  return (
    <div className="px-4 pb-12 max-w-3xl mx-auto flex flex-col gap-3">
      {rows.map((r, idx) => {
        const rank = idx + 1;
        const tier = TIER_FOR_RANK(rank);
        return (
          <ArcadeCard
            key={r.id}
            glow={tier.glow}
            cornerCut={false}
            style={{ padding: 0 }}
          >
            <div className="flex items-center gap-4 px-4 py-3">
              <div
                style={{
                  fontFamily: "Fredoka, sans-serif",
                  fontWeight: 700,
                  fontSize: 28,
                  color: tier.color,
                  textShadow: `0 0 16px ${tier.color}, 0 2px 0 rgba(0,0,0,0.5)`,
                  minWidth: 56,
                  textAlign: "center",
                  letterSpacing: "0.02em",
                }}
              >
                {rank === 1
                  ? "🥇"
                  : rank === 2
                  ? "🥈"
                  : rank === 3
                  ? "🥉"
                  : `#${rank}`}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  style={{
                    margin: 0,
                    fontFamily: "Fredoka, sans-serif",
                    fontWeight: 700,
                    fontSize: 19,
                    color: "#F4ECFF",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.name ?? r.email ?? "—"}
                  {r.isYou ? (
                    <span
                      style={{
                        marginLeft: 8,
                        padding: "1px 8px",
                        fontSize: 10,
                        fontWeight: 700,
                        background: "linear-gradient(180deg, #00F0FF 0%, #0080A0 100%)",
                        color: "#031018",
                        borderRadius: 999,
                        letterSpacing: "0.1em",
                      }}
                    >
                      YOU
                    </span>
                  ) : null}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontFamily: "Fredoka, sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: tier.color,
                  }}
                >
                  {tier.label}
                </p>
              </div>
              <div
                style={{
                  fontFamily: "Quicksand, sans-serif",
                  fontSize: 16,
                  color: r.isOut ? "rgba(244,236,255,0.4)" : "#FF2D75",
                }}
              >
                {r.isOut ? "💀" : "❤️".repeat(r.hearts) || "❤️"}
              </div>
              <div
                style={{
                  fontFamily: "Fredoka, sans-serif",
                  fontWeight: 700,
                  fontSize: 32,
                  color: "#FFCC00",
                  textShadow: "0 0 14px rgba(255,204,0,0.4), 0 2px 0 rgba(0,0,0,0.6)",
                  minWidth: 80,
                  textAlign: "right",
                  letterSpacing: "0.02em",
                }}
              >
                {r.score}
              </div>
            </div>
          </ArcadeCard>
        );
      })}
    </div>
  );
}
