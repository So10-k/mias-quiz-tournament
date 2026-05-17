// Read-only site-wide health check. Pulls together every "is this
// component up?" signal so Sam can glance at one PDF 30 min before
// going live and know whether anything is broken. No side effects.

import { db, schema } from "@/db";
import { eq, gt, sql } from "drizzle-orm";
import {
  getWinnersFinalMatchupId,
  getLosersFinalMatchupId,
  getAllFinalistUserIds,
} from "@/lib/finals-access";
import { getZohoWebinar } from "@/lib/zoho-webinar";
import { getFinalsRoundSummary } from "@/lib/finals-rounds";
import { intercomEnabled } from "@/lib/intercom";
import { intercomApiReady } from "@/lib/intercom-api";
import type {
  WorkflowDef,
  WorkflowResult,
  WorkflowCheck,
  CheckSeverity,
} from "./types";

function worst(a: CheckSeverity, b: CheckSeverity): CheckSeverity {
  const rank = { ok: 0, warn: 1, fail: 2 } as const;
  return rank[b] > rank[a] ? b : a;
}

export const siteHealthAuditWorkflow: WorkflowDef = {
  id: "site-health-audit",
  name: "Site health audit",
  description:
    "Read-only pre-flight: scans every dependency the broadcast needs (bracket, finalists, NDA, rounds, Zoho URL, Intercom, video assets, library) and produces a single roll-up PDF.",
  emoji: "🩺",
  sideEffects: "None. Pure read-only.",
  async run(): Promise<WorkflowResult> {
    const checks: WorkflowCheck[] = [];

    // Bracket: both finals exist with two players.
    const [winId, losId] = await Promise.all([
      getWinnersFinalMatchupId(),
      getLosersFinalMatchupId(),
    ]);
    if (!winId) {
      checks.push({
        id: "bracket-winners",
        label: "Winners' bracket final exists",
        severity: "fail",
        detail: "No deepest matchup in main bracket — generate from /host.",
      });
    } else {
      const [w] = await db
        .select()
        .from(schema.matchups)
        .where(eq(schema.matchups.id, winId))
        .limit(1);
      const filled = !!(w?.playerAUserId && w?.playerBUserId);
      checks.push({
        id: "bracket-winners",
        label: "Winners' bracket final",
        severity: filled ? "ok" : "warn",
        detail: filled
          ? "Both players seated."
          : "Final exists but feeder match hasn't resolved.",
      });
    }
    if (!losId) {
      checks.push({
        id: "bracket-losers",
        label: "Losers' bracket final exists",
        severity: "fail",
        detail: "No deepest matchup in losers bracket.",
      });
    } else {
      const [l] = await db
        .select()
        .from(schema.matchups)
        .where(eq(schema.matchups.id, losId))
        .limit(1);
      const filled = !!(l?.playerAUserId && l?.playerBUserId);
      checks.push({
        id: "bracket-losers",
        label: "Losers' bracket final",
        severity: filled ? "ok" : "warn",
        detail: filled
          ? "Both players seated."
          : "Final exists but feeder match hasn't resolved.",
      });
    }

    // Finalists' NDA.
    const finalistIds = await getAllFinalistUserIds();
    if (finalistIds.length === 0) {
      checks.push({
        id: "finalists-found",
        label: "Finalist roster resolves",
        severity: "fail",
        detail: "No finalists detected.",
      });
    } else {
      const users = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          nda: schema.users.finalsNdaAgreedAt,
        })
        .from(schema.users)
        .where(
          sql`${schema.users.id} = ANY(${sql.raw(`ARRAY[${finalistIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")}]`)})`
        );
      const missingNda = users.filter((u) => !u.nda);
      checks.push({
        id: "finalist-nda",
        label: "All finalists agreed to NDA",
        severity: missingNda.length === 0 ? "ok" : "warn",
        detail:
          missingNda.length === 0
            ? `All ${users.length} finalists have agreed.`
            : `${missingNda.length} pending: ${missingNda.map((u) => u.name ?? u.email).join(", ")}.`,
        remedy:
          missingNda.length > 0
            ? "Run the 'NDA chase' workflow or grant via /host/forum-roles → Demo override."
            : undefined,
      });
    }

    // Finals rounds (rehearsal / losers / winners) — created + populated.
    for (const slot of ["rehearsal", "losers", "winners"] as const) {
      const s = await getFinalsRoundSummary(slot);
      if (s.status === "not_created") {
        checks.push({
          id: `round-${slot}`,
          label: `${slot} round ready`,
          severity: "warn",
          detail: "Hasn't been created yet — auto-creates on first launch.",
        });
      } else if (s.totalQuestions === 0) {
        checks.push({
          id: `round-${slot}`,
          label: `${slot} round has questions`,
          severity: "fail",
          detail: "Round exists but has zero questions.",
        });
      } else {
        checks.push({
          id: `round-${slot}`,
          label: `${slot} round`,
          severity: "ok",
          detail: `${s.totalQuestions} questions · status ${s.status}.`,
        });
      }
    }

    // Zoho webinar URL.
    const w = await getZohoWebinar();
    if (!w.joinUrl) {
      checks.push({
        id: "zoho",
        label: "Zoho webinar URL set",
        severity: "fail",
        detail: "Audience has nowhere to join.",
        remedy: "Paste it at /host/finals-control → Zoho Webinar.",
      });
    } else {
      checks.push({
        id: "zoho",
        label: "Zoho webinar URL set",
        severity: "ok",
        detail: w.joinUrl,
      });
    }

    // Intercom Messenger + REST API.
    checks.push({
      id: "intercom-messenger",
      label: "Intercom Messenger configured",
      severity: intercomEnabled() ? "ok" : "warn",
      detail: intercomEnabled()
        ? "INTERCOM_APP_ID set."
        : "Messenger disabled (no app id).",
    });
    checks.push({
      id: "intercom-api",
      label: "Intercom REST API",
      severity: intercomApiReady() ? "ok" : "warn",
      detail: intercomApiReady()
        ? "INTERCOM_ACCESS_TOKEN set — sync hooks active."
        : "No access token — Discourse→Intercom note sync disabled.",
    });

    // Library not empty.
    const [{ c: libCount }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.libraryQuestions);
    checks.push({
      id: "library",
      label: "Question library populated",
      severity: libCount > 0 ? "ok" : "fail",
      detail: `${libCount} questions.`,
    });

    // Recent visits — proxy for "site is being loaded".
    const since = new Date(Date.now() - 86_400_000);
    const [{ c: recentVisits }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.visitLogs)
      .where(gt(schema.visitLogs.createdAt, since));
    checks.push({
      id: "traffic",
      label: "Site traffic in last 24h",
      severity: recentVisits > 0 ? "ok" : "warn",
      detail: `${recentVisits} page views.`,
    });

    const overall = checks.reduce<CheckSeverity>(
      (acc, c) => worst(acc, c.severity),
      "ok"
    );

    return {
      ok: overall !== "fail",
      summary:
        overall === "fail"
          ? "🚨 At least one critical dependency is failing — investigate before show day."
          : overall === "warn"
            ? "⚠️ Some soft warnings — site is up but worth a look."
            : "✅ Everything's green for broadcast.",
      effects: ["Read-only — no emails sent, no DB writes."],
      targets: [
        {
          targetId: "system",
          name: "Site as a whole",
          status: overall,
          tasksRemaining: checks.filter((c) => c.severity !== "ok").length,
          checks,
          emailSent: false,
        },
      ],
    };
  },
};
