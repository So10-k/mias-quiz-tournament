// For each finalist who hasn't agreed to the NDA, ping them via
// BOTH email AND (when their Intercom contact exists) an admin note
// + an outbound Intercom message. The redundancy is intentional —
// the NDA gates Finals Room access and we can't have a finalist
// missing it on broadcast day.

import { db, schema } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { sendBatch } from "@/lib/email-provider";
import { getAllFinalistUserIds } from "@/lib/finals-access";
import {
  findContactByExternalId,
  postContactNote,
  tagContact,
  intercomApiReady,
  sendInAppMessage,
  getDefaultAdminId,
} from "@/lib/intercom-api";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

const FORUM = "https://discuss.miaswebsites.art";
const SITE = "https://quiz.miaswebsites.art";

export const ndaPendingChaseWorkflow: WorkflowDef = {
  id: "nda-pending-chase",
  name: "NDA pending chase",
  description:
    "Targets finalists who haven't agreed to the Discourse NDA. Sends each a tight email with step-by-step instructions AND (if Intercom is connected) drops them an in-app Intercom message + tags their contact 'nda-pending'.",
  emoji: "🔐",
  sideEffects:
    "Sends 1 email + 1 Intercom message + 1 Intercom tag per unsigned finalist.",
  async run(): Promise<WorkflowResult> {
    const ids = await getAllFinalistUserIds();
    if (ids.length === 0) {
      return {
        ok: false,
        summary: "No finalists found.",
        targets: [],
        effects: [],
      };
    }
    const users = await db
      .select()
      .from(schema.users)
      .where(inArray(schema.users.id, ids));

    const pending = users.filter((u) => !u.finalsNdaAgreedAt);
    if (pending.length === 0) {
      return {
        ok: true,
        summary: "✅ All finalists have agreed to the NDA.",
        targets: users.map((u) => ({
          targetId: u.id,
          name: u.name ?? u.email,
          contact: u.email,
          status: "ok",
          tasksRemaining: 0,
          checks: [
            {
              id: "nda",
              label: "NDA",
              severity: "ok",
              detail: `Agreed ${u.finalsNdaAgreedAt?.toISOString().slice(0, 10)}.`,
            },
          ],
          emailSent: false,
        })),
        effects: ["No-op — everyone's signed."],
      };
    }

    const adminId = intercomApiReady() ? await getDefaultAdminId() : null;
    const targets: WorkflowTargetResult[] = [];
    const messages: {
      to: string;
      subject: string;
      html: string;
      text: string;
      userId: string;
    }[] = [];

    for (const u of pending) {
      if (!u.email) continue;
      const firstName = (u.name ?? "").trim().split(" ")[0] || "there";
      const subject = `⚠️ Action needed before the broadcast, ${firstName}`;
      const text = `Hi ${firstName},

You're a finalist for Saturday's Grand Final, but the system says you haven't agreed to the confidentiality NDA yet. Without that we can't unlock Finals Room access for you.

Three steps, ~60 seconds:

1. Open ${FORUM} in your browser. Click "Sign in" at the top right — it bounces through ${SITE} and back.
2. The moment you land, the forum will DM you a 🔒 PM titled "Finals access — confidentiality required". Open it from the inbox icon (top right).
3. Reply to that PM with the literal words: yes I agree

That's it. You'll get a confirmation and Finals Room becomes visible.

Stuck? Hit reply and we'll fix it.

— Sam & Mia`;
      const html = `<!doctype html><html><body style="margin:0;padding:0;background:#1B2A4E;font-family:Quicksand,system-ui,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:32px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 #FFD93D;">
<tr><td style="padding:28px 30px;color:#1B2A4E;">
<p style="margin:0;font-weight:700;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#C9296A;">⚠️ Quick action needed</p>
<h1 style="margin:8px 0 0;font-weight:700;font-size:24px;line-height:1.2;">Hi ${esc(firstName)} — one missing step.</h1>
<p style="margin:14px 0 0;font-size:16px;line-height:1.6;">You're a finalist for Saturday, but the system says you haven't agreed to the confidentiality NDA. Three steps, sixty seconds:</p>
<ol style="margin:14px 0 0 22px;padding:0;font-size:15px;line-height:1.7;color:#1B2A4E;">
  <li>Open <a href="${FORUM}" style="color:#C9296A;">${FORUM}</a> and click <strong>Sign in</strong> (top right).</li>
  <li>The forum will DM you a 🔒 PM titled <strong>"Finals access — confidentiality required"</strong>. Open it.</li>
  <li>Reply to the PM with the words <strong>yes I agree</strong>.</li>
</ol>
<div style="margin:20px 0;text-align:center;">
  <a href="${FORUM}" style="display:inline-block;background:#E94B7E;color:#FFFFFF;border:4px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 #1B2A4E;padding:14px 32px;font-weight:700;font-size:16px;text-decoration:none;">→ Open the forum</a>
</div>
<p style="margin:14px 0 0;font-size:13px;color:#3B4A7E;">Stuck on any step? Just reply to this email.</p>
<p style="margin:18px 0 0;font-size:13px;color:#3B4A7E;">— Sam &amp; Mia</p>
</td></tr></table></td></tr></table></body></html>`;
      messages.push({
        to: u.email,
        subject,
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
            id: "nda",
            label: "NDA agreement",
            severity: "fail",
            detail: "Not on file — Finals Room access blocked.",
            remedy:
              "Sign into discuss.miaswebsites.art, open the PM titled '🔒 Finals access — confidentiality required', and reply 'yes I agree'.",
          },
        ],
        emailSent: false,
      });
    }

    // Send emails.
    let emailsSent = 0;
    if (messages.length > 0) {
      const r = await sendBatch(
        messages.map((m) => ({
          from: "Sam from Mia's Quiz <appdev7710@gmail.com>",
          to: m.to,
          subject: m.subject,
          html: m.html,
          text: m.text,
          templateId: "wf-nda-chase",
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

    // Intercom side-effects.
    let intercomNotes = 0;
    let intercomMessages = 0;
    if (intercomApiReady()) {
      for (const u of pending) {
        try {
          const contact = await findContactByExternalId(u.id);
          if (!contact) continue;
          await postContactNote({
            contactId: contact.id,
            body:
              `<b>NDA pending</b> — finalist hasn't agreed to confidentiality terms yet. ` +
              `<a href="${FORUM}">Forum sign-in flow</a> required.`,
          });
          intercomNotes++;
          await tagContact({ contactId: contact.id, tagName: "nda-pending" });
          if (adminId) {
            const r = await sendInAppMessage({
              contactId: contact.id,
              adminId,
              body:
                "Heads up — you're a finalist for Saturday but haven't agreed to the NDA yet. Sign in at discuss.miaswebsites.art and reply 'yes I agree' to the 🔒 PM. Reach out here if you're stuck.",
            });
            if (r.ok) intercomMessages++;
          }
        } catch {
          /* swallow per-target; one bad Intercom call shouldn't sink */
        }
      }
    }

    return {
      ok: emailsSent === messages.length,
      summary: `🔐 ${pending.length} finalist(s) pending NDA · ${emailsSent} email${emailsSent === 1 ? "" : "s"} + ${intercomMessages} Intercom DM${intercomMessages === 1 ? "" : "s"} sent.`,
      targets: [
        ...targets,
        ...users
          .filter((u) => u.finalsNdaAgreedAt)
          .map<WorkflowTargetResult>((u) => ({
            targetId: u.id,
            name: u.name ?? u.email,
            contact: u.email,
            status: "ok",
            tasksRemaining: 0,
            checks: [
              {
                id: "nda",
                label: "NDA agreement",
                severity: "ok",
                detail: `Agreed ${u.finalsNdaAgreedAt!.toISOString().slice(0, 10)}.`,
              },
            ],
            emailSent: false,
          })),
      ],
      effects: [
        `${emailsSent} email${emailsSent === 1 ? "" : "s"} sent.`,
        `${intercomNotes} Intercom note${intercomNotes === 1 ? "" : "s"} dropped, ${intercomMessages} in-app message${intercomMessages === 1 ? "" : "s"} sent.`,
      ],
    };
  },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
