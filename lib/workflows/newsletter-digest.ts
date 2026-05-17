// Sends the newsletter digest to every confirmed-and-not-unsubscribed
// subscriber whose `frequency` setting matches the chosen cadence
// (default: weekly). Bundles the 5 most recent published articles +
// the upcoming round date.

import { db, schema } from "@/db";
import { and, desc, eq, gt, isNull, isNotNull } from "drizzle-orm";
import { sendBatch } from "@/lib/email-provider";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

const SITE = "https://quiz.miaswebsites.art";

export const newsletterDigestWorkflow: WorkflowDef = {
  id: "newsletter-digest",
  name: "Send newsletter digest",
  description:
    "Bundles the 5 most-recent published articles + upcoming round info and emails every confirmed weekly subscriber. Built-in 6-day cooldown so re-running the same week is a no-op.",
  emoji: "📰",
  sideEffects:
    "Sends one email per confirmed weekly subscriber who hasn't received this digest in the last 6 days.",
  async run(): Promise<WorkflowResult> {
    const articles = await db
      .select({
        slug: schema.articles.slug,
        title: schema.articles.title,
        dek: schema.articles.dek,
        coverImageUrl: schema.articles.coverImageUrl,
        publishedAt: schema.articles.publishedAt,
      })
      .from(schema.articles)
      .where(eq(schema.articles.status, "published"))
      .orderBy(desc(schema.articles.publishedAt))
      .limit(5);

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
          isNull(schema.newsletterSubscriptions.unsubscribedAt),
          eq(schema.newsletterSubscriptions.frequency, "weekly")
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
      const onCooldown = !!s.lastSentAt && s.lastSentAt > cool;
      if (!onCooldown) {
        const html = digestHtml(articles);
        const text = digestText(articles);
        messages.push({
          to: s.email,
          subject: "📰 Mia's Quiz · weekly digest",
          html,
          text,
          userId: s.userId ?? "",
        });
      }
      targets.push({
        targetId: s.id,
        name: s.email,
        contact: s.email,
        status: onCooldown ? "ok" : "warn",
        tasksRemaining: onCooldown ? 0 : 1,
        checks: [
          {
            id: "cooldown",
            label: "Weekly cooldown",
            severity: onCooldown ? "ok" : "warn",
            detail: onCooldown
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
          from: "Mia's Quiz Digest <appdev7710@gmail.com>",
          to: m.to,
          subject: m.subject,
          html: m.html,
          text: m.text,
          templateId: "wf-newsletter-digest",
        }))
      );
      sent = r.sent;
      // Stamp lastSentAt for the ones that got through.
      const sentEmails = messages.slice(0, sent).map((m) => m.to);
      if (sentEmails.length > 0) {
        for (const email of sentEmails) {
          await db
            .update(schema.newsletterSubscriptions)
            .set({ lastSentAt: new Date() })
            .where(eq(schema.newsletterSubscriptions.email, email));
        }
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
      summary: `📰 Digest sent to ${sent} of ${subs.length} weekly subscribers · ${articles.length} articles featured.`,
      targets,
      effects: [
        `${articles.length} articles bundled.`,
        `${sent} emails sent (others on cooldown).`,
      ],
    };
  },
};

function digestText(articles: Array<{ slug: string; title: string; dek?: string | null }>): string {
  if (articles.length === 0)
    return `Mia's Quiz weekly digest\n\nNo new posts this week — check back next week.\n\nUnsubscribe: ${SITE}/blog/subscribe`;
  return (
    `Mia's Quiz · weekly digest\n\n` +
    articles
      .map((a) => `• ${a.title}\n  ${SITE}/blog/${a.slug}\n  ${a.dek ?? ""}`)
      .join("\n\n") +
    `\n\nUnsubscribe: ${SITE}/blog/subscribe`
  );
}

function digestHtml(
  articles: Array<{
    slug: string;
    title: string;
    dek?: string | null;
    coverImageUrl?: string | null;
  }>
): string {
  const cards = articles
    .map(
      (a) => `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0;">
        <tr><td style="padding:14px 16px;background:#FFFAE0;border:3px solid #1B2A4E;border-radius:14px;">
          <a href="${SITE}/blog/${esc(a.slug)}" style="text-decoration:none;color:#1B2A4E;">
            <p style="margin:0;font-weight:700;font-size:18px;line-height:1.25;">${esc(a.title)}</p>
            ${a.dek ? `<p style="margin:6px 0 0;font-size:14px;color:#3B4A7E;line-height:1.5;">${esc(a.dek)}</p>` : ""}
            <p style="margin:8px 0 0;font-size:12px;color:#C9296A;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">Read →</p>
          </a>
        </td></tr>
      </table>`
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#1B2A4E;font-family:Quicksand,system-ui,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:32px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 #FFD93D;">
<tr><td style="padding:28px 30px;color:#1B2A4E;">
<p style="margin:0;font-weight:700;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#C9296A;">Mia's Quiz · weekly digest</p>
<h1 style="margin:8px 0 0;font-weight:700;font-size:26px;line-height:1.2;">Five new things to read.</h1>
${cards}
<p style="margin:14px 0 0;font-size:11px;color:#3B4A7E;">— Sam &amp; Mia · <a href="${SITE}/blog/subscribe" style="color:#3B4A7E;">unsubscribe</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
