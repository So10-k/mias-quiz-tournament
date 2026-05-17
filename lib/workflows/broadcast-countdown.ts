// Time-aware broadcast reminder. Computes days-until-show, picks an
// appropriate tone (T-7d "save the date" → T-3h "we go live in 3h"),
// and emails everyone who has visited /finals at least once (the
// closest proxy we have for "interested in attending"). Built-in
// cooldown so re-running the same day doesn't double-blast.

import { db, schema } from "@/db";
import { and, desc, eq, gt, ilike, inArray } from "drizzle-orm";
import { sendBatch } from "@/lib/email-provider";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

const SITE_URL = "https://quiz.miaswebsites.art";
const SHOW_ISO = "2026-05-16T16:00:00Z"; // Saturday May 16, 12 PM ET

function pickTone(hoursUntil: number): {
  bucket: "T-week" | "T-3d" | "T-1d" | "T-3h" | "missed";
  subject: string;
  intro: string;
} {
  if (hoursUntil < 0)
    return {
      bucket: "missed",
      subject: "",
      intro: "",
    };
  if (hoursUntil <= 4)
    return {
      bucket: "T-3h",
      subject: "🎙️ Going live in a few hours — Mia's Quiz Grand Final",
      intro:
        "We tip off in about an hour. If you're registered, Zoho will email you the join link any minute (check spam). If you're not — last chance.",
    };
  if (hoursUntil <= 36)
    return {
      bucket: "T-1d",
      subject: "🌞 Tomorrow — Mia's Quiz Grand Final",
      intro:
        "Less than 24 hours until the broadcast. Two bracket finals and a championship match, live. Bring snacks.",
    };
  if (hoursUntil <= 80)
    return {
      bucket: "T-3d",
      subject: "🎟️ 3 days out — Mia's Quiz Grand Final",
      intro:
        "Saturday is the Grand Final. If you haven't registered yet, here's the link — it's a 60-second form.",
    };
  return {
    bucket: "T-week",
    subject: "📅 Save the date — Mia's Quiz Grand Final, Sat May 16",
    intro:
      "Saturday May 16 at noon Eastern. Three matches, four finalists, picture-book set design, picture-book parody ads. You're going to want a seat.",
  };
}

export const broadcastCountdownWorkflow: WorkflowDef = {
  id: "broadcast-countdown",
  name: "Broadcast countdown email",
  description:
    "Sends a time-aware finals reminder to anyone who's visited /finals at least once. Tone auto-adjusts to T-week / T-3d / T-1d / T-3h based on how close the broadcast is. Built-in 36-hour cooldown.",
  emoji: "📅",
  sideEffects:
    "Sends one email per qualifying registrant. Safe to re-run — recipients who got this template within 36h are skipped.",
  async run(): Promise<WorkflowResult> {
    const now = Date.now();
    const showMs = new Date(SHOW_ISO).getTime();
    const hoursUntil = (showMs - now) / 3_600_000;
    const tone = pickTone(hoursUntil);
    if (tone.bucket === "missed") {
      return {
        ok: false,
        summary: "Show already happened — nothing to send.",
        targets: [],
        effects: [],
      };
    }

    // Candidates: anyone who has hit /finals or /finals/registered.
    const finalsVisitors = await db
      .selectDistinct({ userId: schema.visitLogs.userId })
      .from(schema.visitLogs)
      .where(
        and(
          ilike(schema.visitLogs.path, "/finals%"),
          // Have to have a userId — anonymous visitors get no email.
          // (null userId would be excluded by the inner join below.)
        )
      );
    const ids = finalsVisitors
      .map((r) => r.userId)
      .filter((x): x is string => !!x);
    if (ids.length === 0) {
      return {
        ok: true,
        summary: "No signed-in users have visited /finals yet.",
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

    const cooldown = new Date(now - 36 * 3_600_000);
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
      const [cool] = await db
        .select({ at: schema.emailSends.sentAt })
        .from(schema.emailSends)
        .where(
          and(
            eq(schema.emailSends.recipientUserId, u.id),
            eq(schema.emailSends.templateId, `wf-broadcast-${tone.bucket}`),
            gt(schema.emailSends.sentAt, cooldown)
          )
        )
        .orderBy(desc(schema.emailSends.sentAt))
        .limit(1);
      if (cool) {
        targets.push({
          targetId: u.id,
          name: u.name ?? u.email,
          contact: u.email,
          status: "ok",
          tasksRemaining: 0,
          checks: [
            {
              id: "cooldown",
              label: `${tone.bucket} cooldown`,
              severity: "ok",
              detail: `Already sent ${cool.at.toISOString().slice(0, 10)}.`,
            },
          ],
          emailSent: false,
        });
        continue;
      }
      const firstName = (u.name ?? "").trim().split(" ")[0] || "there";
      const text = `Hi ${firstName},\n\n${tone.intro}\n\n📅 Saturday, May 16 · 12:00 PM Eastern\n→ ${SITE_URL}/finals\n\n— Sam`;
      const html = `<!doctype html><html><body style="margin:0;padding:0;background:#1B2A4E;font-family:Quicksand,system-ui,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:32px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 #FFD93D;">
<tr><td style="padding:28px 30px;color:#1B2A4E;">
<p style="margin:0;font-weight:700;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#C9296A;">Mia's Quiz Grand Final</p>
<h1 style="margin:8px 0 0;font-weight:700;font-size:26px;line-height:1.2;">Hi ${escape_(firstName)} —</h1>
<p style="margin:14px 0 0;font-size:16px;line-height:1.6;">${escape_(tone.intro)}</p>
<div style="margin:20px 0;text-align:center;">
  <a href="${SITE_URL}/finals" style="display:inline-block;background:#E94B7E;color:#FFFFFF;border:4px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 #1B2A4E;padding:14px 32px;font-weight:700;font-size:16px;text-decoration:none;">→ Open /finals</a>
</div>
<p style="margin:6px 0 0;font-size:13px;color:#3B4A7E;text-align:center;">Saturday, May 16 · 12:00 PM Eastern</p>
<p style="margin:18px 0 0;font-size:13px;color:#3B4A7E;">— Sam</p>
</td></tr></table></td></tr></table></body></html>`;
      messages.push({
        to: u.email,
        subject: tone.subject,
        html,
        text,
        userId: u.id,
      });
      targets.push({
        targetId: u.id,
        name: u.name ?? u.email,
        contact: u.email,
        status: "warn",
        tasksRemaining: 1,
        checks: [
          {
            id: "cooldown",
            label: `${tone.bucket} cooldown`,
            severity: "warn",
            detail: "Not on cooldown — will send.",
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
          templateId: `wf-broadcast-${tone.bucket}`,
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
      summary: `📅 ${tone.bucket} bucket · sent ${sent} email${sent === 1 ? "" : "s"}.`,
      targets,
      effects: [`Tone bucket: ${tone.bucket} (T+${Math.round(hoursUntil)}h until show).`, `Sent ${sent} emails.`],
    };
  },
};

function escape_(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
