// Compiles a complete tournament archive — bracket, matchups,
// rounds, every attempt, every prediction, every player. Bundled
// into result_json so the workflow's PDF report becomes a
// permanent record. Read-only.

import { db, schema } from "@/db";
import { asc, eq, inArray } from "drizzle-orm";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

export const tournamentArchiveWorkflow: WorkflowDef = {
  id: "tournament-archive",
  name: "Archive the tournament",
  description:
    "Snapshots the entire tournament — every player, every matchup, every round, every attempt — and bundles it into a permanent PDF you can stash for posterity. Run after the season ends.",
  emoji: "🗃️",
  sideEffects: "Read-only.",
  async run(): Promise<WorkflowResult> {
    const t =
      (await getActiveTournament()) ?? (await getLatestTournament());
    if (!t) {
      return {
        ok: false,
        summary: "No tournament to archive.",
        targets: [],
        effects: [],
      };
    }
    const [
      players,
      matchups,
      rounds,
      preds,
    ] = await Promise.all([
      db
        .select({
          id: schema.enrollments.userId,
          name: schema.users.name,
          email: schema.users.email,
          eliminatedAt: schema.enrollments.eliminatedAt,
        })
        .from(schema.enrollments)
        .innerJoin(schema.users, eq(schema.users.id, schema.enrollments.userId))
        .where(eq(schema.enrollments.tournamentId, t.id))
        .orderBy(asc(schema.users.name)),
      db
        .select()
        .from(schema.matchups)
        .where(eq(schema.matchups.tournamentId, t.id))
        .orderBy(
          asc(schema.matchups.bracket),
          asc(schema.matchups.roundIndex),
          asc(schema.matchups.slot)
        ),
      db
        .select()
        .from(schema.rounds)
        .where(eq(schema.rounds.tournamentId, t.id))
        .orderBy(asc(schema.rounds.chapterNumber)),
      db
        .select()
        .from(schema.predictions)
        .where(
          inArray(
            schema.predictions.matchupId,
            (
              await db
                .select({ id: schema.matchups.id })
                .from(schema.matchups)
                .where(eq(schema.matchups.tournamentId, t.id))
            ).map((m) => m.id)
          )
        ),
    ]);

    const playerName = new Map(players.map((p) => [p.id, p.name ?? p.email]));

    const targets: WorkflowTargetResult[] = [];
    targets.push({
      targetId: "summary",
      name: t.title,
      status: t.status === "complete" ? "ok" : "warn",
      tasksRemaining: 0,
      checks: [
        {
          id: "status",
          label: "Tournament status",
          severity: t.status === "complete" ? "ok" : "warn",
          detail: t.status,
        },
        {
          id: "players",
          label: "Players enrolled",
          severity: "ok",
          detail: `${players.length} player(s).`,
        },
        {
          id: "matchups",
          label: "Matchups",
          severity: "ok",
          detail: `${matchups.length} matchups across ${new Set(matchups.map((m) => m.bracket)).size} bracket(s).`,
        },
        {
          id: "rounds",
          label: "Rounds",
          severity: "ok",
          detail: `${rounds.length} round(s).`,
        },
        {
          id: "predictions",
          label: "Predictions cast",
          severity: "ok",
          detail: `${preds.length} prediction(s) across all matchups.`,
        },
        {
          id: "started",
          label: "Started",
          severity: "ok",
          detail: t.startedAt?.toISOString().slice(0, 10) ?? "(not set)",
        },
        {
          id: "ended",
          label: "Ended",
          severity: t.endedAt ? "ok" : "warn",
          detail: t.endedAt?.toISOString().slice(0, 10) ?? "(still open)",
        },
        {
          id: "winner",
          label: "Champion",
          severity: t.winnerUserId ? "ok" : "warn",
          detail: t.winnerUserId
            ? (playerName.get(t.winnerUserId) ?? t.winnerUserId)
            : "(not yet decided)",
        },
      ],
      emailSent: false,
    });
    // One target per matchup for the PDF — chronological narrative.
    for (const m of matchups) {
      const a = m.playerAUserId ? playerName.get(m.playerAUserId) ?? "?" : "—";
      const b = m.playerBUserId ? playerName.get(m.playerBUserId) ?? "?" : "—";
      const winner = m.winnerUserId
        ? playerName.get(m.winnerUserId) ?? "?"
        : null;
      targets.push({
        targetId: m.id,
        name: `${m.bracket}/R${m.roundIndex}/slot${m.slot}`,
        status: winner ? "ok" : "warn",
        tasksRemaining: 0,
        checks: [
          {
            id: "matchup",
            label: `${a} vs ${b}`,
            severity: "ok",
            detail: winner
              ? `Winner: ${winner}.`
              : "Unresolved.",
          },
        ],
        emailSent: false,
      });
    }

    return {
      ok: true,
      summary: `🗃️ Archive built: ${players.length} players · ${matchups.length} matchups · ${rounds.length} rounds.`,
      targets,
      effects: [
        "Read-only snapshot — PDF preserves a permanent record.",
        t.winnerUserId
          ? `Champion: ${playerName.get(t.winnerUserId)}`
          : "Champion not yet decided.",
      ],
    };
  },
};
