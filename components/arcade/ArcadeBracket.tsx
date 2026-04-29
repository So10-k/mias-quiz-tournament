import type { ReactNode } from "react";
import type { BracketRound, Matchup } from "@/lib/bracket";
import { ArcadeCard } from "./Card";

type Props = {
  rounds: BracketRound[];
  users: Map<string, { name: string | null; email: string | null }>;
  championId?: string | null;
};

const ROUND_LABEL = (n: number, total: number) => {
  if (n === total) return "Grand Final";
  if (n === total - 1) return "Semifinal";
  if (n === total - 2) return "Quarterfinal";
  return `Round ${n}`;
};

export function ArcadeBracket({ rounds, users, championId }: Props) {
  if (rounds.length === 0) {
    return (
      <div className="text-center py-16">
        <ArcadeCard glow="cyan" style={{ display: "inline-block", padding: "32px 40px" }}>
          <p style={{ fontFamily: "Fredoka,sans-serif", fontSize: 28, fontWeight: 700, color: "#00F0FF", margin: 0 }}>
            🎟 Bracket not generated yet
          </p>
        </ArcadeCard>
      </div>
    );
  }
  const total = rounds.length;
  const labelFor = (id: string | null) => {
    if (!id) return null;
    const u = users.get(id);
    return u?.name ?? u?.email ?? "—";
  };
  return (
    <div className="overflow-x-auto px-4 py-6 no-scrollbars">
      <div className="flex gap-7 min-w-max items-stretch">
        {rounds.map((r) => {
          const slotGap = Math.max(18, 28 * Math.pow(2, r.roundIndex - 1) - 16);
          return (
            <div
              key={r.roundIndex}
              className="flex flex-col"
              style={{ gap: `${slotGap}px`, minWidth: 270 }}
            >
              <RoundHeader>{ROUND_LABEL(r.roundIndex, total)}</RoundHeader>
              {r.matchups.map((m) => (
                <ArcadeMatchup
                  key={m.id}
                  m={m}
                  labelFor={labelFor}
                  championId={championId ?? null}
                  isFinal={r.roundIndex === total}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoundHeader({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        textAlign: "center",
        padding: "10px 14px",
        fontFamily: "Fredoka, Quicksand, system-ui, sans-serif",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "#1B0440",
        background:
          "linear-gradient(180deg, #FFCC00 0%, #FF8800 100%)",
        border: "1px solid #FFCC00",
        clipPath:
          "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)",
        boxShadow: "0 0 18px rgba(255,204,0,0.35), 0 2px 0 rgba(0,0,0,0.4)",
      }}
    >
      {children}
    </div>
  );
}

function ArcadeMatchup({
  m,
  labelFor,
  championId,
  isFinal,
}: {
  m: Matchup;
  labelFor: (id: string | null) => string | null;
  championId: string | null;
  isFinal: boolean;
}) {
  const a = labelFor(m.playerAUserId);
  const b = labelFor(m.playerBUserId);
  const winnerSide =
    m.winnerUserId && m.winnerUserId === m.playerAUserId
      ? "a"
      : m.winnerUserId && m.winnerUserId === m.playerBUserId
      ? "b"
      : null;
  const isChampion = isFinal && championId && m.winnerUserId === championId;
  return (
    <ArcadeCard
      glow={isChampion ? "gold" : winnerSide ? "cyan" : "purple"}
      style={{ padding: 12, position: "relative" }}
    >
      {isChampion ? (
        <div
          style={{
            position: "absolute",
            top: -16,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "4px 14px",
            background: "linear-gradient(180deg, #FFCC00 0%, #FF6B00 100%)",
            color: "#1B0440",
            fontFamily: "Fredoka, sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            border: "1px solid #FFCC00",
            borderRadius: 4,
            boxShadow: "0 0 16px rgba(255,204,0,0.65)",
            zIndex: 5,
          }}
        >
          👑 Champion
        </div>
      ) : null}
      <ArcadeSlot label={a ?? "—"} won={winnerSide === "a"} lost={!!winnerSide && winnerSide !== "a"} />
      <div
        style={{
          textAlign: "center",
          fontFamily: "Fredoka, sans-serif",
          fontSize: 11,
          color: "rgba(178,58,255,0.7)",
          letterSpacing: "0.2em",
          padding: "4px 0",
        }}
      >
        VS
      </div>
      <ArcadeSlot label={b ?? "—"} won={winnerSide === "b"} lost={!!winnerSide && winnerSide !== "b"} />
      {m.resolvedVia ? (
        <div
          style={{
            position: "absolute",
            top: -8,
            right: -6,
            padding: "2px 8px",
            fontFamily: "Fredoka, sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#0B0322",
            background:
              m.resolvedVia === "manual"
                ? "linear-gradient(180deg, #FF2D75, #B23AFF)"
                : "linear-gradient(180deg, #2CFF8A, #0E9C4F)",
            borderRadius: 3,
            boxShadow: "0 0 10px rgba(0,0,0,0.6)",
          }}
        >
          {m.resolvedVia === "manual" ? "Set" : "Auto"}
        </div>
      ) : null}
    </ArcadeCard>
  );
}

function ArcadeSlot({
  label,
  won,
  lost,
}: {
  label: string;
  won: boolean;
  lost: boolean;
}) {
  let bg: string;
  let color: string;
  let border: string;
  let shadow: string;
  if (won) {
    bg = "linear-gradient(90deg, rgba(44,255,138,0.25) 0%, rgba(44,255,138,0.10) 100%)";
    color = "#2CFF8A";
    border = "1px solid #2CFF8A";
    shadow = "0 0 14px rgba(44,255,138,0.4)";
  } else if (lost) {
    bg = "linear-gradient(90deg, rgba(255,45,117,0.18) 0%, rgba(255,45,117,0.06) 100%)";
    color = "rgba(244,236,255,0.45)";
    border = "1px solid rgba(255,45,117,0.5)";
    shadow = "none";
  } else {
    bg = "rgba(255,255,255,0.05)";
    color = "#F4ECFF";
    border = "1px solid rgba(178,58,255,0.4)";
    shadow = "none";
  }
  return (
    <div
      style={{
        padding: "10px 14px",
        background: bg,
        border,
        borderRadius: 4,
        fontFamily: "Fredoka, Quicksand, sans-serif",
        fontWeight: 600,
        fontSize: 15,
        color,
        letterSpacing: "0.02em",
        boxShadow: shadow,
        textDecoration: lost ? "line-through" : "none",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {label}
    </div>
  );
}
