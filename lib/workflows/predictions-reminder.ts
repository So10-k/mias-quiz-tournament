// Find users who've made at least one prediction this season but
// haven't predicted on the still-open matchups, and email them a
// nudge. Built-in 48h cooldown.

import { db, schema } from "@/db";
import { and, eq, gt, isNull, sql, inArray } from "drizzle-orm";
import { sendBatch } from "@/lib/email-provider";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

const SITE_URL = "https://quiz.miaswebsites.art";

export const predictionsReminderWorkflow: WorkflowDef = {
  id: "predictions-reminder",
  name: "Predictions reminder",
  description:
    "Find users who've engaged with the prediction game but haven't picked every still-open matchup yet, and email them a nudge with the count remaining. 48-hour cooldown per recipient.",
  emoji: "🔮",
  sideEffects: "Sends one email per qualifying user.",
  async run(): Promise<WorkflowResult> {
    const t = (await getActiveTournament()) ?? (await getLatestTournament());
    if (!t)
      return { ok: false, summary: "No tournament.", targets: [], effects: [] };
    // Open matchups = no winner yet.
    const open = await db
      .select({ id: schema.matchups.id })
      .from(schema.matchups)
      .where(
        and(
          eq(schema.matchups.tournamentId, t.id),
          isNull(schema.matchups.winnerUserId)
        )
      );
    const openIds = open.map((m) => m.id);
    if (openIds.length === 0) {
      return {
        ok: true,
        summary: "No open matchups — nothing to remind about.",
        targets: [],
        effects: [],
      };
    }

    // Users with any predictions.
    const predictors = await db
      .selectDistinct({ userId: schema.predictions.userId })
      .from(schema.predictions);
    const ids = predictors.map((p) => p.userId);
    if (ids.length === 0) {
      return {
        ok: true,
        summary: "No one has predicted yet.",
        targets: [],
        effects: [],
      };
    }
    const users = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(inArray(schema.users.id, ids));

    // For each predictor, count how many of the open matchups they
    // haven't picked yet.
    const cooldown = new Date(Date.now() - 48 * 3_600_000);
    const messages: {
      to: string;
      subject: string;
      html: string;
      text: string;
      userId: string;
    }[] = [];
    const targets: WorkflowTargetResult[] = [];

    for (const u of users) {
      if (!u.email) continue;
      const picked = await db
        .select({ matchupId: schema.predictions.matchupId })
        .from(schema.predictions)
        .where(
          and(
            eq(schema.predictions.userId, u.id),
            inArray(schema.predictions.matchupId, openIds)
          )
        );
      const pickedIds = new Set(picked.map((p) => p.matchupId));
      const missing = openIds.length - pickedIds.size;
      const [cool] = await db
        .select({ at: schema.emailSends.sentAt })
        .from(schema.emailSends)
        .where(
          and(
            eq(schema.emailSends.recipientUserId, u.id),
            eq(schema.emailSends.templateId, "wf-predictions-reminder"),
            gt(schema.emailSends.sentAt, cooldown)
          )
        )
        .limit(1);
      const onCooldown = !!cool;
      const willSend = missing > 0 && !onCooldown;
      const checks = [
        {
          id: "missing",
          label: "Open matchups not predicted",
          severity:
            missing === 0
              ? ("ok" as const)
              : missing >= openIds.length / 2
                ? ("fail" as const)
                : ("warn" as const),
          detail: `${missing} of ${openIds.length} open matchups un-picked.`,
        },
        {
          id: "cooldown",
          label: "Reminder cooldown",
          severity: onCooldown ? ("ok" as const) : ("warn" as const),
          detail: onCooldown ? "Already nudged in last 48h." : "No recent nudge.",
        },
      ];
      if (willSend) {
        const firstName = (u.name ?? "").trim().split(" ")[0] || "there";
        const subject = `🔮 ${missing} prediction${missing === 1 ? "" : "s"} left to lock in, ${firstName}`;
        const text = `Hi ${firstName},\n\nYou've still got ${missing} open matchup${missing === 1 ? "" : "s"} you haven't predicted. Locking your picks before each round closes scores you the most points.\n\n→ ${SITE_URL}/predictions\n\n— Sam`;
        const html = `<!doctype html><html><body style="margin:0;padding:0;background:#1B2A4E;font-family:Quicksand,system-ui,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:32px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 #FFD93D;">
<tr><td style="padding:28px 30px;color:#1B2A4E;">
<p style="margin:0;font-weight:700;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#C9296A;">Prediction game</p>
<h1 style="margin:8px 0 0;font-weight:700;font-size:24px;line-height:1.2;">Hey ${esc(firstName)}, ${missing} pick${missing === 1 ? "" : "s"} left.</h1>
<p style="margin:14px 0 0;font-size:16px;line-height:1.6;">You're an active predictor — but ${missing} matchup${missing === 1 ? " is" : "s are"} still un-picked. Lock them in before each round closes.</p>
<div style="margin:20px 0;text-align:center;">
  <a href="${SITE_URL}/predictions" style="display:inline-block;background:#E94B7E;color:#FFFFFF;border:4px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 #1B2A4E;padding:14px 32px;font-weight:700;font-size:16px;text-decoration:none;">→ Open /predictions</a>
</div>
<p style="margin:18px 0 0;font-size:13px;color:#3B4A7E;">— Sam</p>
</td></tr></table></td></tr></table></body></html>`;
        messages.push({
          to: u.email,
          subject,
          html,
          text,
          userId: u.id,
        });
      }
      targets.push({
        targetId: u.id,
        name: u.name ?? u.email,
        contact: u.email,
        status: missing === 0 ? "ok" : willSend ? "warn" : "ok",
        tasksRemaining: missing,
        checks,
        emailSent: false,
      });
    }

    let sent = 0;
    if (messages.length > 0) {
      const r = await sendBatch(
        messages.map((m) => ({
          from: "Sam from Mia's Quiz <appdev7710@gmail.com>",
          to: m.to,
          subject: m.subject,
          html: m.html,
          text: m.text,
          templateId: "wf-predictions-reminder",
        }))
      );
      sent = r.sent;
      let i = 0;
      for (const t of targets) {
        if (t.tasksRemaining > 0 && t.status === "warn" && i < sent) {
          t.emailSent = true;
          i++;
        }
      }
    }
    return {
      ok: true,
      summary: `🔮 ${sent} prediction reminder${sent === 1 ? "" : "s"} sent · ${openIds.length} open matchup${openIds.length === 1 ? "" : "s"}.`,
      targets,
      effects: [`Open matchups: ${openIds.length}. Emails sent: ${sent}.`],
    };
  },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
