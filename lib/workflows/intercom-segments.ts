// Reports the size of common Intercom audience segments based on
// our custom attributes (set in lib/intercom.ts). Read-only — counts
// users in each segment so Sam knows how big a "send to X" cohort is
// BEFORE he schedules an outbound.

import { db, schema } from "@/db";
import { eq, isNotNull, isNull, sql } from "drizzle-orm";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import type { WorkflowDef, WorkflowResult, WorkflowCheck } from "./types";

export const intercomSegmentsWorkflow: WorkflowDef = {
  id: "intercom-segments",
  name: "Intercom segment sizing",
  description:
    "Counts how many users land in each Intercom audience segment we expose via custom attributes (still-in players, eliminated, finalists, NDA pending, predictors, etc.). Read-only — useful for sizing an outbound before you click send.",
  emoji: "🎯",
  sideEffects: "Read-only — does not write to Intercom.",
  async run(): Promise<WorkflowResult> {
    const t = (await getActiveTournament()) ?? (await getLatestTournament());
    if (!t) {
      return {
        ok: false,
        summary: "No tournament.",
        targets: [],
        effects: [],
      };
    }
    const checks: WorkflowCheck[] = [];

    const [{ stillIn }] = await db
      .select({ stillIn: sql<number>`count(*)::int` })
      .from(schema.enrollments)
      .where(sql`tournament_id = ${t.id} and eliminated_at is null`);
    checks.push({
      id: "still-in",
      label: "is_active_player = true",
      severity: "ok",
      detail: `${stillIn} player(s).`,
    });

    const [{ eliminated }] = await db
      .select({ eliminated: sql<number>`count(*)::int` })
      .from(schema.enrollments)
      .where(sql`tournament_id = ${t.id} and eliminated_at is not null`);
    checks.push({
      id: "eliminated",
      label: "is_eliminated = true",
      severity: "ok",
      detail: `${eliminated} player(s).`,
    });

    const [{ nda }] = await db
      .select({ nda: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(isNotNull(schema.users.finalsNdaAgreedAt));
    checks.push({
      id: "nda-agreed",
      label: "finals_nda_agreed = true",
      severity: "ok",
      detail: `${nda} user(s).`,
    });

    const [{ ndaPending }] = await db
      .select({ ndaPending: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(isNull(schema.users.finalsNdaAgreedAt));
    checks.push({
      id: "nda-pending",
      label: "finals_nda_agreed = false",
      severity: "ok",
      detail: `${ndaPending} user(s).`,
    });

    const [{ predictors }] = await db
      .select({
        predictors: sql<number>`count(distinct ${schema.predictions.userId})::int`,
      })
      .from(schema.predictions);
    checks.push({
      id: "predictors",
      label: "predictions_made > 0",
      severity: "ok",
      detail: `${predictors} distinct predictor(s).`,
    });

    const [{ champions }] = await db
      .select({ champions: sql<number>`count(*)::int` })
      .from(schema.tournaments)
      .where(isNotNull(schema.tournaments.winnerUserId));
    checks.push({
      id: "champions",
      label: "is_champion = true (lifetime)",
      severity: "ok",
      detail: `${champions} champion(s).`,
    });

    const [{ qotd }] = await db
      .select({ qotd: sql<number>`count(distinct ${schema.qotdResponses.userId})::int` })
      .from(schema.qotdResponses);
    checks.push({
      id: "qotd",
      label: "qotd_answers > 0",
      severity: "ok",
      detail: `${qotd} distinct QOTD respondent(s).`,
    });

    const [{ newsletter }] = await db
      .select({ newsletter: sql<number>`count(*)::int` })
      .from(schema.newsletterSubscriptions)
      .where(sql`confirmed_at is not null and unsubscribed_at is null`);
    checks.push({
      id: "newsletter",
      label: "newsletter_subscribed = true",
      severity: "ok",
      detail: `${newsletter} subscriber(s).`,
    });

    return {
      ok: true,
      summary: `🎯 ${checks.length} segments sized.`,
      targets: [
        {
          targetId: "segments",
          name: "Intercom audience segments",
          status: "ok",
          tasksRemaining: 0,
          checks,
          emailSent: false,
        },
      ],
      effects: ["Read-only."],
    };
  },
};

// Suppress unused-import warning.
void eq;
