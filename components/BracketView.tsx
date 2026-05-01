// A visual single-elimination bracket. Pure server component for read-only
// display; the host gets edit affordances via separate forms passed in.
import { type ReactNode } from "react";
import type { BracketRound, Matchup } from "@/lib/bracket";

// Mark a matchup as a structural BYE when one of its R-1 feeders doesn't
// exist (odd-count tail-bye). Cosmetic only — propagateWinners auto-resolves
// these in the engine; this just makes the bracket card honest about it
// instead of showing two empty rows that "feel broken."
function buildByeSet(rounds: BracketRound[]): Set<string> {
  const all: Matchup[] = rounds.flatMap((r) => r.matchups);
  const byKey = new Map<string, Matchup>();
  for (const m of all) byKey.set(`${m.bracket}:${m.roundIndex}:${m.slot}`, m);
  const out = new Set<string>();
  for (const m of all) {
    if (m.winnerUserId) continue;
    if (m.playerAUserId && m.playerBUserId) continue;
    if (m.roundIndex === 1) continue; // R1 bye/single-side handled by data
    const fA = byKey.get(`${m.bracket}:${m.roundIndex - 1}:${m.slot * 2}`);
    const fB = byKey.get(`${m.bracket}:${m.roundIndex - 1}:${m.slot * 2 + 1}`);
    const feederCount = (fA ? 1 : 0) + (fB ? 1 : 0);
    if (feederCount <= 1) out.add(m.id);
  }
  return out;
}

type Props = {
  rounds: BracketRound[];
  users: Map<string, { name: string | null; email: string | null }>;
  // Optional render slot for host controls under each matchup card.
  renderControls?: (m: Matchup) => ReactNode;
  championId?: string | null;
  // Optional: matchupId → predicted-winner-userId. When supplied, the
  // matching slot in each matchup gets a coral pick highlight + ★.
  predictions?: Map<string, string>;
};

const ROUND_LABELS = (n: number, total: number) => {
  // n = 1..total
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
  const byeIds = buildByeSet(rounds);
  const labelFor = (id: string | null) => {
    if (!id) return null;
    const u = users.get(id);
    return u?.name ?? u?.email ?? "—";
  };

  return (
    <div className="overflow-x-auto pb-3 no-scrollbars">
      <div className="flex gap-5 min-w-max">
        {rounds.map((r) => {
          // Each round column. Slots get spaced out so winners visually align
          // with the next round's matchup. Round n has 2^(total-n+1)/2 slots.
          // We use CSS gap multiplier per round.
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
}: {
  m: Matchup;
  labelFor: (id: string | null) => string | null;
  championId: string | null;
  isFinal: boolean;
  controls: ReactNode;
  predictedSideId: string | null;
  isBye: boolean;
}) {
  const a = labelFor(m.playerAUserId);
  const b = labelFor(m.playerBUserId);
  // For a structural bye, the empty side is labeled "BYE" so the card
  // reads as "auto-advance" instead of two ambiguous "—" rows. The seated
  // side keeps its real name (or stays "—" if neither side has cascaded
  // upstream yet).
  const aLabel = a ?? (isBye && !m.playerAUserId && m.playerBUserId ? "BYE" : "—");
  const bLabel = b ?? (isBye && !m.playerBUserId && m.playerAUserId ? "BYE" : "—");
  // Both sides empty + structural bye → the round n+1 cascade has not yet
  // delivered the lone-feeder winner here. Show as "(awaiting feeder)" so it's
  // clear there's no opponent ever coming.
  const bothEmpty = !m.playerAUserId && !m.playerBUserId;
  const winnerSide =
    m.winnerUserId && m.winnerUserId === m.playerAUserId
      ? "a"
      : m.winnerUserId && m.winnerUserId === m.playerBUserId
      ? "b"
      : null;
  const pickedSide =
    predictedSideId && m.playerAUserId === predictedSideId
      ? "a"
      : predictedSideId && m.playerBUserId === predictedSideId
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
        empty={!a}
        won={winnerSide === "a"}
        lost={!!winnerSide && winnerSide !== "a"}
        picked={pickedSide === "a" && !winnerSide}
      />
      <div className="font-display text-xs text-navy-soft text-center">vs</div>
      <Slot
        label={bLabel}
        empty={!b}
        won={winnerSide === "b"}
        lost={!!winnerSide && winnerSide !== "b"}
        picked={pickedSide === "b" && !winnerSide}
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
          {m.resolvedVia === "manual" ? "official bracket!" : "official bracket!"}
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
}: {
  label: string;
  empty: boolean;
  won: boolean;
  lost: boolean;
  picked?: boolean;
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
          : "bg-white text-navy")
      }
    >
      {picked ? "★ " : ""}
      {label}
    </div>
  );
}
