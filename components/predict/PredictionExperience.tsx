"use client";

import { useEffect, useMemo, useState, useTransition, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { submitPredictionAction } from "@/app/predict/actions";
import { bracketByeSet } from "@/lib/predictions";

// ─── types ────────────────────────────────────────────────────────────
type BracketKind = "main" | "losers";
type Matchup = {
  id: string;
  bracket: BracketKind;
  roundIndex: number;
  slot: number;
  playerAUserId: string | null;
  playerBUserId: string | null;
  winnerUserId: string | null;
  predictionsLockedAt: string | null;
  loserNextMatchupId: string | null;
  loserNextSide: "a" | "b" | null;
};
type UserLite = { id: string; name: string | null; email: string | null };

type Props = {
  matchups: Matchup[];
  users: UserLite[];
  seeds: Record<string, number>;
  myPredictions: Record<string, string>; // matchupId → predicted user id
  prizeText: string;
};

// ─── geometry constants ───────────────────────────────────────────────
const CARD_W = 300;
const CARD_H = 130;
const COL_GAP = 80;
const ROW_GAP_BASE = 24;
const PAD = 60;

// ─── helpers ──────────────────────────────────────────────────────────
function nameOf(users: UserLite[], id: string | null): string {
  if (!id) return "—";
  const u = users.find((x) => x.id === id);
  return u?.name ?? u?.email ?? "—";
}

function pointValueFor(m: Matchup): number {
  if (m.bracket === "losers") return 1;
  if (m.roundIndex >= 4) return 4;
  if (m.roundIndex === 3) return 2;
  return 1;
}

// Compute the y-position of a matchup card so winners visually feed up
// to their next-round cards (each round halves vertical density).
function positionOf(
  m: Matchup,
  rounds: number[],
  maxSlots: number
): { x: number; y: number } {
  const colIdx = rounds.indexOf(m.roundIndex);
  const x = PAD + colIdx * (CARD_W + COL_GAP);
  // Spread vertically across the canvas so siblings span widely.
  const totalHeight = maxSlots * (CARD_H + ROW_GAP_BASE);
  const matchesInRound = rounds.length > 0
    ? Math.max(1, maxSlots / Math.pow(2, colIdx))
    : 1;
  const slotHeight = totalHeight / matchesInRound;
  const y = PAD + m.slot * slotHeight + (slotHeight - CARD_H) / 2;
  return { x, y };
}

// Determine the "effective" players A and B for a matchup, taking into
// account real winners + the user's predictions cascading up the bracket.
//
// We iterate per-matchup in (bracket, round, slot) order so each matchup
// sees the cascade output of its feeders. `effWinnerOf` is computed from
// the cascade-derived `eff` map — that way phantom-bye matchups (where
// only one feeder exists in R-1) auto-advance their lone feeder's winner
// into the next round, instead of leaving a permanent null.
function cascade(
  matchups: Matchup[],
  predictions: Record<string, string>
): Map<string, { a: string | null; b: string | null }> {
  const eff = new Map<string, { a: string | null; b: string | null }>();
  const byKey = new Map<string, Matchup>();
  for (const m of matchups)
    byKey.set(`${m.bracket}:${m.roundIndex}:${m.slot}`, m);
  const byId = new Map(matchups.map((m) => [m.id, m]));

  // Process bracket-by-bracket, round-by-round, slot-by-slot so feeders
  // are always resolved before their consumers.
  const ordered = [...matchups].sort((p, q) => {
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
    // Both seated → must come from explicit prediction.
    if (a && b) return predictions[id] ?? null;
    // One side filled, other empty → lone player auto-advances (this is
    // the "phantom bye" path, including odd-R1 tail byes).
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
    if (!a || !b) return null; // bye → no loser
    if (m.winnerUserId)
      return m.winnerUserId === a ? b : m.winnerUserId === b ? a : null;
    const pick = predictions[id];
    if (pick) return pick === a ? b : pick === b ? a : null;
    return null;
  }

  for (const m of ordered) {
    let a: string | null = m.playerAUserId;
    let b: string | null = m.playerBUserId;

    // Cascade winners up the same bracket.
    if (m.roundIndex > 1) {
      const slotA = m.slot * 2;
      const slotB = m.slot * 2 + 1;
      const fA = byKey.get(`${m.bracket}:${m.roundIndex - 1}:${slotA}`);
      const fB = byKey.get(`${m.bracket}:${m.roundIndex - 1}:${slotB}`);
      if (!a && fA) a = effWinnerOf(fA.id);
      if (!b && fB) b = effWinnerOf(fB.id);
    }

    // Losers-bracket R1 sides may be fed by main-R1 losers.
    if (m.bracket === "losers" && m.roundIndex === 1 && (!a || !b)) {
      for (const src of matchups) {
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

// ─── component ────────────────────────────────────────────────────────
export function PredictionExperience({
  matchups,
  users,
  seeds,
  myPredictions: initialPreds,
  prizeText,
}: Props) {
  const [bracket, setBracket] = useState<BracketKind | null>(null);
  const [predictions, setPredictions] =
    useState<Record<string, string>>(initialPreds);
  const [focusIdx, setFocusIdx] = useState(0);
  const [viewAll, setViewAll] = useState(false);
  const [, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [vw, setVw] = useState(800);
  const [vh, setVh] = useState(600);

  // Branch-scoped matchups.
  const branchMatchups = useMemo(
    () => matchups.filter((m) => bracket && m.bracket === bracket),
    [matchups, bracket]
  );
  const rounds = useMemo(
    () => [...new Set(branchMatchups.map((m) => m.roundIndex))].sort(),
    [branchMatchups]
  );
  const maxSlots = useMemo(() => {
    if (branchMatchups.length === 0) return 1;
    return rounds.reduce((n, r) => {
      const inRound = branchMatchups.filter((m) => m.roundIndex === r).length;
      // We need slots based on round 0's count, treat first round as the
      // canvas's vertical baseline.
      return Math.max(n, inRound * Math.pow(2, rounds.indexOf(r)));
    }, 1);
  }, [branchMatchups, rounds]);

  // Sort focus order by round then slot for predictable Next/Back walk.
  const focusOrder = useMemo(() => {
    return [...branchMatchups].sort((a, b) => {
      if (a.roundIndex !== b.roundIndex) return a.roundIndex - b.roundIndex;
      return a.slot - b.slot;
    });
  }, [branchMatchups]);

  const cascadeMap = useMemo(
    () => cascade(matchups, predictions),
    [matchups, predictions]
  );

  // Structural bye check — shared with the server-side BracketView so the
  // two views agree on what "BYE" means. See lib/predictions.ts/bracketByeSet.
  const byeMap = useMemo(() => {
    const set = bracketByeSet(matchups);
    const out = new Map<string, boolean>();
    for (const m of matchups) out.set(m.id, set.has(m.id));
    return out;
  }, [matchups]);

  // Compute card positions (in canvas-space).
  const positions = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const mu of branchMatchups) {
      m.set(mu.id, positionOf(mu, rounds, maxSlots));
    }
    return m;
  }, [branchMatchups, rounds, maxSlots]);

  // Canvas dimensions.
  const canvasW =
    PAD * 2 + Math.max(rounds.length, 1) * (CARD_W + COL_GAP) - COL_GAP;
  const canvasH = PAD * 2 + maxSlots * (CARD_H + ROW_GAP_BASE);

  // Track viewport size.
  useEffect(() => {
    function update() {
      if (!viewportRef.current) return;
      const r = viewportRef.current.getBoundingClientRect();
      setVw(r.width);
      setVh(r.height);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [bracket]);

  // Camera target: focused-card center → viewport center.
  const focused = focusOrder[focusIdx] ?? null;
  const fitScale = Math.min(
    vw / Math.max(canvasW + 40, 1),
    vh / Math.max(canvasH + 40, 1)
  );
  const scale = viewAll ? fitScale : 1;
  let cx = canvasW / 2;
  let cy = canvasH / 2;
  if (!viewAll && focused) {
    const p = positions.get(focused.id);
    if (p) {
      cx = p.x + CARD_W / 2;
      cy = p.y + CARD_H / 2;
    }
  }
  const tx = -cx * scale + vw / 2;
  const ty = -cy * scale + vh / 2;

  // ── prediction submission ──
  // Optimistic update with rollback. If the server rejects, we restore the
  // previous value and surface the reason. The action throws on failure
  // (see app/predict/actions.ts) — silent catches were the bug that made
  // picks appear saved but disappear on reload.
  function pickWinner(matchupId: string, winnerUserId: string) {
    const previous = predictions[matchupId];
    setPredictions((prev) => ({ ...prev, [matchupId]: winnerUserId }));
    setSaveError(null);
    setSavingCount((n) => n + 1);
    const fd = new FormData();
    fd.set("matchupId", matchupId);
    fd.set("predictedWinnerUserId", winnerUserId);
    startTransition(async () => {
      try {
        await submitPredictionAction(fd);
      } catch (e) {
        // Roll back the optimistic UI.
        setPredictions((prev) => {
          const copy = { ...prev };
          if (previous) copy[matchupId] = previous;
          else delete copy[matchupId];
          return copy;
        });
        setSaveError(
          e instanceof Error ? e.message : "couldn't save your pick"
        );
      } finally {
        setSavingCount((n) => Math.max(0, n - 1));
      }
    });
  }

  // ── branch chooser ──
  if (!bracket) {
    return <BranchChooser onChoose={setBracket} prizeText={prizeText} />;
  }

  const otherBracket: BracketKind = bracket === "main" ? "losers" : "main";
  // Universe = matchups in this branch that are real predictions (not byes,
  // not host-locked). Numerator = matchups in that universe where the user
  // either has a saved pick OR the matchup is already decided.
  const universe = focusOrder.filter(
    (m) => !byeMap.get(m.id) && !m.predictionsLockedAt
  );
  const totalPicked = universe.filter(
    (m) => predictions[m.id] || m.winnerUserId
  ).length;
  const totalSlots = universe.length;
  // Pickable RIGHT NOW = both cascade sides seated and not yet decided/locked.
  const pickableNow = universe.filter(
    (m) =>
      !m.winnerUserId &&
      !!cascadeMap.get(m.id)?.a &&
      !!cascadeMap.get(m.id)?.b
  ).length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "radial-gradient(ellipse at top, rgba(255,107,157,0.18), transparent 60%), radial-gradient(ellipse at bottom, rgba(0,240,255,0.10), transparent 65%), linear-gradient(180deg, #14062E 0%, #0B0322 100%)",
        zIndex: 100,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "14px 16px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          zIndex: 5,
          background:
            "linear-gradient(180deg, rgba(20,6,46,0.95) 0%, rgba(20,6,46,0) 100%)",
          color: "#F4ECFF",
        }}
      >
        <Link
          href="/predict"
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "#F4ECFF",
            padding: "6px 12px",
            borderRadius: 999,
            fontFamily: "Fredoka, sans-serif",
            fontSize: 13,
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          ← List view
        </Link>
        <span
          style={{
            fontFamily: "Fredoka, sans-serif",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: "0.06em",
            color: bracket === "main" ? "#FFD93D" : "#FF2D75",
          }}
        >
          {bracket === "main" ? "🏆 MAIN BRACKET" : "💔 LOSERS BRACKET"}
        </span>
        <button
          onClick={() => {
            setBracket(otherBracket);
            setFocusIdx(0);
            setViewAll(false);
          }}
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "#F4ECFF",
            padding: "6px 12px",
            borderRadius: 999,
            fontFamily: "Fredoka, sans-serif",
            fontSize: 12,
            border: "1px solid rgba(255,255,255,0.15)",
            cursor: "pointer",
          }}
        >
          ⇄ swap to {otherBracket}
        </button>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "Quicksand, sans-serif",
            fontSize: 12,
            color: "rgba(244,236,255,0.7)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span>
            {totalPicked} / {totalSlots} picked · {pickableNow} pickable now
          </span>
          {savingCount > 0 ? (
            <span style={{ color: "#FFD93D" }}>· saving…</span>
          ) : saveError ? null : predictions && Object.keys(predictions).length > 0 ? (
            <span style={{ color: "#2CFF8A" }}>· ✓ saved</span>
          ) : null}
        </span>
      </div>
      {saveError ? (
        <div
          style={{
            position: "absolute",
            top: 56,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#FF2D75",
            color: "#1B0440",
            padding: "8px 14px",
            borderRadius: 12,
            border: "2px solid #1B0440",
            boxShadow: "0 4px 0 #1B0440",
            fontFamily: "Fredoka, sans-serif",
            fontWeight: 700,
            fontSize: 13,
            zIndex: 6,
            cursor: "pointer",
          }}
          onClick={() => setSaveError(null)}
          title="Click to dismiss"
        >
          ⚠ Save failed: {saveError} · click to dismiss
        </div>
      ) : null}

      {/* Bracket viewport */}
      <div
        ref={viewportRef}
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          bottom: 100,
          overflow: "hidden",
        }}
      >
        <motion.div
          animate={{ x: tx, y: ty, scale }}
          transition={{ duration: 0.55, ease: [0.2, 0.8, 0.3, 1] }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: canvasW,
            height: canvasH,
            transformOrigin: "0 0",
          }}
        >
          {/* Connector lines (drawn first so they sit behind cards) */}
          <svg
            width={canvasW}
            height={canvasH}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            {branchMatchups
              .filter((m) => m.roundIndex > 1)
              .map((m) => {
                const here = positions.get(m.id);
                if (!here) return null;
                const slotA = m.slot * 2;
                const slotB = m.slot * 2 + 1;
                const fA = branchMatchups.find(
                  (x) =>
                    x.roundIndex === m.roundIndex - 1 && x.slot === slotA
                );
                const fB = branchMatchups.find(
                  (x) =>
                    x.roundIndex === m.roundIndex - 1 && x.slot === slotB
                );
                const lines: React.ReactElement[] = [];
                for (const f of [fA, fB]) {
                  if (!f) continue;
                  const fp = positions.get(f.id);
                  if (!fp) continue;
                  const x1 = fp.x + CARD_W;
                  const y1 = fp.y + CARD_H / 2;
                  const x2 = here.x;
                  const y2 = here.y + CARD_H / 2;
                  const midX = (x1 + x2) / 2;
                  lines.push(
                    <path
                      key={`${m.id}-${f.id}`}
                      d={`M${x1} ${y1} H${midX} V${y2} H${x2}`}
                      stroke="rgba(178,58,255,0.45)"
                      strokeWidth={2}
                      fill="none"
                    />
                  );
                }
                return lines;
              })}
          </svg>

          {branchMatchups.map((m) => {
            const pos = positions.get(m.id);
            if (!pos) return null;
            const eff = cascadeMap.get(m.id) ?? { a: null, b: null };
            const isFocused = !viewAll && focused?.id === m.id;
            return (
              <MatchupCard
                key={m.id}
                m={m}
                effA={eff.a}
                effB={eff.b}
                pickedId={predictions[m.id] ?? null}
                seeds={seeds}
                users={users}
                isFocused={isFocused}
                isBye={byeMap.get(m.id) ?? false}
                onPick={(uid) => pickWinner(m.id, uid)}
                style={{
                  position: "absolute",
                  left: pos.x,
                  top: pos.y,
                  width: CARD_W,
                  height: CARD_H,
                }}
              />
            );
          })}
        </motion.div>
      </div>

      {/* Bottom controls */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "16px",
          display: "flex",
          gap: 10,
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
          background:
            "linear-gradient(0deg, rgba(20,6,46,0.95) 0%, rgba(20,6,46,0) 100%)",
        }}
      >
        <button
          onClick={() => {
            setFocusIdx((i) => Math.max(0, i - 1));
            setViewAll(false);
          }}
          disabled={focusIdx === 0 && !viewAll}
          style={btnStyle("white")}
        >
          ← Back
        </button>
        <button
          onClick={() => setViewAll((v) => !v)}
          style={btnStyle(viewAll ? "coral" : "white")}
        >
          {viewAll ? "Zoom in" : "View all"}
        </button>
        <button
          onClick={() => {
            setFocusIdx((i) => Math.min(focusOrder.length - 1, i + 1));
            setViewAll(false);
          }}
          disabled={focusIdx >= focusOrder.length - 1 && !viewAll}
          style={btnStyle("coral")}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function btnStyle(variant: "white" | "coral"): React.CSSProperties {
  return {
    padding: "10px 18px",
    fontFamily: "Fredoka, sans-serif",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: "0.04em",
    color: variant === "coral" ? "#1B0440" : "#1B0440",
    background:
      variant === "coral"
        ? "linear-gradient(180deg, #FFCC00 0%, #FF6B00 100%)"
        : "#FFFFFF",
    border: "2px solid #1B0440",
    borderRadius: 12,
    boxShadow: "0 4px 0 #1B0440",
    cursor: "pointer",
  };
}

// ─── matchup card ─────────────────────────────────────────────────────
function MatchupCard({
  m,
  effA,
  effB,
  pickedId,
  seeds,
  users,
  isFocused,
  isBye,
  onPick,
  style,
}: {
  m: Matchup;
  effA: string | null;
  effB: string | null;
  pickedId: string | null;
  seeds: Record<string, number>;
  users: UserLite[];
  isFocused: boolean;
  isBye: boolean;
  onPick: (userId: string) => void;
  style: React.CSSProperties;
}) {
  const decided = !!m.winnerUserId;
  const lockedManual = !!m.predictionsLockedAt;
  const seated = !!effA && !!effB;
  // Bye = matchup whose missing side will *never* fill via cascade.
  // Computed by the parent and passed in.
  const predictable = !decided && !lockedManual && seated && !isBye;
  const points = pointValueFor(m);
  const labelOf = (id: string | null) => nameOf(users, id);
  const seedOf = (id: string | null) =>
    id && seeds[id] ? `#${seeds[id]} ` : "";

  return (
    <div
      style={{
        ...style,
        background:
          "linear-gradient(180deg, rgba(31,14,63,0.95) 0%, rgba(15,5,35,0.98) 100%)",
        border: `2px solid ${
          isFocused
            ? "#FFCC00"
            : decided
            ? "#2CFF8A"
            : lockedManual
            ? "#FF2D75"
            : "rgba(178,58,255,0.55)"
        }`,
        boxShadow: isFocused
          ? "0 0 0 1px rgba(0,0,0,0.5) inset, 0 0 32px rgba(255,204,0,0.5)"
          : "0 0 0 1px rgba(0,0,0,0.5) inset, 0 8px 22px rgba(0,0,0,0.45)",
        borderRadius: 14,
        padding: 10,
        color: "#F4ECFF",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        transition: "border-color .2s, box-shadow .2s",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontFamily: "Fredoka, sans-serif",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: m.bracket === "main" ? "#FFD93D" : "#FF2D75",
        }}
      >
        <span>
          {m.bracket === "main" ? "Main" : "Losers"} R{m.roundIndex} · slot{" "}
          {m.slot}
        </span>
        <span style={{ color: "rgba(244,236,255,0.65)" }}>
          {isBye ? "BYE · auto-advance" : `${points} pt`}
        </span>
      </div>
      {[
        { uid: effA, label: "A" as const },
        { uid: effB, label: "B" as const },
      ].map(({ uid, label }) => {
        const isPicked = !!pickedId && uid === pickedId;
        const isWinner = decided && m.winnerUserId === uid;
        const isLoser = decided && uid && m.winnerUserId !== uid;
        const tbd = !uid;
        const disabled = !predictable || tbd;
        const baseBg = isPicked
          ? "linear-gradient(180deg, #FFCC00 0%, #FF6B00 100%)"
          : isWinner
          ? "linear-gradient(180deg, #2CFF8A 0%, #0E9C4F 100%)"
          : isLoser
          ? "rgba(255,45,117,0.18)"
          : "rgba(255,255,255,0.08)";
        const color = isPicked
          ? "#1B0440"
          : isLoser
          ? "rgba(244,236,255,0.45)"
          : "#F4ECFF";
        const border = isPicked
          ? "1px solid #1B0440"
          : isWinner
          ? "1px solid #2CFF8A"
          : "1px solid rgba(178,58,255,0.4)";
        return (
          <button
            key={label}
            onClick={() => uid && predictable && onPick(uid)}
            disabled={disabled}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 8,
              background: baseBg,
              color,
              border,
              fontFamily: "Fredoka, sans-serif",
              fontWeight: 700,
              fontSize: 14,
              textAlign: "left",
              cursor: disabled ? "default" : "pointer",
              opacity: tbd && !decided ? 0.6 : 1,
              textDecoration: isLoser ? "line-through" : "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {isPicked ? "★ " : ""}
            {seedOf(uid)}
            {labelOf(uid)}
          </button>
        );
      })}
    </div>
  );
}

// ─── branch chooser ───────────────────────────────────────────────────
function BranchChooser({
  onChoose,
  prizeText,
}: {
  onChoose: (b: BracketKind) => void;
  prizeText: string;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background:
          "radial-gradient(ellipse at top, rgba(255,107,157,0.22), transparent 60%), radial-gradient(ellipse at bottom, rgba(0,240,255,0.16), transparent 65%), linear-gradient(180deg, #14062E 0%, #0B0322 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        color: "#F4ECFF",
        textAlign: "center",
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: "#00F0FF",
        }}
      >
        Predictions experience
      </p>
      <h1
        style={{
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: "clamp(40px, 9vw, 80px)",
          margin: "12px 0 6px",
          color: "#FFFFFF",
          textShadow: "4px 4px 0 #1B0440, 0 0 20px rgba(255,204,0,0.45)",
          lineHeight: 0.95,
        }}
      >
        Pick a bracket.
      </h1>
      <p
        style={{
          fontFamily: "Quicksand, sans-serif",
          fontSize: 16,
          margin: "8px 0 28px",
          color: "rgba(244,236,255,0.8)",
          maxWidth: 520,
        }}
      >
        Same picks experience either way — main is for who wins the whole
        thing, losers is for the comeback track. You can swap any time.
      </p>
      {prizeText ? (
        <p
          style={{
            fontFamily: "Fredoka, sans-serif",
            fontSize: 12,
            margin: "0 0 28px",
            color: "#FFD93D",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          🏆 prize: {prizeText}
        </p>
      ) : null}
      <div
        style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center" }}
      >
        <button onClick={() => onChoose("main")} style={chooserBtn("gold")}>
          🏆 Main bracket
        </button>
        <button onClick={() => onChoose("losers")} style={chooserBtn("magenta")}>
          💔 Losers bracket
        </button>
      </div>
      <Link
        href="/predict"
        style={{
          marginTop: 28,
          fontFamily: "Fredoka, sans-serif",
          fontSize: 13,
          color: "rgba(244,236,255,0.6)",
          textDecoration: "none",
        }}
      >
        ← prefer the list view
      </Link>
    </div>
  );
}

function chooserBtn(variant: "gold" | "magenta"): React.CSSProperties {
  return {
    padding: "20px 36px",
    fontFamily: "Fredoka, sans-serif",
    fontWeight: 700,
    fontSize: 22,
    letterSpacing: "0.04em",
    color: variant === "gold" ? "#1B0440" : "#FFFFFF",
    background:
      variant === "gold"
        ? "linear-gradient(180deg, #FFCC00 0%, #FF6B00 100%)"
        : "linear-gradient(180deg, #FF2D75 0%, #B23AFF 100%)",
    border: "3px solid #1B0440",
    borderRadius: 16,
    boxShadow: "6px 6px 0 #1B0440",
    cursor: "pointer",
  };
}
