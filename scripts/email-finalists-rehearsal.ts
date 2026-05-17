// One-shot: send all four finalists a rehearsal-night invite. The
// rehearsal lets them practice the /live flow (Jitsi + embedded
// question UI) before the actual broadcast. Includes a .ics
// calendar attachment so it lands on their calendar with one
// click.
//
// Configure the time + URL by editing the constants below, then:
//   npx tsx scripts/email-finalists-rehearsal.ts

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

// ── EDIT ME — when's the rehearsal? ──────────────────────────────
// Default: Saturday May 16, 2026, 7:00–7:30 PM Eastern
const REHEARSAL_START_ET = "2026-05-16T19:00:00";
const REHEARSAL_END_ET = "2026-05-16T19:30:00";
const REHEARSAL_HUMAN = "Saturday, May 16 · 7:00 PM Eastern (30 min)";
const LIVE_URL = "https://quiz.miaswebsites.art/live?room=rehearsal";
const FORUM_URL = "https://discuss.miaswebsites.art";

const FINALISTS = [
  { name: "Karen", email: "kliss1958@gmail.com" },
  { name: "Marc", email: "otten77@yahoo.com" },
  { name: "Grandpa", email: "howieliss@gmail.com" },
  { name: "Sam", email: "happyshot1010@gmail.com" },
];

// Convert a local-Eastern wall-clock string to the UTC ISO string
// .ics files expect. Eastern Daylight Time = UTC-4 in May.
function toIcsUtc(localET: string): string {
  const d = new Date(`${localET}-04:00`);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildIcs(uid: string, name: string): string {
  const dtStart = toIcsUtc(REHEARSAL_START_ET);
  const dtEnd = toIcsUtc(REHEARSAL_END_ET);
  const dtStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mia's Quiz Tournament//Rehearsal Invite//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:🎙️ Mia's Quiz · Finals rehearsal`,
    `DESCRIPTION:Quick 30-min rehearsal of the finals tech setup. Sign in to ${LIVE_URL} a couple of minutes early — we'll do a mic check and walk through the on-screen question UI.`,
    `LOCATION:${LIVE_URL}`,
    `URL:${LIVE_URL}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Mia's Quiz rehearsal in 15 min",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function htmlBody(firstName: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#FFD93D;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFD93D;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 0 #1B2A4E;">
        <tr><td style="padding:30px 30px 8px;">
          <p style="margin:0;font-weight:700;font-size:22px;line-height:1;">🌞 Mia&rsquo;s Quiz Tournament</p>
          <p style="margin:6px 0 0;font-weight:600;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#C9296A;">Finalists · rehearsal night</p>
        </td></tr>
        <tr><td style="padding:14px 30px 28px;">
          <h1 style="margin:0 0 16px;font-weight:700;font-size:26px;line-height:1.2;">🎙️ Let&rsquo;s rehearse the tech</h1>
          <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Hi ${firstName},</p>
          <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Quick 30-minute rehearsal before the real broadcast. We'll get on camera, test the question UI, and make sure the experience works smoothly on whatever device you'll be using on show day.</p>

          <div style="margin:20px 0;padding:18px 20px;background:#FFFAE0;border:3px solid #1B2A4E;border-radius:14px;">
            <p style="margin:0 0 6px;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#3B4A7E;">📅 When</p>
            <p style="margin:0 0 14px;font-size:16px;font-weight:600;">${REHEARSAL_HUMAN}</p>
            <p style="margin:0 0 6px;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#3B4A7E;">💻 Where</p>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.55;">Sign in to the quiz site, then click the link below. It takes you straight into the rehearsal room.</p>
            <div style="text-align:center;">
              <a href="${LIVE_URL}" style="display:inline-block;background:#E94B7E;color:#FFFFFF;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E;padding:12px 28px;font-weight:700;font-size:16px;text-decoration:none;">Join the rehearsal</a>
            </div>
          </div>

          <p style="margin:18px 0 8px;font-weight:700;font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:#3B4A7E;">What we&rsquo;ll cover</p>
          <ul style="margin:0 0 14px 22px;padding:0;font-size:15px;line-height:1.6;">
            <li>Camera + mic check</li>
            <li>What the question UI looks like + how to answer</li>
            <li>The "host advances, you see the next question" rhythm</li>
            <li>What to do if your camera dies mid-show</li>
            <li>Any questions you have</li>
          </ul>

          <p style="margin:18px 0 14px;font-size:15px;line-height:1.6;"><strong>The .ics file attached</strong> drops the rehearsal on your calendar — open it and click "Add to calendar" so you don&rsquo;t forget.</p>

          <p style="margin:18px 0 0;font-size:14px;color:#3B4A7E;">If you can&rsquo;t make this slot, reply with a couple of times that work and we&rsquo;ll find one.</p>

          <hr style="border:none;border-top:2px dashed #B7E5FF;margin:24px 0"/>
          <p style="margin:0;font-size:13px;color:#3B4A7E;">— Sam</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function textBody(firstName: string): string {
  return `Hi ${firstName},

Quick 30-min rehearsal before the real broadcast. We'll get on camera, test the question UI, and make sure everything works on your device.

When: ${REHEARSAL_HUMAN}
Where: ${LIVE_URL}

What we'll cover:
- Camera + mic check
- What the question UI looks like
- The host-advances rhythm
- What to do if anything dies mid-show

The .ics attachment adds it to your calendar.

If this time doesn't work, reply with a few that do.

— Sam`;
}

async function main() {
  // Resend supports attachments via its SDK; Brevo via the
  // attachment API. Easiest path is to use sendOne and pass a
  // multipart message. Our existing sendBatch doesn't support
  // attachments, so we'll add the .ics inline as a file param via
  // the Resend SDK directly when needed. For now we keep the
  // .ics URL in the email body so recipients can also click a
  // download link if their client doesn't auto-process the
  // multipart attachment.
  //
  // For maximum compatibility, we send via sendBatch (which
  // already routes through the active provider) — and send an
  // additional ics-attachment-only email through Resend directly
  // if RESEND_API_KEY is set.

  const { sendBatch, getActiveProvider } = await import("@/lib/email-provider");
  console.log(`Active provider: ${await getActiveProvider()}`);

  const from =
    process.env.EMAIL_FROM ||
    "Mia's Quiz Tournament <noreply@miaswebsites.art>";

  // Try Resend SDK directly (it supports attachments). Fall back
  // to plain sendBatch.
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);
    let sent = 0;
    let errors = 0;
    for (const f of FINALISTS) {
      const ics = buildIcs(`rehearsal-${f.email}-${Date.now()}@miaswebsites.art`, f.name);
      const result = await resend.emails.send({
        from,
        to: f.email,
        subject: "🎙️ Finals rehearsal — please add to your calendar",
        html: htmlBody(f.name),
        text: textBody(f.name),
        attachments: [
          {
            filename: "finals-rehearsal.ics",
            content: Buffer.from(ics, "utf8").toString("base64"),
            contentType: "text/calendar",
          },
        ],
      });
      if (result.error) {
        errors++;
        console.log(`  ✗ ${f.email}: ${JSON.stringify(result.error)}`);
      } else {
        sent++;
        console.log(`  ✓ ${f.email} (${result.data?.id})`);
      }
    }
    console.log(`\nresend: sent=${sent} errors=${errors}`);
  } else {
    console.log("(no RESEND_API_KEY — falling back to sendBatch without attachment)");
    const messages = FINALISTS.map((f) => ({
      from,
      to: f.email,
      subject: "🎙️ Finals rehearsal — please add to your calendar",
      html: htmlBody(f.name),
      text: textBody(f.name),
      templateId: "finals-rehearsal-invite",
    }));
    const result = await sendBatch(messages);
    console.log(`sent=${result.sent} errors=${result.errors.length}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
