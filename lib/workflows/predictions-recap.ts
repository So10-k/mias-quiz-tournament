// For every user who has made predictions, compute their score
// (correct ÷ made) + email each one a personalized "how you did"
// recap. Built-in 14-day cooldown per recipient.

import { db, schema } from "@/db";
import { and, eq, gt, sql, inArray } from "drizzle-orm";
import { sendBatch } from "@/lib/email-provider";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

const SITE = "https://quiz.miaswebsites.art";

export const predictionsRecapWorkflow: WorkflowDef = {
  id: "predictions-recap",
  name: "Predictions recap",
  description:
    "For everyone who's predicted at least one matchup, computes their accuracy across resolved matchups + emails them a personalized 'you scored X' recap. 14-day cooldown.",
  emoji: "🎯",
  sideEffects: "Sends one email per qualifying predictor.",
  async run(): Promise<WorkflowResult> {
    const rows = (await db.execute(sql<{
      user_id: string;
      made: number;
      correct: number;
    }>`
      select p.user_id::text,
             count(*)::int as made,
             count(*) filter (where p.predicted_winner_user_id = m.winner_user_id)::int as correct
      from predictions p
      join matchups m on m.id = p.matchup_id
      where m.winner_user_id is not null
      group by p.user_id
    `)) as unknown as Array<{ user_id: string; made: number; correct: number }>;

    if (rows.length === 0) {
      return {
        ok: true,
        summary: "No resolved predictions to recap.",
        targets: [],
        effects: [],
      };
    }
    const ids = rows.map((r) => r.user_id);
    const users = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(inArray(schema.users.id, ids));
    const byId = new Map(rows.map((r) => [r.user_id, r]));
    const cool = new Date(Date.now() - 14 * 86_400_000);

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
      const r = byId.get(u.id);
      if (!r) continue;
      const [cooldown] = await db
        .select({ at: schema.emailSends.sentAt })
        .from(schema.emailSends)
        .where(
          and(
            eq(schema.emailSends.recipientUserId, u.id),
            eq(schema.emailSends.templateId, "wf-predictions-recap"),
            gt(schema.emailSends.sentAt, cool)
          )
        )
        .limit(1);
      const onCooldown = !!cooldown;
      const accuracy = r.made > 0 ? Math.round((r.correct / r.made) * 100) : 0;
      const willSend = !onCooldown;
      if (willSend) {
        const firstName = (u.name ?? "").trim().split(" ")[0] || "there";
        const subject = `🎯 Your prediction accuracy: ${accuracy}%`;
        const text = `Hi ${firstName},

You've called ${r.correct} of ${r.made} resolved matchups so far — ${accuracy}% accuracy.

Pop into ${SITE}/predictions when you want to keep climbing.

— Sam`;
        const html = `<!doctype html><html><body style="margin:0;padding:0;background:#1B2A4E;font-family:Quicksand,system-ui,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:32px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 #FFD93D;">
<tr><td style="padding:28px 30px;color:#1B2A4E;text-align:center;">
<div style="font-size:54px;line-height:1;">🎯</div>
<h1 style="margin:14px 0 0;font-weight:700;font-size:30px;">${accuracy}% accuracy</h1>
<p style="margin:8px 0 0;font-size:14px;color:#3B4A7E;">${r.correct} of ${r.made} resolved matchups called.</p>
<p style="margin:14px 0 0;font-size:16px;line-height:1.6;text-align:left;">Hi ${esc(firstName)}, here's where you stand in the bracket-prophet race.</p>
<div style="margin:22px 0;">
  <a href="${SITE}/predictions" style="display:inline-block;background:#E94B7E;color:#FFFFFF;border:4px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 #1B2A4E;padding:14px 32px;font-weight:700;font-size:16px;text-decoration:none;">→ Keep predicting</a>
</div>
<p style="margin:18px 0 0;font-size:13px;color:#3B4A7E;">— Sam</p>
</td></tr></table></td></tr></table></body></html>`;
        messages.push({ to: u.email, subject, html, text, userId: u.id });
      }
      targets.push({
        targetId: u.id,
        name: u.name ?? u.email,
        contact: u.email,
        status: "ok",
        tasksRemaining: willSend ? 1 : 0,
        checks: [
          {
            id: "accuracy",
            label: "Lifetime accuracy",
            severity: "ok",
            detail: `${r.correct} of ${r.made} = ${accuracy}%.`,
          },
          {
            id: "cooldown",
            label: "Recap cooldown",
            severity: onCooldown ? "ok" : "warn",
            detail: onCooldown ? "Already recapped in last 14d." : "Eligible.",
          },
        ],
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
          templateId: "wf-predictions-recap",
        }))
      );
      sent = r.sent;
      let i = 0;
      for (const t of targets) {
        if (t.tasksRemaining > 0 && i < sent) {
          t.emailSent = true;
          i++;
        }
      }
    }
    return {
      ok: true,
      summary: `🎯 Recap'd ${rows.length} predictor${rows.length === 1 ? "" : "s"} · sent ${sent} email${sent === 1 ? "" : "s"}.`,
      targets,
      effects: [`Emails sent: ${sent}.`],
    };
  },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
