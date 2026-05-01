// A visual single-elimination bracket. Pure server component for read-only
// display; the host gets edit affordances via separate forms passed in.
import { type ReactNode } from "react";
import type { BracketRound, Matchup } from "@/lib/bracket";
import { bracketByeSet, type CascadeMap } from "@/lib/predictions";

type Props = {
  rounds: BracketRound[];
  users: Map<string, { name: string | null; email: string | null }>;
  // Optional render slot for host controls under each matchup card.
  renderControls?: (m: Matchup) => ReactNode;
  championId?: string | null;
  // Optional: matchupId → predicted-winner-userId. When supplied, the
  // matching slot in each matchup gets a coral pick highlight + ★.
  predictions?: Map<string, string>;
  // Optional cascade map (per-user effective player IDs) used to fill in
  // R2+ slots from the user's own predictions. Without this, R2+ matchups
  // with no DB-seated players just show "—" / "—".
  cascade?: CascadeMap;
};

const ROUND_LABELS = (n: number, total: number) => {
  if (n === total) return "Final";
  if (n === total - 1) return "Semifinal";
  if (n === total - 2) return "Quarterfinal";
  return `Round ${n}`;
};

export function BracketView({
  rounds,
  users,
  renderControls,
  championId,
  predictions,
  cascade,
}: Props) {
  if (rounds.length === 0) {
    return (
      <div className="card px-7 py-7 text-center">
        <div className="text-5xl">🎟️</div>
        <p className="font-display text-2xl text-navy mt-3">
          No bracket yet!
        </p>
        <p className="font-body text-base text-navy-soft mt-1">
          The host hasn&rsquo;t generated one.
        </p>
      </div>
    );
  }

  const total = rounds.length;
  const allMatchups = rounds.flatMap((r) => r.matchups);
  const byeIds = bracketByeSet(allMatchups);
  const labelFor = (id: string | null) => {
    if (!id) return null;
    const u = users.get(id);
    return u?.name ?? u?.email ?? "—";
  };

  return (
    <div className="overflow-x-auto pb-3 no-scrollbars">
      <div className="flex gap-5 min-w-max">
        {rounds.map((r) => {
          const slotGap = 24 * Math.pow(2, r.roundIndex - 1) - 16;
          return (
            <div
              key={r.roundIndex}
              className="flex flex-col"
              style={{ gap: `${Math.max(16, slotGap)}px`, minWidth: 240 }}
            >
              <div className="text-center font-display text-base text-navy bg-sun border-3 border-navy rounded-md py-1 shadow-pop-sm">
                {ROUND_LABELS(r.roundIndex, total)}
              </div>
              {r.matchups.map((m) => (
                <BracketMatchup
                  key={m.id}
                  m={m}
                  labelFor={labelFor}
                  championId={championId ?? null}
                  isFinal={r.roundIndex === total}
                  controls={renderControls ? renderControls(m) : null}
                  predictedSideId={predictions?.get(m.id) ?? null}
                  isBye={byeIds.has(m.id)}
                  cascadeA={cascade?.get(m.id)?.a ?? null}
                  cascadeB={cascade?.get(m.id)?.b ?? null}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketMatchup({
  m,
  labelFor,
  championId,
  isFinal,
  controls,
  predictedSideId,
  isBye,
  cascadeA,
  cascadeB,
}: {
  m: Matchup;
  labelFor: (id: string | null) => string | null;
  championId: string | null;
  isFinal: boolean;
  controls: ReactNode;
  predictedSideId: string | null;
  isBye: boolean;
  cascadeA: string | null;
  cascadeB: string | null;
}) {
  // Effective sides: prefer DB-seated player, then cascade-derived (per-user).
  const effA = m.playerAUserId ?? cascadeA;
  const effB = m.playerBUserId ?? cascadeB;
  const aFromCascade = !m.playerAUserId && !!cascadeA;
  const bFromCascade = !m.playerBUserId && !!cascadeB;

  const aName = labelFor(effA);
  const bName = labelFor(effB);

  // Bye labelling: when the matchup is a structural bye and one side never
  // fills, show "BYE" on that side (or both if neither will fill).
  const aLabel =
    aName ?? (isBye && !effA && (effB || !!m.playerBUserId) ? "BYE" : "—");
  const bLabel =
    bName ?? (isBye && !effB && (effA || !!m.playerAUserId) ? "BYE" : "—");

  const bothEmpty = !effA && !effB;

  const winnerSide =
    m.winnerUserId && m.winnerUserId === m.playerAUserId
      ? "a"
      : m.winnerUserId && m.winnerUserId === m.playerBUserId
      ? "b"
      : null;
  // Picked side = the user's prediction, matched against effective player ids
  // (so cascade-derived sides also light up with ★).
  const pickedSide =
    predictedSideId && effA === predictedSideId
      ? "a"
      : predictedSideId && effB === predictedSideId
      ? "b"
      : null;

  return (
    <div className="card-sm bg-white px-3 py-3 flex flex-col gap-1 relative">
      {isBye && bothEmpty ? (
        <div className="absolute -top-2 left-2 px-2 py-0.5 rounded-md border-2 border-navy bg-sun text-navy text-xs font-display">
          BYE · awaiting feeder
        </div>
      ) : isBye ? (
        <div className="absolute -top-2 left-2 px-2 py-0.5 rounded-md border-2 border-navy bg-sun text-navy text-xs font-display">
          BYE
        </div>
      ) : null}
      <Slot
        label={aLabel}
        empty={!effA}
        won={winnerSide === "a"}
        lost={!!winnerSide && winnerSide !== "a"}
        picked={pickedSide === "a" && !winnerSide}
        cascaded={aFromCascade && !winnerSide}
      />
      <div className="font-display text-xs text-navy-soft text-center">vs</div>
      <Slot
        label={bLabel}
        empty={!effB}
        won={winnerSide === "b"}
        lost={!!winnerSide && winnerSide !== "b"}
        picked={pickedSide === "b" && !winnerSide}
        cascaded={bFromCascade && !winnerSide}
      />
      {m.resolvedVia ? (
        <div
          className={
            "absolute -top-2 -right-2 px-2 py-0.5 rounded-md border-2 border-navy text-xs font-display " +
            (m.resolvedVia === "manual"
              ? "bg-coral text-white"
              : "bg-grass text-white")
          }
          title={
            m.resolvedVia === "manual" ? "Set by host" : "From quiz scores"
          }
        >
          official bracket!
        </div>
      ) : null}
      {isFinal && championId && m.winnerUserId === championId ? (
        <div className="absolute -top-3 left-2 px-2 py-1 rounded-md border-2 border-navy bg-sun font-display text-xs">
          🏆 Champion
        </div>
      ) : null}
      {controls ? <div className="mt-2">{controls}</div> : null}
    </div>
  );
}

function Slot({
  label,
  empty,
  won,
  lost,
  picked,
  cascaded,
}: {
  label: string;
  empty: boolean;
  won: boolean;
  lost: boolean;
  picked?: boolean;
  cascaded?: boolean;
}) {
  return (
    <div
      className={
        "px-2 py-1 rounded-md border-2 border-navy font-display text-sm truncate " +
        (empty
          ? "bg-sky1 text-navy-soft italic opacity-70"
          : won
          ? "bg-grass text-white"
          : lost
          ? "bg-coral-deep text-white opacity-80 line-through"
          : picked
          ? "bg-coral text-white"
          : cascaded
          ? "bg-sun text-navy"
          : "bg-white text-navy")
      }
    >
      {picked ? "★ " : ""}
      {label}
    </div>
  );
}
