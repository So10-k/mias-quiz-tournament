// One-shot: email the three other finalists about Sunday's Google
// Meet. Skips the user (Sam) since he's hosting it. Sends via the
// quiz site's existing email-provider abstraction (Brevo or
// Resend — whichever's active in app_settings).
//
// Run:
//   npx tsx scripts/email-finalists-meet.ts

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotenv() {
  for (const f of [".env.local", ".env.production.local"]) {
    const p = resolve(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      const k = t.slice(0, eq).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
loadDotenv();

const FINALISTS = [
  { name: "Sam", email: "happyshot1010@gmail.com", bracket: "winners" },
];

const MEET_LINK = "https://meet.google.com/vem-ubat-pzj";
const WHEN = "Sunday, May 10 · 10:00 AM Eastern Time (New York / DC time)";

function htmlFor(firstName: string, bracket: string): string {
  const opener =
    bracket === "winners"
      ? "Quick heads-up — I'm pulling all four finalists together tomorrow morning for a short call before the live finals. We'll walk through the format, the schedule, and answer any questions you have."
      : "Quick heads-up — I'm pulling all four finalists together tomorrow morning for a short call before the live finals. You earned your spot the hard way through the losers bracket — fitting that you're at the table.";
  return `<!doctype html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#B7E5FF;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#B7E5FF;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 0 #1B2A4E;">
        <tr><td style="padding:30px 30px 8px;">
          <p style="margin:0;font-weight:700;font-size:22px;line-height:1;">🌞 Mia&rsquo;s Quiz Tournament</p>
          <p style="margin:6px 0 0;font-weight:600;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#C9296A;">Finalists · pre-show call</p>
        </td></tr>
        <tr><td style="padding:14px 30px 28px;">
          <h1 style="margin:0 0 16px;font-weight:700;font-size:26px;line-height:1.2;">📅 Tomorrow at 10 AM — quick video call</h1>
          <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Hi ${firstName},</p>
          <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">${opener}</p>

          <div style="margin:20px 0;padding:18px 20px;background:#FFFAE0;border:3px solid #1B2A4E;border-radius:14px;">
            <p style="margin:0 0 6px;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#3B4A7E;">📅 When</p>
            <p style="margin:0 0 14px;font-size:16px;font-weight:600;">${WHEN}</p>
            <p style="margin:0 0 6px;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#3B4A7E;">💻 How to join</p>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.55;">Click this link in your web browser at 10am — it&rsquo;ll open Google Meet, no app to install:</p>
            <div style="text-align:center;">
              <a href="${MEET_LINK}" style="display:inline-block;background:#E94B7E;color:#FFFFFF;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E;padding:12px 28px;font-weight:700;font-size:16px;text-decoration:none;">Join Google Meet</a>
            </div>
            <p style="margin:14px 0 0;font-size:12px;color:#3B4A7E;text-align:center;">Or paste this in your browser: <span style="font-family:monospace;">${MEET_LINK}</span></p>
          </div>

          <p style="margin:18px 0 8px;font-weight:700;font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:#3B4A7E;">First time using Google Meet?</p>
          <ul style="margin:0 0 14px 22px;padding:0;font-size:15px;line-height:1.6;">
            <li>Click the link → Google Meet loads in your browser</li>
            <li>It&rsquo;ll ask "Allow camera and microphone?" — click <strong>Allow</strong></li>
            <li>If it asks you to sign in to Google, any Google account works (Gmail, etc.)</li>
            <li>Click <strong>Join now</strong> when you&rsquo;re ready</li>
            <li>If something doesn&rsquo;t work in Safari, try Chrome — that&rsquo;s the friendliest browser for it</li>
          </ul>

          <p style="margin:18px 0 14px;font-size:15px;line-height:1.6;">Bring a coffee, any questions you have, and we&rsquo;ll keep it short — no more than 15 minutes.</p>

          <p style="margin:18px 0 0;font-size:14px;color:#3B4A7E;">Can&rsquo;t make it? Reply and let me know — we&rsquo;ll catch up separately.</p>

          <hr style="border:none;border-top:2px dashed #B7E5FF;margin:24px 0"/>
          <p style="margin:0;font-size:13px;color:#3B4A7E;">— Sam</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function textFor(firstName: string, bracket: string): string {
  const opener =
    bracket === "winners"
      ? "Quick heads-up — I'm pulling all four finalists together tomorrow morning for a short call before the live finals."
      : "Quick heads-up — I'm pulling all four finalists together tomorrow morning for a short call before the live finals. You earned your spot the hard way through the losers bracket — fitting that you're at the table.";
  return `Hi ${firstName},

${opener}

When: ${WHEN}
How to join: ${MEET_LINK}

First time using Google Meet?
1. Click the link in your browser
2. Allow camera and microphone when it asks
3. Sign in to any Google account if it prompts you
4. Click "Join now"

If Safari doesn't work, try Chrome.

Bring coffee + any questions you have. We'll keep it under 15 minutes.

Can't make it? Reply and let me know.

— Sam`;
}

async function main() {
  // Dynamic import AFTER loadDotenv so the db module's top-level
  // DATABASE_URL check doesn't blow up.
  const { sendBatch, getActiveProvider } = await import("@/lib/email-provider");
  const provider = await getActiveProvider();
  console.log(`Active email provider: ${provider}`);

  const from =
    process.env.EMAIL_FROM ||
    "Mia's Quiz Tournament <noreply@miaswebsites.art>";

  const messages = FINALISTS.map((f) => ({
    from,
    to: f.email,
    subject: "📅 Tomorrow 10 AM ET — quick video call (all finalists)",
    html: htmlFor(f.name, f.bracket),
    text: textFor(f.name, f.bracket),
    templateId: "finalists-meet-pre-show",
  }));

  console.log(`Sending to ${messages.length} finalists:`);
  messages.forEach((m) => console.log(`  → ${m.to}`));

  const result = await sendBatch(messages);
  console.log(`\nResult: sent=${result.sent} errors=${result.errors.length} provider=${result.provider} dryRun=${!!result.dryRun}`);
  for (const e of result.errors) console.log(`  ✗ ${e}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
