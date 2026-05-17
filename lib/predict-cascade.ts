// Pure prediction helpers — cascade + structural bye detection. NO database
// imports. This file is deliberately separate from lib/predictions.ts so it
// can be imported from "use client" components (`PredictionExperience`,
// `BracketView` in client paths, etc.) without dragging `db/index.ts` —
// which throws if DATABASE_URL is unset — into the client bundle.

// `bracket` is `string` rather than the literal union because the DB column
// is text, not a pgEnum, so Drizzle types it as string. Callers pass the
// relaxed type; we narrow at use sites.
export type CascadeMatchup = {
  id: string;
  bracket: string;
  roundIndex: number;
  slot: number;
  playerAUserId: string | null;
  playerBUserId: string | null;
  winnerUserId: string | null;
  loserNextMatchupId: string | null;
  loserNextSide: string | null;
};

export type CascadeMap = Map<
  string,
  { a: string | null; b: string | null }
>;

// Resolve effective per-user player IDs for every matchup, given the
// user's saved predictions. Used by both:
//   • the server-rendered /predict page (read-only bracket overlay)
//   • the client-side prediction experience
// so picks propagate visually through the bracket the same way both places.
export function cascadeBracket(
  ms: CascadeMatchup[],
  picks: Record<string, string>
): CascadeMap {
  const eff: CascadeMap = new Map();
  const byKey = new Map<string, CascadeMatchup>();
  for (const m of ms) byKey.set(`${m.bracket}:${m.roundIndex}:${m.slot}`, m);
  const byId = new Map(ms.map((m) => [m.id, m]));

  // Process bracket-by-bracket, round-by-round, slot-by-slot.
  const ordered = [...ms].sort((p, q) => {
    if (p.bracket !== q.bracket) return p.bracket === "main" ? -1 : 1;
    if (p.roundIndex !== q.roundIndex) return p.roundIndex - q.roundIndex;
    return p.slot - q.slot;
  });

  function effWinnerOf(id: string): string | null {
    const m = byId.get(id);
    if (!m) return null;
    if (m.winnerUserId) return m.winnerUserId;
    const e = eff.get(id);
    const a = e?.a ?? null;
    const b = e?.b ?? null;
    if (a && b) return picks[id] ?? null;
    if (a && !b) return a;
    if (b && !a) return b;
    return null;
  }
  function effLoserOf(id: string): string | null {
    const m = byId.get(id);
    if (!m) return null;
    const e = eff.get(id);
    const a = e?.a ?? null;
    const b = e?.b ?? null;
    if (!a || !b) return null;
    if (m.winnerUserId)
      return m.winnerUserId === a ? b : m.winnerUserId === b ? a : null;
    const pick = picks[id];
    if (pick) return pick === a ? b : pick === b ? a : null;
    return null;
  }

  for (const m of ordered) {
    let a: string | null = m.playerAUserId;
    let b: string | null = m.playerBUserId;
    if (m.roundIndex > 1) {
      const fA = byKey.get(`${m.bracket}:${m.roundIndex - 1}:${m.slot * 2}`);
      const fB = byKey.get(`${m.bracket}:${m.roundIndex - 1}:${m.slot * 2 + 1}`);
      if (!a && fA) a = effWinnerOf(fA.id);
      if (!b && fB) b = effWinnerOf(fB.id);
    }
    if (m.bracket === "losers" && m.roundIndex === 1 && (!a || !b)) {
      for (const src of ms) {
        if (
          src.bracket === "main" &&
          src.roundIndex === 1 &&
          src.loserNextMatchupId === m.id
        ) {
          const loser = effLoserOf(src.id);
          if (loser) {
            if (src.loserNextSide === "a" && !a) a = loser;
            if (src.loserNextSide === "b" && !b) b = loser;
          }
        }
      }
    }
    eff.set(m.id, { a, b });
  }
  return eff;
}

// Structural bye detection. Mirrors lib/predictions.ts isByeMatchup but for
// the *whole bracket at once*, returning every matchup-id that should be
// labelled "BYE" in the UI.
export function bracketByeSet(ms: CascadeMatchup[]): Set<string> {
  const out = new Set<string>();
  for (const m of ms) {
    if (m.winnerUserId) continue;
    const aSeated = !!m.playerAUserId;
    const bSeated = !!m.playerBUserId;
    if (aSeated && bSeated) continue;
    if (m.roundIndex === 1) {
      if (m.bracket === "losers") {
        if (!aSeated && !bSeated) {
          const willFillEither = ms.some(
            (x) => x.bracket === "main" && x.loserNextMatchupId === m.id
          );
          if (!willFillEither) out.add(m.id);
          // Phantom bye when only ONE main loser routes here (the late-add
          // Adam-Erin tail).
          const routesIn = ms.filter(
            (x) => x.bracket === "main" && x.loserNextMatchupId === m.id
          );
          if (routesIn.length === 1) out.add(m.id);
        } else {
          const missingSide: "a" | "b" = aSeated ? "b" : "a";
          const willFill = ms.some(
            (x) =>
              x.bracket === "main" &&
              x.loserNextMatchupId === m.id &&
              x.loserNextSide === missingSide
          );
          if (!willFill) out.add(m.id);
        }
        continue;
      }
      // Main R1: single-side seated = bye.
      if (aSeated || bSeated) out.add(m.id);
      continue;
    }
    // R2+: bye iff at most one R-1 feeder slot exists.
    const slotA = m.slot * 2;
    const slotB = m.slot * 2 + 1;
    const fA = ms.find(
      (x) =>
        x.bracket === m.bracket &&
        x.roundIndex === m.roundIndex - 1 &&
        x.slot === slotA
    );
    const fB = ms.find(
      (x) =>
        x.bracket === m.bracket &&
        x.roundIndex === m.roundIndex - 1 &&
        x.slot === slotB
    );
    const feederCount = (fA ? 1 : 0) + (fB ? 1 : 0);
    if (feederCount <= 1) out.add(m.id);
  }
  return out;
}
