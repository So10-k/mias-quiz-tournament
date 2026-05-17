// Read-only bracket integrity check. Catches orphan matchups,
// duplicate seatings, unresolved propagation, etc.

import { db, schema } from "@/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import type { WorkflowDef, WorkflowResult, WorkflowCheck } from "./types";

export const bracketIntegrityWorkflow: WorkflowDef = {
  id: "bracket-integrity",
  name: "Bracket integrity check",
  description:
    "Walks the bracket and flags anomalies: orphaned matchups (winner with no propagation), players seated in both brackets at once, duplicate seatings, missing winnerUserIds in resolved rounds, etc. Read-only.",
  emoji: "🪜",
  sideEffects: "None.",
  async run(): Promise<WorkflowResult> {
    const t =
      (await getActiveTournament()) ?? (await getLatestTournament());
    if (!t) {
      return {
        ok: false,
        summary: "No tournament found.",
        targets: [],
        effects: [],
      };
    }
    const rows = await db
      .select()
      .from(schema.matchups)
      .where(eq(schema.matchups.tournamentId, t.id));

    const checks: WorkflowCheck[] = [];

    // 1. Each matchup with a winner has that winner ALSO as one of the
    //    players. Anomalous if not.
    const winnerMismatches = rows.filter(
      (m) =>
        m.winnerUserId &&
        m.winnerUserId !== m.playerAUserId &&
        m.winnerUserId !== m.playerBUserId
    );
    checks.push({
      id: "winner-mismatch",
      label: "Winners are seated players",
      severity: winnerMismatches.length === 0 ? "ok" : "fail",
      detail:
        winnerMismatches.length === 0
          ? "Every winner matches one of the matchup's seated players."
          : `${winnerMismatches.length} matchup(s) have a winner who isn't seated.`,
    });

    // 2. Duplicate seatings — same player in both slots of a matchup.
    const dupSlots = rows.filter(
      (m) => m.playerAUserId && m.playerAUserId === m.playerBUserId
    );
    checks.push({
      id: "duplicate-slot",
      label: "No duplicate seatings in a matchup",
      severity: dupSlots.length === 0 ? "ok" : "fail",
      detail:
        dupSlots.length === 0
          ? "No same-player-on-both-sides anomalies."
          : `${dupSlots.length} matchup(s) have the same player on both sides.`,
    });

    // 3. Cross-bracket double-seating — a player seated in BOTH the
    //    winners' final AND the losers' final at the same time.
    const finalsRows = rows.filter(
      (m) =>
        m.roundIndex ===
        rows
          .filter((x) => x.bracket === m.bracket)
          .reduce((mx, x) => Math.max(mx, x.roundIndex), 0)
    );
    const seenPlayers = new Map<string, string[]>();
    for (const m of finalsRows) {
      for (const p of [m.playerAUserId, m.playerBUserId]) {
        if (!p) continue;
        const list = seenPlayers.get(p) ?? [];
        list.push(`${m.bracket}/R${m.roundIndex}`);
        seenPlayers.set(p, list);
      }
    }
    const crossSeats = Array.from(seenPlayers.entries()).filter(
      ([, slots]) => new Set(slots.map((s) => s.split("/")[0])).size > 1
    );
    checks.push({
      id: "cross-bracket",
      label: "No player double-seated across brackets",
      severity: crossSeats.length === 0 ? "ok" : "fail",
      detail:
        crossSeats.length === 0
          ? "Finals seats are exclusive."
          : `Players in both brackets: ${crossSeats.map(([id]) => id).join(", ")}.`,
    });

    // 4. Resolved-but-orphan matchups — a round has all winners set,
    //    but the next-round matchup has both slots empty.
    const maxByBracket = new Map<string, number>();
    for (const m of rows) {
      maxByBracket.set(
        m.bracket,
        Math.max(maxByBracket.get(m.bracket) ?? 0, m.roundIndex)
      );
    }
    let orphans = 0;
    for (const m of rows) {
      const isFinal = m.roundIndex === maxByBracket.get(m.bracket);
      if (isFinal) continue;
      if (!m.winnerUserId) continue;
      // Find a matchup in the next round that should have inherited.
      const nextRound = m.roundIndex + 1;
      const candidates = rows.filter(
        (x) => x.bracket === m.bracket && x.roundIndex === nextRound
      );
      const seated = candidates.some(
        (c) => c.playerAUserId === m.winnerUserId || c.playerBUserId === m.winnerUserId
      );
      if (!seated) orphans++;
    }
    checks.push({
      id: "propagation",
      label: "Winners propagate to the next round",
      severity: orphans === 0 ? "ok" : "fail",
      detail:
        orphans === 0
          ? "All resolved winners have a next-round seat."
          : `${orphans} winner(s) did not propagate. Re-run resolveBracket from /host.`,
    });

    // 5. Empty matchups in early rounds.
    const [{ c: emptyR1 }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.matchups)
      .where(
        and(
          eq(schema.matchups.tournamentId, t.id),
          eq(schema.matchups.roundIndex, 1),
          isNull(schema.matchups.playerAUserId),
          isNull(schema.matchups.playerBUserId)
        )
      );
    checks.push({
      id: "r1-populated",
      label: "Round 1 fully seated",
      severity: emptyR1 === 0 ? "ok" : "warn",
      detail:
        emptyR1 === 0
          ? "Every R1 matchup has at least one player."
          : `${emptyR1} R1 matchup(s) are completely empty.`,
    });

    const worstSeverity = checks.reduce<"ok" | "warn" | "fail">(
      (acc, c) => (c.severity === "fail" ? "fail" : c.severity === "warn" && acc !== "fail" ? "warn" : acc),
      "ok"
    );

    return {
      ok: worstSeverity !== "fail",
      summary:
        worstSeverity === "fail"
          ? "🚨 Bracket has structural anomalies — see report."
          : worstSeverity === "warn"
            ? "⚠️ Bracket is mostly clean with soft warnings."
            : "✅ Bracket integrity clean.",
      targets: [
        {
          targetId: t.id,
          name: t.title,
          status: worstSeverity,
          tasksRemaining: checks.filter((c) => c.severity !== "ok").length,
          checks,
          emailSent: false,
        },
      ],
      effects: ["Read-only."],
    };
  },
};
