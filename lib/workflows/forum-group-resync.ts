// Forces the SSO group-recompute logic to walk every active player
// once, so any forum group drift (e.g. someone who was eliminated
// but still has 'players' on Discourse) gets corrected on their next
// sign-in via the existing add/remove_groups SSO payload. Read-only
// from this workflow's POV — actual Discourse writes happen later on
// individual user logins.
//
// What we DO write: a marker timestamp in app_settings so we know
// when this was last reconciled.

import { db, schema } from "@/db";
import { eq, isNull } from "drizzle-orm";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import { getBracketGroupsForUser } from "@/lib/discourse-groups";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

const MARKER_KEY = "forum_resync_last_run";

export const forumGroupResyncWorkflow: WorkflowDef = {
  id: "forum-group-resync",
  name: "Forum group resync",
  description:
    "Walks every currently-active player and recomputes their Discourse group set (players/spectators/finalists/etc.) via the same logic the SSO bridge uses on every sign-in. Surfaces drift but does NOT push to Discourse — that happens when each user next signs in.",
  emoji: "🔁",
  sideEffects: "Read-only. Records a 'last-resync-at' marker in app_settings.",
  async run(): Promise<WorkflowResult> {
    const t = (await getActiveTournament()) ?? (await getLatestTournament());
    if (!t)
      return {
        ok: false,
        summary: "No tournament.",
        targets: [],
        effects: [],
      };
    const players = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.enrollments)
      .innerJoin(schema.users, eq(schema.users.id, schema.enrollments.userId))
      .where(
        // Still-enrolled OR ever-enrolled in this tournament.
        eq(schema.enrollments.tournamentId, t.id)
      );

    const targets: WorkflowTargetResult[] = [];
    for (const p of players) {
      try {
        const groups = await getBracketGroupsForUser(p.id);
        targets.push({
          targetId: p.id,
          name: p.name ?? p.email,
          contact: p.email,
          status: "ok",
          tasksRemaining: 0,
          checks: [
            {
              id: "title",
              label: "Display title",
              severity: "ok",
              detail: groups.title,
            },
            {
              id: "include",
              label: "Will be added to groups",
              severity: "ok",
              detail: groups.include.join(", ") || "(none)",
            },
            {
              id: "exclude",
              label: "Will be removed from groups",
              severity: "ok",
              detail: groups.exclude.join(", ") || "(none)",
            },
          ],
          emailSent: false,
        });
      } catch (err) {
        targets.push({
          targetId: p.id,
          name: p.name ?? p.email,
          contact: p.email,
          status: "fail",
          tasksRemaining: 1,
          checks: [
            {
              id: "compute",
              label: "Group computation",
              severity: "fail",
              detail: err instanceof Error ? err.message : String(err),
            },
          ],
          emailSent: false,
        });
      }
    }

    await db
      .insert(schema.appSettings)
      .values({ key: MARKER_KEY, value: new Date().toISOString() })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value: new Date().toISOString(), updatedAt: new Date() },
      });

    return {
      ok: true,
      summary: `🔁 Recomputed groups for ${players.length} player${players.length === 1 ? "" : "s"}.`,
      targets,
      effects: [
        "Wrote forum_resync_last_run marker.",
        "Actual Discourse writes happen on each player's next SSO sign-in.",
      ],
    };
  },
};

// Suppress unused-import warning from drizzle-orm.
void isNull;
