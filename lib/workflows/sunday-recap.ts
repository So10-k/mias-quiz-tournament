// Sunday-evening recap email — same digest shape as the newsletter
// workflow, but with a different cadence (every 7 days) and a
// "what's happening this week" preview rather than a generic feed.

import { db, schema } from "@/db";
import { and, asc, desc, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { sendBatch } from "@/lib/email-provider";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

const SITE = "https://quiz.miaswebsites.art";

export const sundayRecapWorkflow: WorkflowDef = {
  id: "sunday-recap",
  name: "Sunday recap email",
  description:
    "Weekly Sunday-evening recap email: 'this week in Mia's Quiz' + the upcoming round opener time. Sent to all confirmed subscribers (any cadence) with a 6-day per-recipient cooldown.",
  emoji: "🌅",
  sideEffects:
    "One email per qualifying subscriber. 6-day cooldown so re-running is safe.",
  async run(): Promise<WorkflowResult> {
    const articles = await db
      .select({
        slug: schema.articles.slug,
        title: schema.articles.title,
        dek: schema.articles.dek,
      })
      .from(schema.articles)
      .where(eq(schema.articles.status, "published"))
      .orderBy(desc(schema.articles.publishedAt))
      .limit(3);

    // Next round opening in the future.
    const [nextRound] = await db
      .select({
        chapter: schema.rounds.chapterNumber,
        title: schema.rounds.title,
        opensAt: schema.rounds.opensAt,
      })
      .from(schema.rounds)
      .where(
        and(
          gt(schema.rounds.opensAt, new Date()),
          eq(schema.rounds.isPractice, false)
        )
      )
      .orderBy(asc(schema.rounds.opensAt))
      .limit(1);

    const subs = await db
      .select({
        id: schema.newsletterSubscriptions.id,
        email: schema.newsletterSubscriptions.email,
        userId: schema.newsletterSubscriptions.userId,
        lastSentAt: schema.newsletterSubscriptions.lastSentAt,
      })
      .from(schema.newsletterSubscriptions)
      .where(
        and(
          isNotNull(schema.newsletterSubscriptions.confirmedAt),
          isNull(schema.newsletterSubscriptions.unsubscribedAt)
        )
      );

    const cool = new Date(Date.now() - 6 * 86_400_000);
    const messages: {
      to: string;
      subject: string;
      html: string;
      text: string;
      userId: string;
    }[] = [];
    const targets: WorkflowTargetResult[] = [];

    for (const s of subs) {
      const onCool = !!s.lastSentAt && s.lastSentAt > cool;
      if (!onCool) {
        const text = recapText(articles, nextRound ?? null);
        const html = recapHtml(articles, nextRound ?? null);
        messages.push({
          to: s.email,
          subject: "🌅 Sunday at Mia's Quiz",
          html,
          text,
          userId: s.userId ?? "",
        });
      }
      targets.push({
        targetId: s.id,
        name: s.email,
        contact: s.email,
        status: onCool ? "ok" : "warn",
        tasksRemaining: onCool ? 0 : 1,
        checks: [
          {
            id: "cooldown",
            label: "Sunday cooldown",
            severity: onCool ? "ok" : "warn",
            detail: onCool
              ? `Last sent ${s.lastSentAt?.toISOString().slice(0, 10)}.`
              : "Eligible — will send.",
          },
        ],
        emailSent: false,
      });
    }

    let sent = 0;
    if (messages.length > 0) {
      const r = await sendBatch(
        messages.map((m) => ({
          from: "Mia's Quiz <appdev7710@gmail.com>",
          to: m.to,
          subject: m.subject,
          html: m.html,
          text: m.text,
          templateId: "wf-sunday-recap",
        }))
      );
      sent = r.sent;
      const sentEmails = messages.slice(0, sent).map((m) => m.to);
      for (const email of sentEmails) {
        await db
          .update(schema.newsletterSubscriptions)
          .set({ lastSentAt: new Date() })
          .where(eq(schema.newsletterSubscriptions.email, email));
      }
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
      summary: `🌅 Sunday recap sent to ${sent} of ${subs.length} subscribers.`,
      targets,
      effects: [
        `${articles.length} articles featured.`,
        nextRound
          ? `Next round (Chapter ${nextRound.chapter}) opens ${nextRound.opensAt?.toISOString().slice(0, 10)}.`
          : "No upcoming rounds in the schedule.",
      ],
    };
  },
};

function recapText(
  articles: Array<{ slug: string; title: string; dek?: string | null }>,
  nextRound: { chapter: number; title: string; opensAt: Date | null } | null
): string {
  return (
    `Sunday at Mia's Quiz\n\n` +
    (nextRound
      ? `📅 Next round: Chapter ${nextRound.chapter} — "${nextRound.title}" opens ${nextRound.opensAt?.toISOString().slice(0, 10) ?? "soon"}.\n\n`
      : "") +
    `Recent reads:\n` +
    articles
      .map((a) => `• ${a.title}\n  ${SITE}/blog/${a.slug}`)
      .join("\n\n") +
    `\n\nUnsubscribe: ${SITE}/blog/subscribe`
  );
}

function recapHtml(
  articles: Array<{ slug: string; title: string; dek?: string | null }>,
  nextRound: { chapter: number; title: string; opensAt: Date | null } | null
): string {
  const cards = articles
    .map(
      (a) =>
        `<tr><td style="padding:10px 0;"><a href="${SITE}/blog/${esc(a.slug)}" style="text-decoration:none;color:#1B2A4E;">
        <div style="padding:12px 14px;background:#FFFAE0;border:3px solid #1B2A4E;border-radius:14px;">
          <p style="margin:0;font-weight:700;font-size:17px;line-height:1.25;">${esc(a.title)}</p>
          ${a.dek ? `<p style="margin:6px 0 0;font-size:13px;color:#3B4A7E;line-height:1.5;">${esc(a.dek)}</p>` : ""}
        </div></a></td></tr>`
    )
    .join("");
  const nrBlock = nextRound
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;"><tr><td style="padding:14px 16px;background:#FFD93D;border:3px solid #1B2A4E;border-radius:14px;text-align:center;">
        <p style="margin:0;font-weight:700;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#C9296A;">📅 Next round</p>
        <p style="margin:6px 0 0;font-weight:700;font-size:18px;color:#1B2A4E;">Chapter ${nextRound.chapter} — ${esc(nextRound.title)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#3B4A7E;">Opens ${nextRound.opensAt?.toISOString().slice(0, 10) ?? "soon"}.</p>
      </td></tr></table>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#1B2A4E;font-family:Quicksand,system-ui,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:32px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 #FFD93D;">
<tr><td style="padding:28px 30px;color:#1B2A4E;">
<p style="margin:0;font-weight:700;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#C9296A;">Sunday recap</p>
<h1 style="margin:8px 0 0;font-weight:700;font-size:26px;line-height:1.2;">This week at Mia's Quiz.</h1>
${nrBlock}
<table cellpadding="0" cellspacing="0" border="0" width="100%">${cards}</table>
<p style="margin:14px 0 0;font-size:11px;color:#3B4A7E;">— Sam &amp; Mia · <a href="${SITE}/blog/subscribe" style="color:#3B4A7E;">unsubscribe</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
