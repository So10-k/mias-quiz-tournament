// Run AFTER the broadcast, the moment Sam sets tournament.winnerUserId
// from /host. Does the full crown-the-champion chain:
//   • Flips the site banner to "🏆 CHAMPION: NAME · Season 1"
//   • Emails every registrant (anyone who's visited /finals*) with the
//     champion name + a thank-you
//   • Posts a forum announcement to discuss.miaswebsites.art (if the
//     Discourse API is wired)
//   • Drops an Intercom note on the champion's contact (sentiment +
//     ops record)

import { db, schema } from "@/db";
import { eq, ilike, inArray } from "drizzle-orm";
import { sendBatch } from "@/lib/email-provider";
import { setSiteBanner } from "@/lib/site-banner";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import { createTopic as createForumTopic } from "@/lib/discourse-api";
import {
  findContactByExternalId,
  postContactNote,
  tagContact,
  intercomApiReady,
} from "@/lib/intercom-api";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

const SITE = "https://quiz.miaswebsites.art";

export const championCeremonyWorkflow: WorkflowDef = {
  id: "champion-ceremony",
  name: "Crown the champion",
  description:
    "After Sam sets tournament.winnerUserId from /host, this workflow does the full ceremony chain: site banner flip, post-broadcast email to every /finals visitor, forum announcement post, Intercom note + 'champion' tag on the winner's contact.",
  emoji: "👑",
  sideEffects:
    "Flips the site-wide banner, sends an email to every /finals visitor (with cooldown), posts to the forum, tags Intercom contact. Re-runnable — banner is idempotent + emails are templateId-deduped.",
  async run(): Promise<WorkflowResult> {
    const t = (await getActiveTournament()) ?? (await getLatestTournament());
    if (!t || !t.winnerUserId) {
      return {
        ok: false,
        summary:
          "Tournament has no winnerUserId yet — set it from /host before running this.",
        targets: [],
        effects: [],
      };
    }
    const [champion] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, t.winnerUserId))
      .limit(1);
    if (!champion) {
      return {
        ok: false,
        summary: "winnerUserId points to a missing user.",
        targets: [],
        effects: [],
      };
    }
    const championName = champion.name ?? champion.email ?? "the champion";

    // 1. Site banner flip.
    await setSiteBanner({
      visible: true,
      style: "celebrate",
      text: `🏆 SEASON 1 CHAMPION: ${championName.toUpperCase()}`,
      href: "/finals/recap",
    });

    // 2. Forum announcement (best-effort).
    let forumPosted = false;
    let forumUrl: string | null = null;
    try {
      const res = await createForumTopic({
        title: `🏆 Season 1 Champion: ${championName}`,
        raw: `Tournament complete. **${championName}** is the first Mia's Quiz Tournament champion.

Full recap + replay at [${SITE}/finals/recap](${SITE}/finals/recap).

Thanks to everyone who played, predicted, watched, and posted hot takes all season. Aftershow notes in this category later this week.

— Sam & Mia`,
        categorySlug: "announcements",
        externalId: `season-${t.id}-champion`,
      });
      if (res.ok) {
        forumPosted = true;
        forumUrl = res.url;
      }
    } catch {
      /* non-fatal */
    }

    // 3. Email to every /finals visitor.
    const finalsVisitorRows = await db
      .selectDistinct({ userId: schema.visitLogs.userId })
      .from(schema.visitLogs)
      .where(ilike(schema.visitLogs.path, "/finals%"));
    const visitorIds = finalsVisitorRows
      .map((r) => r.userId)
      .filter((x): x is string => !!x);
    const visitors =
      visitorIds.length > 0
        ? await db
            .select({
              id: schema.users.id,
              name: schema.users.name,
              email: schema.users.email,
            })
            .from(schema.users)
            .where(inArray(schema.users.id, visitorIds))
        : [];

    const messages: {
      to: string;
      subject: string;
      html: string;
      text: string;
      userId: string;
    }[] = [];
    const targets: WorkflowTargetResult[] = [];

    for (const v of visitors) {
      if (!v.email) continue;
      const firstName = (v.name ?? "").trim().split(" ")[0] || "there";
      const subject = `🏆 Mia's Quiz Tournament — Season 1 Champion: ${championName}`;
      const text = `Hi ${firstName},

Thanks for being part of Season 1 of Mia's Quiz Tournament. The champion is ${championName}.

Full recap, final standings, and the replay live at ${SITE}/finals/recap.

— Sam & Mia`;
      const html = `<!doctype html><html><body style="margin:0;padding:0;background:#1B2A4E;font-family:Quicksand,system-ui,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:32px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 #FFD93D;">
<tr><td align="center" style="padding:32px 30px;color:#1B2A4E;">
<div style="font-size:72px;line-height:1;">👑</div>
<p style="margin:14px 0 0;font-weight:700;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#C9296A;">Season 1 — The Grand Final</p>
<h1 style="margin:8px 0 0;font-weight:700;font-size:32px;line-height:1.15;">${esc(championName)} is your champion.</h1>
<p style="margin:14px 0 0;font-size:16px;line-height:1.6;text-align:left;">Hi ${esc(firstName)} — thank you for being part of Season 1.</p>
<p style="margin:10px 0 0;font-size:16px;line-height:1.6;text-align:left;">Full recap, final standings, parody-ad reel, and the replay are live now:</p>
<div style="margin:22px 0;">
  <a href="${SITE}/finals/recap" style="display:inline-block;background:#E94B7E;color:#FFFFFF;border:4px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 #1B2A4E;padding:14px 32px;font-weight:700;font-size:16px;text-decoration:none;">→ Season 1 recap</a>
</div>
<p style="margin:18px 0 0;font-size:13px;color:#3B4A7E;">— Sam &amp; Mia</p>
</td></tr></table></td></tr></table></body></html>`;
      messages.push({ to: v.email, subject, html, text, userId: v.id });
      targets.push({
        targetId: v.id,
        name: v.name ?? v.email,
        contact: v.email,
        status: "ok",
        tasksRemaining: 0,
        checks: [
          {
            id: "champion-email",
            label: "Will receive champion announcement email",
            severity: "ok",
            detail: "Sent during this run.",
          },
        ],
        emailSent: false,
      });
    }

    let emailsSent = 0;
    if (messages.length > 0) {
      const r = await sendBatch(
        messages.map((m) => ({
          from: "Sam from Mia's Quiz <appdev7710@gmail.com>",
          to: m.to,
          subject: m.subject,
          html: m.html,
          text: m.text,
          templateId: `wf-champion-${t.id}`,
        }))
      );
      emailsSent = r.sent;
      let i = 0;
      for (const t of targets) {
        if (i < emailsSent) {
          t.emailSent = true;
          i++;
        }
      }
    }

    // 4. Intercom tag + note on the champion.
    let intercomTagged = false;
    if (intercomApiReady()) {
      try {
        const contact = await findContactByExternalId(champion.id);
        if (contact) {
          await postContactNote({
            contactId: contact.id,
            body: `🏆 Champion of Season 1 (tournament ${t.id}). Crowned at ${new Date().toISOString()}.`,
          });
          await tagContact({
            contactId: contact.id,
            tagName: "season-1-champion",
          });
          intercomTagged = true;
        }
      } catch {
        /* non-fatal */
      }
    }

    return {
      ok: true,
      summary: `👑 ${championName} crowned · banner flipped, ${emailsSent} email${emailsSent === 1 ? "" : "s"} sent${forumPosted ? ", forum post live" : ""}${intercomTagged ? ", Intercom tag added" : ""}.`,
      targets,
      effects: [
        `Site banner flipped to celebrate style.`,
        forumPosted
          ? `Forum announcement posted: ${forumUrl ?? ""}`
          : `Forum announcement skipped (Discourse API not configured or post failed).`,
        intercomTagged
          ? `Intercom contact tagged 'season-1-champion'.`
          : `Intercom tag skipped (API not configured).`,
        `${emailsSent} champion-announcement email${emailsSent === 1 ? "" : "s"} sent.`,
      ],
    };
  },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
