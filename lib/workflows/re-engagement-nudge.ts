// Emails currently-active players who haven't logged a visit in
// 7+ days. One personalized "we miss you, here's what's happening"
// note per recipient. Only fires for players still alive in the
// bracket (eliminated readers don't get nudged this way).

import { db, schema } from "@/db";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { sendBatch } from "@/lib/email-provider";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

const SITE_URL = "https://quiz.miaswebsites.art";

export const reEngagementNudgeWorkflow: WorkflowDef = {
  id: "re-engagement-nudge",
  name: "Re-engagement nudge",
  description:
    "Find still-alive players who haven't visited the site in the last 7 days and send each a short 'come back, here's what you missed' email. Skips anyone who visited yesterday or already got this nudge in the last 5 days.",
  emoji: "👋",
  sideEffects:
    "Sends one email per lapsed active player. Safe to re-run — built-in 5-day cooldown via the emailSends history.",
  async run(): Promise<WorkflowResult> {
    const t = (await getActiveTournament()) ?? (await getLatestTournament());
    if (!t) {
      return {
        ok: false,
        summary: "No tournament found.",
        targets: [],
        effects: [],
      };
    }

    const cutoff7d = new Date(Date.now() - 7 * 86_400_000);
    const cutoff5d = new Date(Date.now() - 5 * 86_400_000);

    // Active players: enrolled + not eliminated.
    const players = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
      })
      .from(schema.enrollments)
      .innerJoin(schema.users, eq(schema.users.id, schema.enrollments.userId))
      .where(
        and(
          eq(schema.enrollments.tournamentId, t.id),
          isNull(schema.enrollments.eliminatedAt)
        )
      );

    const targets: WorkflowTargetResult[] = [];
    const messages: {
      to: string;
      subject: string;
      html: string;
      text: string;
      userId: string;
    }[] = [];

    for (const p of players) {
      if (!p.email) continue;
      // Last visit?
      const [last] = await db
        .select({ at: schema.visitLogs.createdAt })
        .from(schema.visitLogs)
        .where(eq(schema.visitLogs.userId, p.id))
        .orderBy(desc(schema.visitLogs.createdAt))
        .limit(1);
      const lapsed = !last || last.at < cutoff7d;
      // Recent re-engagement email already sent?
      const [coolRow] = await db
        .select({ at: schema.emailSends.sentAt })
        .from(schema.emailSends)
        .where(
          and(
            eq(schema.emailSends.recipientUserId, p.id),
            eq(schema.emailSends.templateId, "wf-re-engagement"),
            gt(schema.emailSends.sentAt, cutoff5d)
          )
        )
        .orderBy(desc(schema.emailSends.sentAt))
        .limit(1);
      const onCooldown = !!coolRow;
      const status: "ok" | "warn" | "fail" = !lapsed
        ? "ok"
        : onCooldown
          ? "warn"
          : "warn";
      const checks = [
        {
          id: "lapsed",
          label: "Last visit",
          severity: !last
            ? ("warn" as const)
            : last.at < cutoff7d
              ? ("warn" as const)
              : ("ok" as const),
          detail: last
            ? `Last visit ${last.at.toISOString().slice(0, 10)}.`
            : "No visits ever logged.",
        },
        {
          id: "cooldown",
          label: "Re-engagement email cooldown",
          severity: onCooldown ? ("ok" as const) : ("warn" as const),
          detail: onCooldown
            ? `Already nudged ${coolRow.at.toISOString().slice(0, 10)}.`
            : "No nudge in the last 5 days — will send.",
        },
      ];
      let willSend = false;
      if (lapsed && !onCooldown) {
        willSend = true;
        const firstName =
          (p.name ?? "").trim().split(" ")[0] || "there";
        const subject = `${firstName}, we miss you at Mia's Quiz Tournament`;
        const text = `Hi ${firstName},

You're still in the tournament! Pop back when you can — there's a round queued and we'd hate for you to forfeit by silent treatment.

Open ${SITE_URL} and sign in. The next chapter is ready when you are.

— Sam & Mia`;
        const html = `<!doctype html><html><body style="margin:0;padding:0;background:#1B2A4E;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:32px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 #FFD93D;">
<tr><td style="padding:28px 30px;">
<p style="margin:0;font-weight:700;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#C9296A;">A friendly nudge</p>
<h1 style="margin:8px 0 0;font-weight:700;font-size:24px;line-height:1.2;color:#1B2A4E;">Hey ${escape_(firstName)}, we miss you 🌞</h1>
<p style="margin:14px 0 0;font-size:16px;line-height:1.6;">You're still alive in the tournament — but we haven't seen you on the site in a week. The next chapter is queued; pop back in and grab it.</p>
<div style="margin:20px 0;text-align:center;">
  <a href="${SITE_URL}" style="display:inline-block;background:#E94B7E;color:#FFFFFF;border:4px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 #1B2A4E;padding:14px 32px;font-weight:700;font-size:16px;text-decoration:none;">→ Open the site</a>
</div>
<p style="margin:14px 0 0;font-size:13px;color:#3B4A7E;">— Sam &amp; Mia</p>
</td></tr></table></td></tr></table></body></html>`;
        messages.push({
          to: p.email,
          subject,
          html,
          text,
          userId: p.id,
        });
      }
      targets.push({
        targetId: p.id,
        name: p.name ?? p.email,
        contact: p.email,
        status,
        tasksRemaining: willSend ? 1 : 0,
        checks,
        emailSent: false,
        notes: willSend ? ["Will receive a nudge this run."] : [],
      });
    }

    let sentCount = 0;
    if (messages.length > 0) {
      const res = await sendBatch(
        messages.map((m) => ({
          from: "Sam from Mia's Quiz <appdev7710@gmail.com>",
          to: m.to,
          subject: m.subject,
          html: m.html,
          text: m.text,
          templateId: "wf-re-engagement",
        }))
      );
      sentCount = res.sent;
      // Mark first N targets as emailed (assumes sendBatch processes in
      // order, which it does).
      let i = 0;
      for (const t of targets) {
        if (t.tasksRemaining > 0 && i < sentCount) {
          t.emailSent = true;
          i++;
        }
      }
    }

    return {
      ok: true,
      summary: `👋 Nudged ${sentCount} lapsed player${sentCount === 1 ? "" : "s"} out of ${players.length} active.`,
      targets,
      effects: [`Sent ${sentCount} re-engagement email${sentCount === 1 ? "" : "s"}.`],
    };
  },
};

function escape_(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
