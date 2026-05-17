// Finds users with 7+ consecutive days of QOTD answers and emails
// them a recognition note.

import { db, schema } from "@/db";
import { sql } from "drizzle-orm";
import { sendBatch } from "@/lib/email-provider";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

const SITE = "https://quiz.miaswebsites.art";

export const qotdStreakRewardsWorkflow: WorkflowDef = {
  id: "qotd-streak-rewards",
  name: "QOTD streak rewards",
  description:
    "Finds users on a 7+ day Question-of-the-Day answering streak and emails each one a recognition note. Cooldown: only fires per-user once per running streak (templateId-deduped).",
  emoji: "🔥",
  sideEffects: "Sends one recognition email per qualifying streak.",
  async run(): Promise<WorkflowResult> {
    // Postgres: a "streak" = consecutive distinct forDate values up
    // through yesterday or today, no gaps. We compute it by joining
    // qotd_responses with qotd_questions then walking by date.
    const rows = (await db.execute(sql<{
      user_id: string;
      streak: number;
      last_date: string;
    }>`
      with q as (
        select r.user_id, q.for_date::date as d
        from qotd_responses r
        join qotd_questions q on q.id = r.question_id
        where r.user_id is not null
      ),
      grouped as (
        select user_id, d,
               (d - (row_number() over (partition by user_id order by d))::int) as streak_key
        from q
      ),
      runs as (
        select user_id, min(d) as start_d, max(d) as end_d, count(*)::int as len
        from grouped
        group by user_id, streak_key
      ),
      latest as (
        select user_id, max(end_d) as end_d
        from runs
        group by user_id
      )
      select runs.user_id::text as user_id, runs.len as streak, runs.end_d::text as last_date
      from runs
      join latest on latest.user_id = runs.user_id and latest.end_d = runs.end_d
      where runs.end_d >= current_date - interval '1 day'
        and runs.len >= 7
      order by runs.len desc
    `)) as unknown as Array<{ user_id: string; streak: number; last_date: string }>;

    if (rows.length === 0) {
      return {
        ok: true,
        summary: "🔥 No active 7+ day QOTD streaks today.",
        targets: [],
        effects: [],
      };
    }

    const userIds = rows.map((r) => r.user_id);
    const users = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(
        sql`${schema.users.id} = ANY(${sql.raw(`ARRAY[${userIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")}]`)})`
      );

    const byUser = new Map(rows.map((r) => [r.user_id, r]));
    const messages: {
      to: string;
      subject: string;
      html: string;
      text: string;
      userId: string;
    }[] = [];
    const targets: WorkflowTargetResult[] = [];
    for (const u of users) {
      const info = byUser.get(u.id);
      if (!info || !u.email) continue;
      const firstName = (u.name ?? "").trim().split(" ")[0] || "there";
      const subject = `🔥 ${info.streak}-day QOTD streak — nice work, ${firstName}`;
      const text = `Hi ${firstName},

You're on a ${info.streak}-day Question of the Day streak. That's hardcore. Keep it alive at ${SITE}/qotd.

— Sam`;
      const html = `<!doctype html><html><body style="margin:0;padding:0;background:#1B2A4E;font-family:Quicksand,system-ui,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:32px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 #FFD93D;">
<tr><td style="padding:28px 30px;color:#1B2A4E;text-align:center;">
<div style="font-size:64px;line-height:1;">🔥</div>
<h1 style="margin:14px 0 0;font-weight:700;font-size:24px;">${info.streak}-day streak.</h1>
<p style="margin:14px 0 0;font-size:16px;line-height:1.6;text-align:left;">Hi ${esc(firstName)}, you've answered the Question of the Day for ${info.streak} days in a row. Keep it alive — every streak counts.</p>
<div style="margin:22px 0;">
  <a href="${SITE}/qotd" style="display:inline-block;background:#E94B7E;color:#FFFFFF;border:4px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 #1B2A4E;padding:14px 32px;font-weight:700;font-size:16px;text-decoration:none;">→ Today's question</a>
</div>
<p style="margin:18px 0 0;font-size:13px;color:#3B4A7E;">— Sam &amp; Mia</p>
</td></tr></table></td></tr></table></body></html>`;
      messages.push({ to: u.email, subject, html, text, userId: u.id });
      targets.push({
        targetId: u.id,
        name: u.name ?? u.email,
        contact: u.email,
        status: "ok",
        tasksRemaining: 1,
        checks: [
          {
            id: "streak",
            label: "Active streak",
            severity: "ok",
            detail: `${info.streak} days · last answered ${info.last_date.slice(0, 10)}.`,
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
          templateId: `wf-qotd-streak-${rows.find((x) => x.user_id === m.userId)?.streak ?? 0}`,
        }))
      );
      sent = r.sent;
      let i = 0;
      for (const t of targets) {
        if (i < sent) {
          t.emailSent = true;
          i++;
        }
      }
    }

    return {
      ok: true,
      summary: `🔥 ${rows.length} active 7+ day streak${rows.length === 1 ? "" : "s"} · sent ${sent} recognition email${sent === 1 ? "" : "s"}.`,
      targets,
      effects: [`Emails sent: ${sent}.`],
    };
  },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
