// "Confirm finalist readiness" workflow.
//
// For each of the four finalists, audit the path-to-broadcast checklist:
//   1. Account exists + has a real email
//   2. Discourse NDA agreed (= users.finals_nda_agreed_at set)
//   3. Has signed into the quiz site recently (visit_logs in last 14d)
//   4. Has touched /finals (= visited the registration page)
//   5. Has touched /live at least once (= camera/mic test happened)
//
// Then email each finalist a personalized to-do list that only
// includes the steps they still owe. Also bundle a per-finalist
// detail set into the run's result_json — the host downloads it as a
// PDF report from /host/workflows/runs/[id]/pdf.

import { db, schema } from "@/db";
import { and, desc, eq, gt, inArray, ilike } from "drizzle-orm";
import { getAllFinalistUserIds } from "@/lib/finals-access";
import { sendBatch } from "@/lib/email-provider";
import type {
  WorkflowCheck,
  WorkflowDef,
  WorkflowResult,
  WorkflowTargetResult,
  CheckSeverity,
} from "./types";

const SITE_URL = "https://quiz.miaswebsites.art";
const FORUM_URL = "https://discuss.miaswebsites.art";

function worst(a: CheckSeverity, b: CheckSeverity): CheckSeverity {
  const rank: Record<CheckSeverity, number> = { ok: 0, warn: 1, fail: 2 };
  return rank[b] > rank[a] ? b : a;
}

async function buildChecksForUser(args: {
  user: typeof schema.users.$inferSelect;
}): Promise<WorkflowCheck[]> {
  const { user } = args;
  const checks: WorkflowCheck[] = [];
  const since14d = new Date(Date.now() - 14 * 86_400_000);

  // 1. Real email.
  if (!user.email || /@example\.com|noreply/i.test(user.email)) {
    checks.push({
      id: "email-valid",
      label: "Reachable email on file",
      severity: "fail",
      detail: `users.email = ${user.email ?? "(none)"} — can't deliver mail.`,
      remedy: "Tell Sam your real email — he can update it from /host.",
    });
  } else {
    checks.push({
      id: "email-valid",
      label: "Reachable email on file",
      severity: "ok",
      detail: user.email,
    });
  }

  // 2. Discourse NDA agreed (= we have finals_nda_agreed_at).
  if (user.finalsNdaAgreedAt) {
    checks.push({
      id: "nda-agreed",
      label: "Confidentiality NDA agreed",
      severity: "ok",
      detail: `Agreed ${user.finalsNdaAgreedAt.toISOString().slice(0, 10)}.`,
    });
  } else {
    checks.push({
      id: "nda-agreed",
      label: "Confidentiality NDA agreed",
      severity: "fail",
      detail: "No agreement on file — Finals Room access is blocked.",
      remedy: `Sign in to ${FORUM_URL}. The forum will DM you a 🔒 PM titled "Finals access — confidentiality required". Open it and reply "yes I agree".`,
    });
  }

  // 3. Has signed into the quiz site in the last 14 days. We use
  //    visit_logs (any page visit while signed in) as the proxy.
  const [recentVisit] = await db
    .select({ at: schema.visitLogs.createdAt })
    .from(schema.visitLogs)
    .where(
      and(
        eq(schema.visitLogs.userId, user.id),
        gt(schema.visitLogs.createdAt, since14d)
      )
    )
    .orderBy(desc(schema.visitLogs.createdAt))
    .limit(1);
  if (recentVisit) {
    checks.push({
      id: "signed-in-recently",
      label: "Signed in to the quiz site recently",
      severity: "ok",
      detail: `Last visit ${recentVisit.at.toISOString().slice(0, 10)}.`,
    });
  } else {
    checks.push({
      id: "signed-in-recently",
      label: "Signed in to the quiz site recently",
      severity: "warn",
      detail: "No quiz-site visits in the last 14 days.",
      remedy: `Visit ${SITE_URL} and sign in — that re-syncs your Discourse + Intercom contact data and warms the cache for show day.`,
    });
  }

  // 4. Has visited /finals at least once. Proxy for "knows the
  //    registration page exists" — not a registration confirmation
  //    (Zoho doesn't expose that to us).
  const [finalsVisit] = await db
    .select({ at: schema.visitLogs.createdAt })
    .from(schema.visitLogs)
    .where(
      and(
        eq(schema.visitLogs.userId, user.id),
        ilike(schema.visitLogs.path, "/finals%")
      )
    )
    .orderBy(desc(schema.visitLogs.createdAt))
    .limit(1);
  if (finalsVisit) {
    checks.push({
      id: "finals-visited",
      label: "Visited /finals (registration page)",
      severity: "ok",
      detail: `Last visit ${finalsVisit.at.toISOString().slice(0, 10)}.`,
    });
  } else {
    checks.push({
      id: "finals-visited",
      label: "Visited /finals (registration page)",
      severity: "warn",
      detail: "Hasn't opened the registration page yet.",
      remedy: `Open ${SITE_URL}/finals — scroll to "Reserve your seat" and complete the Zoho form. You'll get a join link by email.`,
    });
  }

  // 5. Has visited /live (proxy for "tested camera + mic flow").
  const [liveVisit] = await db
    .select({ at: schema.visitLogs.createdAt })
    .from(schema.visitLogs)
    .where(
      and(
        eq(schema.visitLogs.userId, user.id),
        eq(schema.visitLogs.path, "/live")
      )
    )
    .orderBy(desc(schema.visitLogs.createdAt))
    .limit(1);
  if (liveVisit) {
    checks.push({
      id: "live-tested",
      label: "Tested /live (camera + mic flow)",
      severity: "ok",
      detail: `Last visit ${liveVisit.at.toISOString().slice(0, 10)}.`,
    });
  } else {
    checks.push({
      id: "live-tested",
      label: "Tested /live (camera + mic flow)",
      severity: "warn",
      detail: "Hasn't opened the broadcast room.",
      remedy: `Sign in and visit ${SITE_URL}/live before show day. Click the Zoho join button and confirm camera + mic work in your browser — that's where 90% of "I can't hear anyone" problems get caught.`,
    });
  }

  return checks;
}

function emailFor(args: {
  user: typeof schema.users.$inferSelect;
  checks: WorkflowCheck[];
}): { subject: string; html: string; text: string } | null {
  // Only outstanding items get listed.
  const remaining = args.checks.filter((c) => c.severity !== "ok");
  if (remaining.length === 0) return null;
  const firstName = (args.user.name ?? "").trim().split(" ")[0] || "there";
  const subject =
    remaining.some((c) => c.severity === "fail")
      ? `⚠️ Action needed before Saturday's finals, ${firstName}`
      : `One small thing before Saturday's finals, ${firstName}`;
  const itemsHtml = remaining
    .map(
      (c, i) => `
        <div style="margin:14px 0;padding:14px 16px;background:${
          c.severity === "fail" ? "#FFE8EE" : "#FFFAE0"
        };border:3px solid #1B2A4E;border-radius:14px;">
          <p style="margin:0;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${
            c.severity === "fail" ? "#C9296A" : "#3B4A7E"
          };">
            ${i + 1}. ${escapeHtml(c.label)}
          </p>
          ${
            c.remedy
              ? `<p style="margin:8px 0 0;font-size:15px;line-height:1.55;color:#1B2A4E;">${escapeHtml(
                  c.remedy
                )}</p>`
              : ""
          }
        </div>`
    )
    .join("");
  const itemsText = remaining
    .map((c, i) => `${i + 1}. ${c.label}\n   ${c.remedy ?? c.detail}`)
    .join("\n\n");
  const html = `<!doctype html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#1B2A4E;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 #FFD93D;">
      <tr><td style="padding:28px 30px 8px;">
        <p style="margin:0;font-weight:700;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#C9296A;">Mia's Quiz Tournament · The Grand Final</p>
        <h1 style="margin:8px 0 0;font-weight:700;font-size:26px;line-height:1.2;color:#1B2A4E;">Hi ${escapeHtml(firstName)} — quick checklist before Saturday.</h1>
        <p style="margin:14px 0 0;font-size:16px;line-height:1.6;">
          Saturday's Grand Final goes live <strong>May 16 at 12:00 PM Eastern</strong>. Per our automated pre-flight check, you still owe ${remaining.length} step${remaining.length === 1 ? "" : "s"}. We'd love to clear them this week.
        </p>
      </td></tr>
      <tr><td style="padding:6px 30px 8px;">
        ${itemsHtml}
      </td></tr>
      <tr><td style="padding:6px 30px 8px;">
        <p style="margin:14px 0 0;font-size:14px;line-height:1.55;color:#3B4A7E;">
          Stuck on any step? Reply to this email or open the chat bubble in the corner of <a href="${SITE_URL}" style="color:#C9296A;">${escapeHtml(SITE_URL)}</a> — we're around.
        </p>
      </td></tr>
      <tr><td style="padding:8px 30px 28px;">
        <hr style="border:none;border-top:2px dashed #B7E5FF;margin:18px 0"/>
        <p style="margin:0;font-size:13px;color:#3B4A7E;">— Sam &amp; Mia</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  const text = `Hi ${firstName},

Saturday's Grand Final goes live May 16 at 12:00 PM Eastern. Per our automated pre-flight check, you still have ${remaining.length} step${remaining.length === 1 ? "" : "s"} to take care of:

${itemsText}

Stuck on any of these? Reply to this email or use the chat bubble at ${SITE_URL}.

— Sam & Mia`;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const finalsReadinessWorkflow: WorkflowDef = {
  id: "finals-readiness",
  name: "Confirm finalist readiness",
  description:
    "Audit each of the four finalists against the pre-broadcast checklist (NDA, /finals visited, /live tested, recent sign-in). Email each one a personalized to-do list of only the items they still owe, and generate a PDF report for the host.",
  emoji: "🏁",
  sideEffects:
    "Sends up to 4 emails — one per finalist who still has outstanding items. Finalists with everything green get no email. Always safe to re-run.",

  async run(): Promise<WorkflowResult> {
    const finalistIds = await getAllFinalistUserIds();
    if (finalistIds.length === 0) {
      return {
        ok: false,
        summary: "No finalists detected — generate the bracket first.",
        targets: [],
        effects: [],
      };
    }
    const users = await db
      .select()
      .from(schema.users)
      .where(inArray(schema.users.id, finalistIds));

    const targets: WorkflowTargetResult[] = [];
    const emailsToSend: {
      to: string;
      subject: string;
      html: string;
      text: string;
      userId: string;
    }[] = [];

    for (const user of users) {
      const checks = await buildChecksForUser({ user });
      const status = checks.reduce<CheckSeverity>(
        (acc, c) => worst(acc, c.severity),
        "ok"
      );
      const tasksRemaining = checks.filter((c) => c.severity !== "ok").length;
      const email = emailFor({ user, checks });
      if (email && user.email) {
        emailsToSend.push({
          to: user.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
          userId: user.id,
        });
      }
      targets.push({
        targetId: user.id,
        name: user.name ?? user.email ?? "(no name)",
        contact: user.email ?? undefined,
        status,
        tasksRemaining,
        checks,
        emailSent: false, // patched below after sendBatch
        notes: [],
      });
    }

    // Sort: still-failing first, then warnings, then green-clean.
    targets.sort((a, b) => {
      const rank: Record<CheckSeverity, number> = {
        fail: 0,
        warn: 1,
        ok: 2,
      };
      return rank[a.status] - rank[b.status];
    });

    const effects: string[] = [];
    if (emailsToSend.length > 0) {
      const sendRes = await sendBatch(
        emailsToSend.map((m) => ({
          from: "Sam from Mia's Quiz <appdev7710@gmail.com>",
          to: m.to,
          subject: m.subject,
          html: m.html,
          text: m.text,
          templateId: "wf-finals-readiness",
        }))
      );
      const sentTo = new Set(emailsToSend.slice(0, sendRes.sent).map((m) => m.userId));
      for (const t of targets) if (sentTo.has(t.targetId)) t.emailSent = true;
      effects.push(
        `${sendRes.sent} of ${emailsToSend.length} email${
          emailsToSend.length === 1 ? "" : "s"
        } sent via ${sendRes.provider}.`
      );
      if (sendRes.errors.length) {
        effects.push(
          `Errors: ${sendRes.errors.slice(0, 3).join("; ")}${
            sendRes.errors.length > 3 ? "…" : ""
          }`
        );
      }
    } else {
      effects.push("No emails sent — every finalist's checklist is green.");
    }

    const totals = targets.reduce(
      (acc, t) => {
        if (t.status === "ok") acc.ok++;
        else if (t.status === "warn") acc.warn++;
        else acc.fail++;
        return acc;
      },
      { ok: 0, warn: 0, fail: 0 }
    );
    const summary =
      totals.fail > 0
        ? `🚨 ${totals.fail} finalist(s) blocked, ${totals.warn} with warnings, ${totals.ok} ready.`
        : totals.warn > 0
          ? `⚠️ ${totals.warn} finalist(s) have soft warnings, ${totals.ok} fully ready.`
          : `✅ All ${totals.ok} finalists ready for the broadcast.`;

    return {
      ok: totals.fail === 0,
      summary,
      targets,
      effects,
    };
  },
};
