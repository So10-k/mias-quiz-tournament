// One-time appreciation email to every player who got eliminated
// this season. Run after the bracket has fully resolved.

import { db, schema } from "@/db";
import { and, eq, isNotNull, gt, inArray } from "drizzle-orm";
import { sendBatch } from "@/lib/email-provider";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

const SITE = "https://quiz.miaswebsites.art";

export const eliminatedThankYouWorkflow: WorkflowDef = {
  id: "eliminated-thank-you",
  name: "Eliminated player thank-you",
  description:
    "Sends a personalized thank-you to every player who got eliminated this season — with the round they bowed out in. Built-in cooldown so we never double-thank.",
  emoji: "💛",
  sideEffects: "Sends one email per eliminated player who hasn't received one this season.",
  async run(): Promise<WorkflowResult> {
    const t =
      (await getActiveTournament()) ?? (await getLatestTournament());
    if (!t) {
      return {
        ok: false,
        summary: "No tournament.",
        targets: [],
        effects: [],
      };
    }
    const players = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        roundId: schema.enrollments.eliminatedInRoundId,
        eliminatedAt: schema.enrollments.eliminatedAt,
      })
      .from(schema.enrollments)
      .innerJoin(schema.users, eq(schema.users.id, schema.enrollments.userId))
      .where(
        and(
          eq(schema.enrollments.tournamentId, t.id),
          isNotNull(schema.enrollments.eliminatedAt)
        )
      );
    // Look up the chapter numbers for the elimination rounds.
    const roundIds = players
      .map((p) => p.roundId)
      .filter((x): x is string => !!x);
    const rounds = roundIds.length
      ? await db
          .select({
            id: schema.rounds.id,
            chapter: schema.rounds.chapterNumber,
            title: schema.rounds.title,
          })
          .from(schema.rounds)
          .where(inArray(schema.rounds.id, roundIds))
      : [];
    const roundById = new Map(rounds.map((r) => [r.id, r]));

    const cool = new Date(Date.now() - 60 * 86_400_000); // once per season-ish
    const messages: {
      to: string;
      subject: string;
      html: string;
      text: string;
      userId: string;
    }[] = [];
    const targets: WorkflowTargetResult[] = [];

    for (const p of players) {
      if (!p.email) continue;
      const r = p.roundId ? roundById.get(p.roundId) : null;
      const [cooldown] = await db
        .select({ at: schema.emailSends.sentAt })
        .from(schema.emailSends)
        .where(
          and(
            eq(schema.emailSends.recipientUserId, p.id),
            eq(schema.emailSends.templateId, `wf-eliminated-${t.id}`),
            gt(schema.emailSends.sentAt, cool)
          )
        )
        .limit(1);
      const onCool = !!cooldown;
      const willSend = !onCool;
      if (willSend) {
        const firstName = (p.name ?? "").trim().split(" ")[0] || "there";
        const subject = `Thanks for playing this season, ${firstName}`;
        const text = `Hi ${firstName},

You made it to ${r ? `chapter ${r.chapter} ("${r.title}")` : "the bracket"} and we're glad you played. Season 2 sign-ups land at ${SITE} — we'd love to see you back.

— Sam & Mia`;
        const html = `<!doctype html><html><body style="margin:0;padding:0;background:#1B2A4E;font-family:Quicksand,system-ui,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:32px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 #FFD93D;">
<tr><td style="padding:28px 30px;color:#1B2A4E;">
<p style="margin:0;font-weight:700;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#C9296A;">Thanks for playing</p>
<h1 style="margin:8px 0 0;font-weight:700;font-size:24px;line-height:1.2;">Season 1 wouldn't have been a season without you.</h1>
<p style="margin:14px 0 0;font-size:16px;line-height:1.6;">Hi ${esc(firstName)} — you made it to ${r ? `<strong>chapter ${r.chapter}</strong> ("${esc(r.title)}")` : "the bracket"}. We hope it was fun.</p>
<p style="margin:10px 0 0;font-size:16px;line-height:1.6;">Season 2 sign-ups land at the homepage when we're ready. We'd love to have you back.</p>
<div style="margin:22px 0;text-align:center;">
  <a href="${SITE}" style="display:inline-block;background:#E94B7E;color:#FFFFFF;border:4px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 #1B2A4E;padding:14px 32px;font-weight:700;font-size:16px;text-decoration:none;">→ Stay tuned</a>
</div>
<p style="margin:18px 0 0;font-size:13px;color:#3B4A7E;">— Sam &amp; Mia</p>
</td></tr></table></td></tr></table></body></html>`;
        messages.push({ to: p.email, subject, html, text, userId: p.id });
      }
      targets.push({
        targetId: p.id,
        name: p.name ?? p.email,
        contact: p.email,
        status: "ok",
        tasksRemaining: willSend ? 1 : 0,
        checks: [
          {
            id: "eliminated",
            label: "Eliminated round",
            severity: "ok",
            detail: r ? `Chapter ${r.chapter}: ${r.title}` : "Unknown round.",
          },
          {
            id: "cooldown",
            label: "Thank-you cooldown",
            severity: onCool ? "ok" : "warn",
            detail: onCool ? "Already thanked this season." : "Eligible.",
          },
        ],
        emailSent: false,
      });
    }

    let sent = 0;
    if (messages.length > 0) {
      const r = await sendBatch(
        messages.map((m) => ({
          from: "Sam & Mia <appdev7710@gmail.com>",
          to: m.to,
          subject: m.subject,
          html: m.html,
          text: m.text,
          templateId: `wf-eliminated-${t.id}`,
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
      summary: `💛 Thanked ${sent} eliminated player${sent === 1 ? "" : "s"}.`,
      targets,
      effects: [`Emails sent: ${sent}.`],
    };
  },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
