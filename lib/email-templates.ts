// Special HTML email templates for the announcement editor.
// Plain-text mode is still the default; templates are an opt-in upgrade for
// when a send needs to look like the picture-book stationery in the design
// system rather than the basic sky-card wrapper.

export type TemplateFieldDef = {
  key: string;
  label: string;
  kind: "text" | "textarea";
  defaultValue: string;
  hint?: string;
  rows?: number;
  maxLength?: number;
};

export type RenderedTemplate = {
  subject: string;
  html: string;
  text: string;
};

export type EmailTemplate = {
  id: string;
  name: string;
  description: string;
  defaultSubject: string;
  fields: TemplateFieldDef[];
  render(args: {
    subject: string;
    fields: Record<string, string>;
  }): RenderedTemplate;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── merge variables ────────────────────────────────────────────────────
// Available in every field of every template AND in plain-text mode. They
// substitute per-recipient at send time, so the host can write one email
// like "Hey {firstName}!" and each person gets their own name.

export const MERGE_VARS = [
  {
    token: "{name}",
    label: "Player's full display name (or email handle if no name set)",
    sample: "Marc Liss",
  },
  {
    token: "{firstName}",
    label: "First word of the display name",
    sample: "Marc",
  },
  {
    token: "{email}",
    label: "Their email address",
    sample: "marc@example.com",
  },
] as const;

export type MergeRecipient = {
  name?: string | null;
  email?: string | null;
};

export type MergeValues = { name: string; firstName: string; email: string };

export function recipientMergeValues(r: MergeRecipient): MergeValues {
  const email = (r.email ?? "").trim();
  const display =
    (r.name ?? "").trim() ||
    (email ? email.split("@")[0] : "") ||
    "there";
  const firstName = display.split(/\s+/)[0] || display;
  return { name: display, firstName, email };
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Substitute merge variables. `isHtml=true` HTML-escapes the substituted
// values so a name like "Pete <pete@x>" can't break the layout.
export function applyMergeVars(
  s: string,
  vars: MergeValues,
  isHtml = false
): string {
  if (!s) return s;
  const map: Record<string, string> = {
    "{name}": isHtml ? escHtml(vars.name) : vars.name,
    "{firstName}": isHtml ? escHtml(vars.firstName) : vars.firstName,
    "{email}": isHtml ? escHtml(vars.email) : vars.email,
  };
  return s.replace(/\{(name|firstName|email)\}/g, (m) => map[m] ?? m);
}

function getField(
  template: EmailTemplate,
  fields: Record<string, string>,
  key: string
): string {
  const raw = fields[key];
  if (raw && raw.trim()) return raw.trim();
  const def = template.fields.find((f) => f.key === key);
  return def?.defaultValue ?? "";
}

const SCHEDULE_SHIFT_PUBLIC: EmailTemplate = {
  id: "schedule-shift-public",
  name: "Schedule shift · public re-send",
  description:
    "Sunny stationery version of the schedule-change note. Apologises for the previous plain-text send and re-delivers the live time and deadline.",
  defaultSubject: "Updated schedule for this week's round",
  fields: [
    {
      key: "liveTime",
      label: "Round goes live",
      kind: "text",
      defaultValue: "Tonight · 8:30 PM",
      hint: "Shows in the schedule card.",
      maxLength: 60,
    },
    {
      key: "deadline",
      label: "Deadline to finish",
      kind: "text",
      defaultValue: "Thursday · 9:00 PM",
      hint: "Shows in the schedule card.",
      maxLength: 60,
    },
    {
      key: "apology",
      label: "Opening apology",
      kind: "textarea",
      defaultValue:
        "First — quick apology. The schedule-change email I sent earlier read a bit sloppier than I meant it to. Same info, less rushed: here's the actual plan for this week.",
      rows: 3,
      maxLength: 600,
    },
    {
      key: "context",
      label: "Why the shift",
      kind: "textarea",
      defaultValue:
        "That's a couple of days earlier than usual on both ends. A few of you have travel and other things on this week, so rather than pick between schedules I'd rather pull the window forward so everyone has a real shot at playing.",
      rows: 3,
      maxLength: 600,
    },
    {
      key: "outro",
      label: "Closing note",
      kind: "textarea",
      defaultValue:
        "If the new window genuinely doesn't work for you, reply to this email and we'll figure something out. The whole point of this is for it to be fun, and that doesn't work if the timing is fighting you.",
      rows: 3,
      maxLength: 600,
    },
  ],
  render({ subject, fields }) {
    const liveTime = getField(this, fields, "liveTime");
    const deadline = getField(this, fields, "deadline");
    const apology = getField(this, fields, "apology");
    const context = getField(this, fields, "context");
    const outro = getField(this, fields, "outro");
    const finalSubject = subject.trim() || this.defaultSubject;

    const text = [
      "Mia's Quiz Tournament",
      "A quick note from the desk",
      "(From Sam, site admin)",
      "",
      "Hi everyone!",
      "",
      apology,
      "",
      "This week's timing:",
      `  • Round goes live: ${liveTime}`,
      `  • Deadline to finish: ${deadline}`,
      "",
      context,
      "",
      "Same questions, same lives, same bracket — just an earlier start and an earlier finish.",
      "",
      outro,
      "",
      "Thanks for rolling with it,",
      "— Sam",
      "Site administrator · Mia's Quiz Tournament",
    ].join("\n");

    const paragraph = (s: string) =>
      `<p style="margin:0 0 14px;font-family:Quicksand,system-ui,sans-serif;font-size:16px;line-height:1.65;color:#1B2A4E;">${esc(
        s
      )}</p>`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(finalSubject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
</style>
</head>
<body style="margin:0;padding:0;background:#B7E5FF;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">Updated timing for this week's round — apologies for the rushed earlier note.</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#B7E5FF;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:28px;box-shadow:8px 8px 0 0 #1B2A4E;">
          <tr>
            <td style="padding:36px 36px 8px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:14px;vertical-align:middle;">
                    <img src="https://quiz.miaswebsites.art/email-assets/sun.gif" width="64" height="64" alt="" style="display:block;width:64px;height:64px;"/>
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:24px;color:#1B2A4E;line-height:1;">Mia&rsquo;s Quiz Tournament</p>
                    <p style="margin:4px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:13px;color:#E94B7E;letter-spacing:.05em;text-transform:uppercase;">A quick note from the desk</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:22px;">
                <tr>
                  <td align="right">
                    <span style="display:inline-block;background:#87CEEB;color:#1B2A4E;padding:5px 14px;border-radius:999px;border:3px solid #1B2A4E;box-shadow:2px 2px 0 0 #1B2A4E;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;letter-spacing:.04em;">✉️&nbsp;FROM SAM, SITE ADMIN</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 8px 36px;">
              <h1 style="margin:0 0 16px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:30px;color:#1B2A4E;line-height:1.1;">Hi everyone!&nbsp;👋</h1>
              ${paragraph(apology)}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 22px;background:#B7E5FF;border:3px solid #1B2A4E;border-radius:16px;box-shadow:4px 4px 0 0 #1B2A4E;">
                <tr>
                  <td style="padding:16px 22px 6px 22px;">
                    <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:13px;color:#E94B7E;letter-spacing:.06em;text-transform:uppercase;">⏰&nbsp;This week&rsquo;s timing</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 22px 6px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="52" style="padding:8px 12px 8px 0;vertical-align:middle;">
                          <div style="width:38px;height:38px;border-radius:999px;background:#FF6B9D;border:3px solid #1B2A4E;text-align:center;line-height:32px;font-size:18px;box-shadow:2px 2px 0 0 #1B2A4E;">🚀</div>
                        </td>
                        <td style="padding:8px 0;vertical-align:middle;">
                          <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:12px;color:#3B4A7E;letter-spacing:.06em;text-transform:uppercase;">Round goes live</p>
                          <p style="margin:2px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:20px;color:#1B2A4E;line-height:1.2;">${esc(
                            liveTime
                          )}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px;">
                    <div style="border-top:2px dashed rgba(27,42,78,.22);height:0;line-height:0;font-size:0;">&nbsp;</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 22px 16px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="52" style="padding:8px 12px 8px 0;vertical-align:middle;">
                          <div style="width:38px;height:38px;border-radius:999px;background:#FFD93D;border:3px solid #1B2A4E;text-align:center;line-height:32px;font-size:18px;box-shadow:2px 2px 0 0 #1B2A4E;">🏁</div>
                        </td>
                        <td style="padding:8px 0;vertical-align:middle;">
                          <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:12px;color:#3B4A7E;letter-spacing:.06em;text-transform:uppercase;">Deadline to finish</p>
                          <p style="margin:2px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:20px;color:#1B2A4E;line-height:1.2;">${esc(
                            deadline
                          )}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ${paragraph(context)}
              ${paragraph(
                "Same questions, same lives, same bracket — just an earlier start and an earlier finish."
              )}
              ${paragraph(outro)}
              <div style="margin:28px 0 8px;">
                <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:16px;color:#1B2A4E;">Thanks for rolling with it,</p>
                <p style="margin:6px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:36px;color:#E94B7E;line-height:1;">— Sam</p>
                <p style="margin:6px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:13px;color:#3B4A7E;">Site administrator&nbsp;·&nbsp;Mia&rsquo;s Quiz Tournament</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <div style="background:#7BC4A4;border-top:3px solid #1B2A4E;height:48px;border-bottom-left-radius:24px;border-bottom-right-radius:24px;">&nbsp;</div>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:11px;color:#3B4A7E;opacity:.8;">You&rsquo;re receiving this because you signed up for Mia&rsquo;s Quiz Tournament. Reply any time.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return { subject: finalSubject, html, text };
  },
};

const BRACKET_UPDATE: EmailTemplate = {
  id: "bracket-update",
  name: "Bracket update · with live snapshot",
  description:
    "Your custom message + a live picture-book bracket image (fetched from quiz.miaswebsites.art so it always shows the current state when the recipient opens the email).",
  defaultSubject: "Bracket update — Mia's Quiz Tournament",
  fields: [
    {
      key: "headline",
      label: "Big headline",
      kind: "text",
      defaultValue: "Here's where the bracket stands 👀",
      hint: "Shown in big display type at the top of the card.",
      maxLength: 120,
    },
    {
      key: "message",
      label: "Your message",
      kind: "textarea",
      defaultValue:
        "Quick update on the bracket! Below is a live snapshot — it'll update over time as matches resolve, so feel free to come back and check it again later.",
      hint: "Written in your voice. Plain text; blank lines make new paragraphs.",
      rows: 6,
      maxLength: 3000,
    },
    {
      key: "ctaLabel",
      label: "Button label",
      kind: "text",
      defaultValue: "Open the live bracket →",
      hint: "Goes straight to /bracket on the live site.",
      maxLength: 60,
    },
    {
      key: "ctaUrl",
      label: "Button URL",
      kind: "text",
      defaultValue: "https://quiz.miaswebsites.art/bracket",
      maxLength: 240,
    },
    {
      key: "bracketUrl",
      label: "Bracket image URL",
      kind: "text",
      defaultValue:
        "https://quiz.miaswebsites.art/api/bracket/snapshot.svg",
      hint: "Defaults to the live SVG endpoint — leave alone unless you know why you're changing it.",
      maxLength: 400,
    },
  ],
  render({ subject, fields }) {
    const headline = getField(this, fields, "headline");
    const messageRaw = getField(this, fields, "message");
    const ctaLabel = getField(this, fields, "ctaLabel");
    const ctaUrl = getField(this, fields, "ctaUrl");
    const bracketUrl = getField(this, fields, "bracketUrl");
    const finalSubject = subject.trim() || this.defaultSubject;

    const paragraphs = messageRaw
      .split(/\n{2,}/)
      .map(
        (p) =>
          `<p style="margin:0 0 14px;font-family:Quicksand,system-ui,sans-serif;font-size:16px;line-height:1.65;color:#1B2A4E;">${esc(
            p
          ).replace(/\n/g, "<br/>")}</p>`
      )
      .join("");

    const text = [
      "Mia's Quiz Tournament — Bracket update",
      "",
      headline,
      "",
      messageRaw,
      "",
      `Open the live bracket: ${ctaUrl}`,
      `Bracket image: ${bracketUrl}`,
      "",
      "— Sam",
      "Site administrator · Mia's Quiz Tournament",
    ].join("\n");

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(finalSubject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
  /* Animated gradient strip — degrades to solid in clients that strip it. */
  @keyframes qspShine { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
  .qsp-shine { background: linear-gradient(90deg, #FFD93D 0%, #FF6B9D 25%, #87CEEB 50%, #7DD87D 75%, #FFD93D 100%); background-size: 200% 100%; animation: qspShine 6s linear infinite; }
  @keyframes qspBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
  .qsp-bob { animation: qspBob 2.4s ease-in-out infinite; display: inline-block; }
</style>
</head>
<body style="margin:0;padding:0;background:#B7E5FF;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${esc(
    headline
  )} — bracket snapshot inside.</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#B7E5FF;">
    <tr>
      <td align="center" style="padding:32px 14px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:28px;box-shadow:8px 8px 0 0 #1B2A4E;overflow:hidden;">
          <tr>
            <td class="qsp-shine" style="height:8px;background:linear-gradient(90deg,#FFD93D 0%,#FF6B9D 25%,#87CEEB 50%,#7DD87D 75%,#FFD93D 100%);background-size:200% 100%;line-height:0;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 36px 8px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:14px;vertical-align:middle;">
                    <img src="https://quiz.miaswebsites.art/email-assets/crown.gif" width="72" height="64" alt="" style="display:block;width:72px;height:64px;"/>
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:24px;color:#1B2A4E;line-height:1;">Mia&rsquo;s Quiz Tournament</p>
                    <p style="margin:4px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:13px;color:#E94B7E;letter-spacing:.05em;text-transform:uppercase;">Bracket update</p>
                  </td>
                </tr>
              </table>
              <h1 style="margin:24px 0 14px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:34px;color:#1B2A4E;line-height:1.15;">${esc(
                headline
              )}</h1>
              ${paragraphs}
            </td>
          </tr>
          <tr>
            <td style="padding:6px 24px 6px 24px;">
              <a href="${esc(
                ctaUrl
              )}" style="display:block;text-decoration:none;border:3px solid #1B2A4E;border-radius:18px;background:#FFFFFF;box-shadow:4px 4px 0 0 #1B2A4E;overflow:hidden;">
                <img src="${esc(
                  bracketUrl
                )}" alt="Current bracket — visit ${esc(
      ctaUrl
    )} for the live version" style="display:block;width:100%;height:auto;background:#B7E5FF;" />
              </a>
              <p style="margin:8px 2px 0;font-family:Quicksand,system-ui,sans-serif;font-size:12px;color:#3B4A7E;text-align:center;">Live snapshot — refreshes whenever this email is opened.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:6px 36px 0 36px;line-height:0;font-size:0;">
              <img src="https://quiz.miaswebsites.art/email-assets/sparkles.gif" width="480" alt="" style="display:block;width:100%;max-width:480px;height:auto;"/>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 36px 10px 36px;">
              <a href="${esc(
                ctaUrl
              )}" style="display:inline-block;background:#FF6B9D;color:white;padding:14px 26px;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:18px;text-decoration:none;">${esc(
      ctaLabel
    )}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 8px 36px;">
              <div style="margin:12px 0 4px;font-family:Fredoka,Quicksand,system-ui,sans-serif;">
                <p style="margin:0;font-weight:600;font-size:16px;color:#1B2A4E;">Talk soon,</p>
                <p style="margin:6px 0 0;font-weight:700;font-size:32px;color:#E94B7E;line-height:1;">— Sam</p>
                <p style="margin:6px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:13px;color:#3B4A7E;">Site administrator&nbsp;·&nbsp;Mia&rsquo;s Quiz Tournament</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <div style="background:#7BC4A4;border-top:3px solid #1B2A4E;height:48px;">&nbsp;</div>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:11px;color:#3B4A7E;opacity:.8;">You&rsquo;re receiving this because you signed up for Mia&rsquo;s Quiz Tournament. Reply any time.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return { subject: finalSubject, html, text };
  },
};

const STILL_IN: EmailTemplate = {
  id: "still-in",
  name: "Still in · congrats with bracket",
  description:
    "Personal congrats note for a player who survived the round. Live bracket image attached so they can see who's left.",
  defaultSubject: "🎉 You're still in — Mia's Quiz Tournament",
  fields: [
    {
      key: "playerName",
      label: "Player's first name",
      kind: "text",
      defaultValue: "you",
      hint: "Drops into the salutation. Leave as-is for a generic version.",
      maxLength: 40,
    },
    {
      key: "headline",
      label: "Headline",
      kind: "text",
      defaultValue: "Still in. 🌞",
      hint: "Big display type at the top.",
      maxLength: 80,
    },
    {
      key: "lede",
      label: "Opener",
      kind: "textarea",
      defaultValue:
        "Quick note: you cleared this round and you're moving on. Bracket below — your name's on it, and so are the other survivors.",
      rows: 3,
      maxLength: 500,
    },
    {
      key: "praise",
      label: "Personal praise (optional)",
      kind: "textarea",
      defaultValue:
        "Honestly impressive answers — kept your hearts and didn't slip on any of the tricky ones.",
      hint: "Tweak per recipient if you want. Leave default for a one-size-fits-all version.",
      rows: 3,
      maxLength: 600,
    },
    {
      key: "outro",
      label: "Closing note",
      kind: "textarea",
      defaultValue:
        "Next round's already taking shape — keep an eye on your inbox for the start time. Good luck!",
      rows: 3,
      maxLength: 500,
    },
    {
      key: "ctaUrl",
      label: "Bracket button URL",
      kind: "text",
      defaultValue: "https://quiz.miaswebsites.art/bracket",
      maxLength: 240,
    },
    {
      key: "bracketUrl",
      label: "Bracket image URL",
      kind: "text",
      defaultValue:
        "https://quiz.miaswebsites.art/api/bracket/snapshot.svg",
      hint: "Live snapshot — leave alone unless you've hosted a static one elsewhere.",
      maxLength: 400,
    },
  ],
  render({ subject, fields }) {
    const playerName = getField(this, fields, "playerName");
    const headline = getField(this, fields, "headline");
    const lede = getField(this, fields, "lede");
    const praise = getField(this, fields, "praise");
    const outro = getField(this, fields, "outro");
    const ctaUrl = getField(this, fields, "ctaUrl");
    const bracketUrl = getField(this, fields, "bracketUrl");
    const finalSubject = subject.trim() || this.defaultSubject;

    const text = [
      "Mia's Quiz Tournament — You made it!",
      "",
      `Hey ${playerName},`,
      "",
      headline,
      "",
      lede,
      "",
      praise,
      "",
      outro,
      "",
      `See the bracket: ${ctaUrl}`,
      "",
      "— Sam",
      "Site administrator · Mia's Quiz Tournament",
    ].join("\n");

    const para = (s: string) =>
      `<p style="margin:0 0 14px;font-family:Quicksand,system-ui,sans-serif;font-size:16px;line-height:1.65;color:#1B2A4E;">${esc(
        s
      )}</p>`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(finalSubject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
  @keyframes qspShine { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
  .qsp-shine { background: linear-gradient(90deg,#FFD93D 0%,#FF6B9D 25%,#7DD87D 50%,#87CEEB 75%,#FFD93D 100%); background-size: 200% 100%; animation: qspShine 6s linear infinite; }
  @keyframes qspBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
  .qsp-bob { animation: qspBob 2.4s ease-in-out infinite; display: inline-block; }
</style>
</head>
<body style="margin:0;padding:0;background:#B7E5FF;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#B7E5FF;">
    <tr><td align="center" style="padding:32px 14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:28px;box-shadow:8px 8px 0 0 #1B2A4E;overflow:hidden;">
        <tr><td class="qsp-shine" style="height:8px;background:linear-gradient(90deg,#FFD93D 0%,#FF6B9D 25%,#7DD87D 50%,#87CEEB 75%,#FFD93D 100%);background-size:200% 100%;line-height:0;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:30px 36px 6px 36px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:14px;vertical-align:middle;">
                <img src="https://quiz.miaswebsites.art/email-assets/hearts.gif" width="100" height="64" alt="" style="display:block;width:100px;height:64px;"/>
              </td>
              <td style="vertical-align:middle;">
                <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#1B2A4E;line-height:1;">Mia&rsquo;s Quiz Tournament</p>
                <p style="margin:4px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:13px;color:#4FB04F;letter-spacing:.05em;text-transform:uppercase;">You&rsquo;re still in</p>
              </td>
            </tr>
          </table>
          <h1 style="margin:24px 0 4px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:42px;color:#1B2A4E;line-height:1.1;">${esc(
            headline
          )}</h1>
          <p style="margin:0 0 16px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#4FB04F;">Hey ${esc(
            playerName
          )} 🎉</p>
          ${para(lede)}
          ${para(praise)}
        </td></tr>
        <tr><td style="padding:6px 24px 6px 24px;">
          <a href="${esc(
            ctaUrl
          )}" style="display:block;text-decoration:none;border:3px solid #1B2A4E;border-radius:18px;background:#FFFFFF;box-shadow:4px 4px 0 0 #1B2A4E;overflow:hidden;">
            <img src="${esc(
              bracketUrl
            )}" alt="Live bracket — ${esc(ctaUrl)}" style="display:block;width:100%;height:auto;background:#B7E5FF;" />
          </a>
          <p style="margin:8px 2px 0;font-family:Quicksand,system-ui,sans-serif;font-size:12px;color:#3B4A7E;text-align:center;">Live snapshot — your name's the one not crossed out 😉</p>
        </td></tr>
        <tr><td align="center" style="padding:8px 36px 0 36px;line-height:0;font-size:0;">
          <img src="https://quiz.miaswebsites.art/email-assets/sparkles.gif" width="480" alt="" style="display:block;width:100%;max-width:480px;height:auto;"/>
        </td></tr>
        <tr><td align="center" style="padding:6px 36px 8px 36px;">
          <a href="${esc(
            ctaUrl
          )}" style="display:inline-block;background:#7DD87D;color:white;padding:14px 26px;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:18px;text-decoration:none;">Open the live bracket →</a>
        </td></tr>
        <tr><td style="padding:14px 36px 8px 36px;">
          ${para(outro)}
          <div style="margin:14px 0 4px;font-family:Fredoka,Quicksand,system-ui,sans-serif;">
            <p style="margin:0;font-weight:600;font-size:16px;color:#1B2A4E;">Talk soon,</p>
            <p style="margin:6px 0 0;font-weight:700;font-size:32px;color:#E94B7E;line-height:1;">— Sam</p>
            <p style="margin:6px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:13px;color:#3B4A7E;">Site administrator&nbsp;·&nbsp;Mia&rsquo;s Quiz Tournament</p>
          </div>
        </td></tr>
        <tr><td style="padding:0;line-height:0;font-size:0;">
          <div style="background:#7BC4A4;border-top:3px solid #1B2A4E;height:48px;">&nbsp;</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    return { subject: finalSubject, html, text };
  },
};

const ELIMINATED_REVEAL: EmailTemplate = {
  id: "eliminated-reveal",
  name: "Eliminated · gentle reveal",
  description:
    "Reads like a normal round-recap email at the start, then near the end gently breaks the news that they're out. Designed to soften the gut-punch — recipients can't tell from the subject line or first paragraph.",
  defaultSubject: "Round recap — Mia's Quiz Tournament",
  fields: [
    {
      key: "playerName",
      label: "Player's first name",
      kind: "text",
      defaultValue: "there",
      maxLength: 40,
    },
    {
      key: "roundLabel",
      label: "Round label",
      kind: "text",
      defaultValue: "this round",
      hint: "e.g. \"Round 2\" or \"Round 2: Geography\". Used in the recap header.",
      maxLength: 60,
    },
    {
      key: "ambiguousOpener",
      label: "Ambiguous opener (sets neutral tone)",
      kind: "textarea",
      defaultValue:
        "Recap time. The round wrapped up earlier today — really fun set of answers came in across the board. A few players cleared it cleanly, a few had it tighter, and the bracket's getting interesting.",
      hint: "Reads like a generic update — same first paragraph could go to a survivor.",
      rows: 4,
      maxLength: 600,
    },
    {
      key: "buildup",
      label: "Build-up (still ambiguous)",
      kind: "textarea",
      defaultValue:
        "Hearts hit hard this round — the questions skewed trickier than the warm-up suggested, and the threshold turned out to be the deciding factor for a few people. Honestly proud of the effort all around.",
      rows: 4,
      maxLength: 600,
    },
    {
      key: "softReveal",
      label: "The reveal (kept gentle)",
      kind: "textarea",
      defaultValue:
        "So — here's the part I wish I didn't have to write. You came up just short of the threshold this time, which means your run in the tournament wraps up here. I'm sorry. You played it well and the margin really wasn't big.",
      hint: "The pivot. Pre-set to land softly; tweak per player if you'd like.",
      rows: 5,
      maxLength: 800,
    },
    {
      key: "consolation",
      label: "Consolation + invite to stay around",
      kind: "textarea",
      defaultValue:
        "And — really importantly — this is NOT the end of the game. If you got knocked out in round 1, you'll be getting a separate email shortly with your next steps: a brand-new losers bracket has just been seeded and you're in it. Big things still to compete for. Watch your inbox.\n\nEither way, the bracket / players / standings pages stay open to you. Mia would love to know you're still around.",
      rows: 5,
      maxLength: 800,
    },
  ],
  render({ subject, fields }) {
    const playerName = getField(this, fields, "playerName");
    const roundLabel = getField(this, fields, "roundLabel");
    const opener = getField(this, fields, "ambiguousOpener");
    const buildup = getField(this, fields, "buildup");
    const reveal = getField(this, fields, "softReveal");
    const consolation = getField(this, fields, "consolation");
    const finalSubject = subject.trim() || this.defaultSubject;

    const text = [
      "Mia's Quiz Tournament — Round recap",
      "",
      `Hey ${playerName},`,
      "",
      opener,
      "",
      buildup,
      "",
      reveal,
      "",
      consolation,
      "",
      "— Sam",
      "Site administrator · Mia's Quiz Tournament",
    ].join("\n");

    const para = (s: string, color = "#1B2A4E") =>
      `<p style="margin:0 0 14px;font-family:Quicksand,system-ui,sans-serif;font-size:16px;line-height:1.7;color:${color};">${esc(
        s
      )}</p>`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(finalSubject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
</style>
</head>
<body style="margin:0;padding:0;background:#B7E5FF;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">Recap from this round of Mia's Quiz Tournament.</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#B7E5FF;">
    <tr><td align="center" style="padding:32px 14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:28px;box-shadow:8px 8px 0 0 #1B2A4E;overflow:hidden;">
        <tr><td style="padding:32px 36px 8px 36px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:14px;vertical-align:middle;">
                <div style="width:54px;height:54px;border-radius:999px;background:#FFD93D;border:3px solid #1B2A4E;text-align:center;font-size:26px;line-height:48px;box-shadow:2px 2px 0 0 #1B2A4E;">📨</div>
              </td>
              <td style="vertical-align:middle;">
                <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#1B2A4E;line-height:1;">Mia&rsquo;s Quiz Tournament</p>
                <p style="margin:4px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:13px;color:#3B4A7E;letter-spacing:.05em;text-transform:uppercase;">${esc(
                  roundLabel
                )} · Recap</p>
              </td>
            </tr>
          </table>
          <h1 style="margin:24px 0 16px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:32px;color:#1B2A4E;line-height:1.15;">Hey ${esc(
            playerName
          )} 👋</h1>
          ${para(opener)}
          ${para(buildup)}
        </td></tr>
        <tr><td style="padding:0 36px;">
          <div style="border-top:2px dashed rgba(27,42,78,.22);margin:6px 0 14px;height:0;line-height:0;font-size:0;">&nbsp;</div>
        </td></tr>
        <tr><td style="padding:6px 36px 6px 36px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF1E6;border:3px solid #1B2A4E;border-radius:18px;box-shadow:4px 4px 0 0 #1B2A4E;">
            <tr><td style="padding:18px 22px;">
              <p style="margin:0 0 6px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:13px;color:#E94B7E;letter-spacing:.06em;text-transform:uppercase;">A note for you specifically</p>
              ${para(reveal)}
              ${para(consolation, "#3B4A7E")}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 36px 8px 36px;">
          <div style="margin:6px 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;">
            <p style="margin:0;font-weight:600;font-size:16px;color:#1B2A4E;">Take care,</p>
            <p style="margin:6px 0 0;font-weight:700;font-size:32px;color:#E94B7E;line-height:1;">— Sam</p>
            <p style="margin:6px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:13px;color:#3B4A7E;">Site administrator&nbsp;·&nbsp;Mia&rsquo;s Quiz Tournament</p>
          </div>
        </td></tr>
        <tr><td style="padding:0;line-height:0;font-size:0;">
          <div style="background:#7BC4A4;border-top:3px solid #1B2A4E;height:48px;">&nbsp;</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    return { subject: finalSubject, html, text };
  },
};

const TIME_RUNNING_OUT: EmailTemplate = {
  id: "time-running-out",
  name: "Time is running out · live countdown",
  description:
    "Big live-updating countdown clock at the top (refreshes whenever the recipient opens the email), plus an animated sun, sparkles and your custom message. Best looking template in the kit.",
  defaultSubject: "⏰ Time's almost up — Mia's Quiz Tournament",
  fields: [
    {
      key: "deadline",
      label: "Deadline (ISO timestamp or just YYYY-MM-DDTHH:MM)",
      kind: "text",
      defaultValue: "",
      hint: "Local time format: 2026-05-02T21:00 (9pm). The countdown image bakes this in; recipients see live remaining time as they open.",
      maxLength: 60,
    },
    {
      key: "label",
      label: "Label above the digits",
      kind: "text",
      defaultValue: "Round closes in",
      maxLength: 60,
    },
    {
      key: "headline",
      label: "Big headline",
      kind: "text",
      defaultValue: "{firstName}, the clock is ticking.",
      hint: "Use {firstName} to personalise per recipient.",
      maxLength: 120,
    },
    {
      key: "message",
      label: "Your message",
      kind: "textarea",
      defaultValue:
        "Quick reminder — this round closes soon and you haven't sealed in your answers yet. Tap below to play. It only takes a couple of minutes.",
      rows: 5,
      maxLength: 2000,
    },
    {
      key: "ctaLabel",
      label: "Button label",
      kind: "text",
      defaultValue: "▶ Play the round now",
      maxLength: 60,
    },
    {
      key: "ctaUrl",
      label: "Button URL",
      kind: "text",
      defaultValue: "https://quiz.miaswebsites.art/play",
      maxLength: 240,
    },
  ],
  render({ subject, fields }) {
    const deadline = getField(this, fields, "deadline");
    const label = getField(this, fields, "label");
    const headline = getField(this, fields, "headline");
    const messageRaw = getField(this, fields, "message");
    const ctaLabel = getField(this, fields, "ctaLabel");
    const ctaUrl = getField(this, fields, "ctaUrl");
    const finalSubject = subject.trim() || this.defaultSubject;

    const countdownUrl = `https://quiz.miaswebsites.art/api/countdown.gif?to=${encodeURIComponent(
      deadline
    )}&label=${encodeURIComponent(label)}&theme=urgent`;

    const paragraphs = messageRaw
      .split(/\n{2,}/)
      .map(
        (p) =>
          `<p style="margin:0 0 14px;font-family:Quicksand,system-ui,sans-serif;font-size:17px;line-height:1.65;color:#1B2A4E;">${esc(
            p
          ).replace(/\n/g, "<br/>")}</p>`
      )
      .join("");

    const text = [
      "Mia's Quiz Tournament — Time's running out",
      "",
      headline,
      "",
      messageRaw,
      "",
      `Deadline: ${deadline || "(not set)"}`,
      `Play: ${ctaUrl}`,
      "",
      "— Sam",
      "Site administrator · Mia's Quiz Tournament",
    ].join("\n");

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>${esc(finalSubject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
  @keyframes qspShine { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
  .qsp-shine { background: linear-gradient(90deg,#FFD93D,#FF6B9D,#E94B7E,#FFD93D); background-size: 200% 100%; animation: qspShine 4.5s linear infinite; }
  @keyframes qspPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
  .qsp-pulse { animation: qspPulse 1.4s ease-in-out infinite; transform-origin: center; }
</style>
</head>
<body style="margin:0;padding:0;background:#FFE9B0;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${esc(
    headline
  )} — countdown inside.</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(180deg,#FFE9B0 0%,#FFB766 100%);">
    <tr><td align="center" style="padding:32px 14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:28px;box-shadow:8px 8px 0 0 #1B2A4E;overflow:hidden;">
        <tr><td class="qsp-shine" style="height:10px;background:linear-gradient(90deg,#FFD93D,#FF6B9D,#E94B7E,#FFD93D);background-size:200% 100%;line-height:0;font-size:0;">&nbsp;</td></tr>
        <tr><td align="center" style="padding:0;line-height:0;font-size:0;background:#FFE9B0;">
          <img src="https://quiz.miaswebsites.art/email-assets/banner.gif" alt="" width="640" style="display:block;width:100%;max-width:640px;height:auto;"/>
        </td></tr>
        <tr><td style="padding:30px 36px 4px 36px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:14px;vertical-align:middle;">
                <img class="qsp-pulse" src="https://quiz.miaswebsites.art/email-assets/sun.gif" width="64" height="64" alt="" style="display:block;width:64px;height:64px;"/>
              </td>
              <td style="vertical-align:middle;">
                <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#1B2A4E;line-height:1;">Mia&rsquo;s Quiz Tournament</p>
                <p style="margin:4px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:13px;color:#E94B7E;letter-spacing:.08em;text-transform:uppercase;">⏰ Time is running out</p>
              </td>
            </tr>
          </table>
          <h1 style="margin:24px 0 14px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:34px;color:#1B2A4E;line-height:1.15;">${esc(
            headline
          )}</h1>
          ${paragraphs}
        </td></tr>
        <tr><td align="center" style="padding:18px 24px 6px 24px;">
          <a href="${esc(
            ctaUrl
          )}" style="display:block;text-decoration:none;border:3px solid #1B2A4E;border-radius:18px;background:#FFF7E6;box-shadow:4px 4px 0 0 #1B2A4E;overflow:hidden;">
            <img src="${esc(
              countdownUrl
            )}" width="640" alt="${esc(
      label
    )}" style="display:block;width:100%;max-width:640px;height:auto;"/>
          </a>
          <p style="margin:8px 2px 0;font-family:Quicksand,system-ui,sans-serif;font-size:12px;color:#3B4A7E;text-align:center;">Live countdown — refreshes when you open the email.</p>
        </td></tr>
        <tr><td align="center" style="padding:8px 36px 6px 36px;line-height:0;font-size:0;">
          <img src="https://quiz.miaswebsites.art/email-assets/sparkles.gif" width="480" alt="" style="display:block;width:100%;max-width:480px;height:auto;"/>
        </td></tr>
        <tr><td align="center" style="padding:6px 36px 22px 36px;">
          <a href="${esc(
            ctaUrl
          )}" style="display:inline-block;background:#FF6B9D;color:white;padding:18px 32px;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;text-decoration:none;">${esc(
      ctaLabel
    )}</a>
        </td></tr>
        <tr><td style="padding:6px 36px 8px 36px;">
          <div style="margin:14px 0 4px;font-family:Fredoka,Quicksand,system-ui,sans-serif;">
            <p style="margin:0;font-weight:600;font-size:16px;color:#1B2A4E;">Don&rsquo;t leave it til the last second,</p>
            <p style="margin:6px 0 0;font-weight:700;font-size:32px;color:#E94B7E;line-height:1;">— Sam</p>
            <p style="margin:6px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:13px;color:#3B4A7E;">Site administrator&nbsp;·&nbsp;Mia&rsquo;s Quiz Tournament</p>
          </div>
        </td></tr>
        <tr><td style="padding:0;line-height:0;font-size:0;">
          <div style="background:#7BC4A4;border-top:3px solid #1B2A4E;height:48px;">&nbsp;</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    return { subject: finalSubject, html, text };
  },
};

const TIEBREAKER_QUIZ: EmailTemplate = {
  id: "tiebreaker-quiz",
  name: "Tiebreaker · 5 questions, winner advances",
  description:
    "Sent to the two players who tied. Each gets a link to a 5-question tiebreaker quiz; whoever scores higher takes the bracket slot.",
  defaultSubject: "Tiebreaker — Mia's Quiz Tournament",
  fields: [
    {
      key: "quizUrl",
      label: "Tiebreaker quiz URL",
      kind: "text",
      defaultValue: "https://quiz.miaswebsites.art/play/practice/REPLACE_ME",
      hint: "Run scripts/create-tiebreaker.ts to generate this URL.",
      maxLength: 240,
    },
    {
      key: "topic",
      label: "Topic shown in the email",
      kind: "text",
      defaultValue: "U.S. law",
      maxLength: 80,
    },
    {
      key: "personalNote",
      label: "Personal note",
      kind: "textarea",
      defaultValue:
        "{firstName} — your bracket score came up dead even with one other player, so we're settling it the only way that's fair: a 5-question tiebreaker. Higher scorer advances. No looking things up — eyes on the screen.",
      hint: "Uses {firstName} so each recipient sees their own name.",
      rows: 4,
      maxLength: 800,
    },
    {
      key: "rules",
      label: "Rules block",
      kind: "textarea",
      defaultValue:
        "Five questions. Multiple choice. No timer, but try to keep it under 10 minutes. Tab-leave strikes are still on, so don't pop another tab.",
      rows: 3,
      maxLength: 600,
    },
    {
      key: "deadline",
      label: "Deadline (free text)",
      kind: "text",
      defaultValue: "by midnight tonight",
      maxLength: 80,
    },
  ],
  render({ subject, fields }) {
    const quizUrl = getField(this, fields, "quizUrl");
    const topic = getField(this, fields, "topic");
    const personalNote = getField(this, fields, "personalNote");
    const rules = getField(this, fields, "rules");
    const deadline = getField(this, fields, "deadline");
    const finalSubject = subject.trim() || this.defaultSubject;

    const text = [
      "Mia's Quiz Tournament — Tiebreaker",
      "",
      personalNote,
      "",
      `Topic: ${topic}`,
      `Deadline: ${deadline}`,
      "",
      "Rules:",
      rules,
      "",
      `Take the tiebreaker: ${quizUrl}`,
      "",
      "— Sam · Mia's Quiz Tournament",
    ].join("\n");

    const para = (s: string) =>
      `<p style="margin:0 0 14px;font-family:Quicksand,system-ui,sans-serif;font-size:16px;line-height:1.65;color:#1B2A4E;">${esc(
        s
      )}</p>`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(finalSubject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
</style>
</head>
<body style="margin:0;padding:0;background:#1B0440;font-family:Quicksand,system-ui,sans-serif;color:#F4ECFF;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(180deg,#1B0440 0%,#0B0322 100%);">
    <tr><td align="center" style="padding:32px 14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:28px;box-shadow:8px 8px 0 0 #1B2A4E;overflow:hidden;">
        <tr><td style="height:8px;background:linear-gradient(90deg,#FFCC00 0%,#FF2D75 50%,#00F0FF 100%);line-height:0;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 36px 8px 36px;">
          <p style="margin:0 0 6px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:13px;letter-spacing:0.18em;color:#E94B7E;text-transform:uppercase;">⚔️ Tiebreaker</p>
          <h1 style="margin:0 0 16px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:40px;color:#1B2A4E;line-height:1.05;">It's a tie. Higher scorer wins.</h1>
          ${para(personalNote)}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0;background:#FFF7E6;border:3px solid #1B2A4E;border-radius:16px;box-shadow:4px 4px 0 0 #1B2A4E;">
            <tr><td style="padding:18px 22px;">
              <p style="margin:0 0 6px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:13px;letter-spacing:0.06em;color:#E94B7E;text-transform:uppercase;">⏱️ The challenge</p>
              <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:24px;color:#1B2A4E;line-height:1.2;">5 questions on ${esc(topic)}.</p>
              <p style="margin:6px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:14px;color:#3B4A7E;">Deadline: <strong>${esc(deadline)}</strong></p>
              <p style="margin:10px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:14px;color:#1B2A4E;line-height:1.55;">${esc(rules).replace(/\n/g, "<br/>")}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:6px 36px 22px 36px;">
          <a href="${esc(
            quizUrl
          )}" style="display:inline-block;background:#FF6B9D;color:white;padding:18px 32px;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:20px;text-decoration:none;">▶ Take the tiebreaker</a>
        </td></tr>
        <tr><td style="padding:8px 36px 8px 36px;">
          <div style="margin:6px 0 4px;font-family:Fredoka,Quicksand,system-ui,sans-serif;">
            <p style="margin:0;font-weight:600;font-size:16px;color:#1B2A4E;">Good luck —</p>
            <p style="margin:6px 0 0;font-weight:700;font-size:32px;color:#E94B7E;line-height:1;">Sam</p>
            <p style="margin:6px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:13px;color:#3B4A7E;">Site administrator&nbsp;·&nbsp;Mia&rsquo;s Quiz Tournament</p>
          </div>
        </td></tr>
        <tr><td style="padding:0;line-height:0;font-size:0;">
          <div style="background:#7BC4A4;border-top:3px solid #1B2A4E;height:48px;">&nbsp;</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    return { subject: finalSubject, html, text };
  },
};

const R1_RESULTS_DOUBLE_ELIM: EmailTemplate = {
  id: "r1-results-double-elim",
  name: "R1 results · main winners advance, losers go to losers bracket",
  description:
    "Sent to everyone who played round 1. Explains the new format: R1 losers drop to a losers bracket; from R2 onward (and in losers) one loss is out. Shows BOTH bracket snapshots inline.",
  defaultSubject: "Round 1 is in the books — your next match is set",
  fields: [
    {
      key: "headline",
      label: "Big headline",
      kind: "text",
      defaultValue: "Round 1 is in the books.",
      maxLength: 120,
    },
    {
      key: "intro",
      label: "Opener",
      kind: "textarea",
      defaultValue:
        "{firstName} — round 1 is wrapped. Big news on format: from here on, every loss is final. Quarterfinal+ losers are out. But round-1 fallers get one more shot — they drop to a brand-new losers bracket. Auto-seeded below.",
      rows: 5,
      maxLength: 1200,
    },
    {
      key: "rules",
      label: "Rules block",
      kind: "textarea",
      defaultValue:
        "From now on:\n• Lose in the main bracket (quarterfinals or later) → out, no comeback.\n• Lose in the losers bracket → out.\n• Win the losers bracket → you take the consolation crown.",
      rows: 5,
      maxLength: 800,
    },
    {
      key: "ctaUrl",
      label: "Bracket button URL",
      kind: "text",
      defaultValue: "https://quiz.miaswebsites.art/bracket",
      maxLength: 240,
    },
    {
      key: "mainBracketUrl",
      label: "Main bracket image URL",
      kind: "text",
      defaultValue:
        "https://quiz.miaswebsites.art/api/bracket/snapshot.svg?bracket=main",
      hint: "Defaults to the live snapshot endpoint, scoped to the main bracket.",
      maxLength: 400,
    },
    {
      key: "losersBracketUrl",
      label: "Losers bracket image URL",
      kind: "text",
      defaultValue:
        "https://quiz.miaswebsites.art/api/bracket/snapshot.svg?bracket=losers",
      maxLength: 400,
    },
  ],
  render({ subject, fields }) {
    const headline = getField(this, fields, "headline");
    const intro = getField(this, fields, "intro");
    const rules = getField(this, fields, "rules");
    const ctaUrl = getField(this, fields, "ctaUrl");
    const mainBracketUrl = getField(this, fields, "mainBracketUrl");
    const losersBracketUrl = getField(this, fields, "losersBracketUrl");
    const finalSubject = subject.trim() || this.defaultSubject;

    const text = [
      "Mia's Quiz Tournament — Round 1 results",
      "",
      headline,
      "",
      intro,
      "",
      "Rules from here on:",
      rules,
      "",
      `Live bracket: ${ctaUrl}`,
      "",
      "— Sam · Mia's Quiz Tournament",
    ].join("\n");

    const para = (s: string) =>
      `<p style="margin:0 0 14px;font-family:Quicksand,system-ui,sans-serif;font-size:16px;line-height:1.65;color:#1B2A4E;white-space:pre-line;">${esc(
        s
      )}</p>`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(finalSubject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
</style>
</head>
<body style="margin:0;padding:0;background:#B7E5FF;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#B7E5FF;">
    <tr><td align="center" style="padding:32px 14px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:28px;box-shadow:8px 8px 0 0 #1B2A4E;overflow:hidden;">
        <tr><td style="height:8px;background:linear-gradient(90deg,#FFCC00 0%,#FF2D75 50%,#00F0FF 100%);line-height:0;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:30px 36px 6px 36px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:14px;vertical-align:middle;">
                <img src="https://quiz.miaswebsites.art/email-assets/sun.gif" width="64" height="64" alt="" style="display:block;width:64px;height:64px;"/>
              </td>
              <td style="vertical-align:middle;">
                <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#1B2A4E;line-height:1;">Mia&rsquo;s Quiz Tournament</p>
                <p style="margin:4px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:13px;color:#E94B7E;letter-spacing:.06em;text-transform:uppercase;">Round 1 results</p>
              </td>
            </tr>
          </table>
          <h1 style="margin:24px 0 16px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:34px;color:#1B2A4E;line-height:1.15;">${esc(
            headline
          )}</h1>
          ${para(intro)}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0;background:#FFF7E6;border:3px solid #1B2A4E;border-radius:16px;box-shadow:4px 4px 0 0 #1B2A4E;">
            <tr><td style="padding:18px 22px;">
              <p style="margin:0 0 8px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:13px;letter-spacing:0.08em;color:#E94B7E;text-transform:uppercase;">⚔️ New rule</p>
              ${para(rules)}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:8px 24px 4px 24px;">
          <p style="margin:0 4px 6px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:13px;letter-spacing:0.1em;color:#1B2A4E;text-transform:uppercase;">🏆 Main bracket</p>
          <a href="${esc(
            ctaUrl
          )}" style="display:block;text-decoration:none;border:3px solid #1B2A4E;border-radius:18px;background:#FFFFFF;box-shadow:4px 4px 0 0 #1B2A4E;overflow:hidden;">
            <img src="${esc(
              mainBracketUrl
            )}" alt="Main bracket" style="display:block;width:100%;height:auto;background:#B7E5FF;"/>
          </a>
        </td></tr>
        <tr><td style="padding:14px 24px 4px 24px;">
          <p style="margin:0 4px 6px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:13px;letter-spacing:0.1em;color:#E94B7E;text-transform:uppercase;">💔 Losers bracket</p>
          <a href="${esc(
            ctaUrl
          )}" style="display:block;text-decoration:none;border:3px solid #1B2A4E;border-radius:18px;background:#FFFFFF;box-shadow:4px 4px 0 0 #1B2A4E;overflow:hidden;">
            <img src="${esc(
              losersBracketUrl
            )}" alt="Losers bracket" style="display:block;width:100%;height:auto;background:#FFE9E9;"/>
          </a>
          <p style="margin:8px 4px 0;font-family:Quicksand,system-ui,sans-serif;font-size:12px;color:#3B4A7E;text-align:center;">Auto-seeded from R1 results. One loss here = out.</p>
        </td></tr>
        <tr><td align="center" style="padding:20px 36px 8px 36px;">
          <a href="${esc(
            ctaUrl
          )}" style="display:inline-block;background:#FF6B9D;color:white;padding:16px 30px;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:18px;text-decoration:none;">Open the live bracket →</a>
        </td></tr>
        <tr><td style="padding:14px 36px 8px 36px;">
          <div style="margin:6px 0 4px;font-family:Fredoka,Quicksand,system-ui,sans-serif;">
            <p style="margin:0;font-weight:600;font-size:16px;color:#1B2A4E;">Good luck round 2,</p>
            <p style="margin:6px 0 0;font-weight:700;font-size:32px;color:#E94B7E;line-height:1;">— Sam</p>
            <p style="margin:6px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:13px;color:#3B4A7E;">Site administrator&nbsp;·&nbsp;Mia&rsquo;s Quiz Tournament</p>
          </div>
        </td></tr>
        <tr><td style="padding:0;line-height:0;font-size:0;">
          <div style="background:#7BC4A4;border-top:3px solid #1B2A4E;height:48px;">&nbsp;</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    return { subject: finalSubject, html, text };
  },
};

const PICKEM_HYPE: EmailTemplate = {
  id: "pickem-hype",
  name: "Pick'em hype · gambling-ad parody",
  description:
    "Over-the-top March-Madness-style hype email announcing the bracket prediction game. Gold/coral/neon vibes, fake testimonials, live bracket snapshot, mock leaderboard widget, joke fine-print at the bottom. Use to announce predictions are live.",
  defaultSubject: "🎰 Love March Madness? You're going to LOVE this madness.",
  fields: [
    {
      key: "openingHook",
      label: "Opening hook (the lure)",
      kind: "textarea",
      defaultValue:
        "Did you fill out a March Madness bracket this year? Did you watch your Final Four pick get bounced in the second round? Did you mumble \"never again\" while tipping your laptop into the trash? Good. We have an offer for you.",
      rows: 5,
      maxLength: 800,
    },
    {
      key: "prizeLine",
      label: "Prize line (the carrot)",
      kind: "text",
      defaultValue: "A custom Mia drawing of your choice. Hand-delivered.",
      hint: "Shown in the gold prize block.",
      maxLength: 140,
    },
    {
      key: "openingDate",
      label: "Date predictions open (free text)",
      kind: "text",
      defaultValue: "Tonight at 9:00 PM EST",
      maxLength: 80,
    },
    {
      key: "ctaUrl",
      label: "Button URL",
      kind: "text",
      defaultValue: "https://quiz.miaswebsites.art/predict",
      maxLength: 240,
    },
    {
      key: "bracketUrl",
      label: "Live bracket image URL",
      kind: "text",
      defaultValue:
        "https://quiz.miaswebsites.art/api/bracket/snapshot.svg?bracket=main",
      maxLength: 400,
    },
  ],
  render({ subject, fields }) {
    const openingHook = getField(this, fields, "openingHook");
    const prizeLine = getField(this, fields, "prizeLine");
    const openingDate = getField(this, fields, "openingDate");
    const ctaUrl = getField(this, fields, "ctaUrl");
    const bracketUrl = getField(this, fields, "bracketUrl");
    const finalSubject = subject.trim() || this.defaultSubject;

    const text = [
      "MIA'S QUIZ TOURNAMENT — BRACKET PICK'EM",
      "═══════════════════════════════════════",
      "",
      `OPENS: ${openingDate}`,
      `PRIZE: ${prizeLine}`,
      "",
      openingHook,
      "",
      "HOW IT WORKS:",
      "  1. Sign in.",
      "  2. Predict every undecided matchup — main bracket AND losers bracket.",
      "  3. Score points as matches resolve.",
      "  4. Climb the leaderboard.",
      "",
      "POINT VALUES:",
      "  • Main R2 / late R1: 1 pt",
      "  • Main semis: 2 pts",
      "  • Main final: 4 pts",
      "  • Losers bracket: 1 pt each",
      "",
      `→ Make your picks: ${ctaUrl}`,
      "",
      "Not gambling. No money changes hands. Players of all ages welcome. Past predictions do not guarantee future results. Bracket Pick'Em is brought to you by The Quiz Book, a wholly-owned subsidiary of an 8-year-old.",
      "",
      "— Sam · Mia's Quiz Tournament",
    ].join("\n");

    const leaderboardRows = [
      { medal: "🥇", name: "(your name here)", correct: "—", pts: "—", you: true },
      { medal: "🥈", name: "Marc", correct: "0/0", pts: "0" },
      { medal: "🥉", name: "Manou", correct: "0/0", pts: "0" },
      { medal: "4.", name: "Karen Liss", correct: "0/0", pts: "0" },
      { medal: "5.", name: "Rhonda", correct: "0/0", pts: "0" },
    ];

    const stepCopy = [
      "Sign in (you already have an account).",
      "Open <strong>🔮 Predict</strong> in the top nav.",
      "Tap who you think wins each matchup. Main bracket AND losers bracket.",
      "Watch the leaderboard live. Edit your picks until each match locks.",
      "Win the points race. Win the prize. Talk about it for years.",
    ];

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>${esc(finalSubject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
</style>
</head>
<body style="margin:0;padding:0;background:#1B0440;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">An exclusive bracket pick'em opportunity inside. ${esc(prizeLine)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(180deg,#1B0440 0%,#0B0322 100%);">
    <tr><td align="center" style="padding:24px 14px 32px;">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;margin:0 auto 14px;">
        <tr><td style="padding:6px 14px;background:#1B2A4E;color:#FFD93D;font-family:Fredoka,sans-serif;font-weight:700;font-size:11px;letter-spacing:.18em;text-transform:uppercase;text-align:center;border-radius:4px;">
          ⚠️ PAID INTEREST: NONE · STAKES: ETERNAL · OPENS ${esc(openingDate.toUpperCase())}
        </td></tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:28px;box-shadow:0 0 0 4px #FFCC00, 0 0 0 6px #1B2A4E, 12px 12px 0 6px #1B2A4E;overflow:hidden;">

        <tr><td style="height:8px;background:repeating-linear-gradient(45deg,#FFCC00 0 18px,#1B2A4E 18px 36px);line-height:0;font-size:0;">&nbsp;</td></tr>

        <tr><td style="background:linear-gradient(180deg,#FFCC00 0%,#FF6B00 100%);padding:34px 28px 22px;text-align:center;">
          <p style="margin:0;font-family:Fredoka,sans-serif;font-weight:700;font-size:13px;letter-spacing:.32em;text-transform:uppercase;color:#1B0440;">An Unprecedented Opportunity From</p>
          <p style="margin:6px 0 0;font-family:Fredoka,sans-serif;font-weight:700;font-size:18px;color:#1B0440;">Mia&rsquo;s Quiz Tournament</p>
          <h1 style="margin:14px 0 0;font-family:Fredoka,sans-serif;font-weight:700;font-size:62px;line-height:0.9;color:#1B0440;text-shadow:3px 3px 0 #FFFFFF, 6px 6px 0 #1B0440;letter-spacing:-0.01em;">BRACKET<br/>PICK&rsquo;EM</h1>
          <p style="margin:14px 0 0;font-family:Fredoka,sans-serif;font-weight:700;font-size:18px;color:#1B0440;letter-spacing:.06em;">Coming&nbsp;Soon&nbsp;·&nbsp;${esc(openingDate)}</p>
          <img src="https://quiz.miaswebsites.art/email-assets/sparkles.gif" width="480" alt="" style="display:block;width:100%;max-width:480px;height:auto;margin:14px auto 0;"/>
        </td></tr>

        <tr><td style="padding:28px 36px 12px;">
          <p style="margin:0 0 14px;font-family:Quicksand,sans-serif;font-size:17px;line-height:1.65;color:#1B2A4E;">${esc(openingHook).replace(/\n/g, "<br/>")}</p>
        </td></tr>

        <tr><td style="padding:6px 24px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="33%" align="center" style="padding:6px;">
                <div style="background:#FFD93D;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 #1B2A4E;padding:14px 8px;">
                  <div style="font-family:Fredoka,sans-serif;font-weight:700;font-size:30px;color:#1B0440;line-height:1;">16+</div>
                  <div style="font-family:Fredoka,sans-serif;font-weight:700;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#1B0440;margin-top:4px;">Matchups<br/>predictable</div>
                </div>
              </td>
              <td width="33%" align="center" style="padding:6px;">
                <div style="background:#FF6B9D;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 #1B2A4E;padding:14px 8px;">
                  <div style="font-family:Fredoka,sans-serif;font-weight:700;font-size:30px;color:#FFFFFF;line-height:1;">17</div>
                  <div style="font-family:Fredoka,sans-serif;font-weight:700;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#FFFFFF;margin-top:4px;">Total points<br/>up for grabs</div>
                </div>
              </td>
              <td width="33%" align="center" style="padding:6px;">
                <div style="background:#7DD87D;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 #1B2A4E;padding:14px 8px;">
                  <div style="font-family:Fredoka,sans-serif;font-weight:700;font-size:30px;color:#1B0440;line-height:1;">$0</div>
                  <div style="font-family:Fredoka,sans-serif;font-weight:700;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#1B0440;margin-top:4px;">Entry fee<br/>forever</div>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:14px 24px 4px;">
          <p style="margin:0 4px 6px;font-family:Fredoka,sans-serif;font-weight:700;font-size:11px;letter-spacing:.2em;color:#E94B7E;text-transform:uppercase;">📸 The board you&rsquo;re going to predict</p>
          <a href="${esc(ctaUrl)}" style="display:block;text-decoration:none;border:3px solid #1B2A4E;border-radius:18px;background:#FFFFFF;box-shadow:4px 4px 0 #1B2A4E;overflow:hidden;">
            <img src="${esc(bracketUrl)}" alt="Live bracket — current state" style="display:block;width:100%;height:auto;background:#B7E5FF;"/>
          </a>
          <p style="margin:8px 4px 0;font-family:Quicksand,sans-serif;font-size:12px;color:#3B4A7E;text-align:center;">Live snapshot. Refreshes every time you open this email. Pick the winners.</p>
        </td></tr>

        <tr><td style="padding:18px 24px 4px;">
          <p style="margin:0 4px 6px;font-family:Fredoka,sans-serif;font-weight:700;font-size:11px;letter-spacing:.2em;color:#E94B7E;text-transform:uppercase;">📸 The leaderboard you&rsquo;re going to climb</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFF7E6;border:3px solid #1B2A4E;border-radius:18px;box-shadow:4px 4px 0 #1B2A4E;">
            <tr><td style="padding:14px 16px 6px;">
              <div style="font-family:Fredoka,sans-serif;font-weight:700;font-size:16px;color:#1B0440;">🏆 Predictor Leaderboard <span style="float:right;font-size:11px;color:#3B4A7E;font-weight:600;letter-spacing:.06em;">live</span></div>
            </td></tr>
            ${leaderboardRows
              .map(
                (r) => `
              <tr><td style="padding:6px 16px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="${r.you ? "background:#FFD93D;" : "background:#FFFFFF;"}border:2px solid #1B2A4E;border-radius:10px;">
                  <tr>
                    <td width="36" style="padding:8px 0 8px 12px;font-family:Fredoka,sans-serif;font-weight:700;font-size:18px;color:#1B0440;">${r.medal}</td>
                    <td style="padding:8px 8px;font-family:Fredoka,sans-serif;font-weight:700;font-size:15px;color:#1B0440;">${esc(r.name)}${r.you ? ' <span style="display:inline-block;background:#FF6B9D;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;margin-left:6px;">YOU</span>' : ""}</td>
                    <td style="padding:8px 8px;font-family:Quicksand,sans-serif;font-size:11px;color:#3B4A7E;text-align:right;">${r.correct} correct</td>
                    <td width="60" style="padding:8px 12px 8px 8px;font-family:Fredoka,sans-serif;font-weight:700;font-size:18px;color:#E94B7E;text-align:right;">${r.pts}<span style="font-size:10px;color:#3B4A7E;"> pts</span></td>
                  </tr>
                </table>
              </td></tr>`
              )
              .join("")}
            <tr><td style="padding:6px 16px 14px;font-family:Quicksand,sans-serif;font-size:11px;color:#3B4A7E;text-align:center;">↑ that #1 spot is currently unoccupied</td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:18px 24px 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(135deg,#FFCC00 0%,#FF6B00 100%);border:3px solid #1B2A4E;border-radius:18px;box-shadow:4px 4px 0 #1B2A4E;">
            <tr><td align="center" style="padding:18px 22px;">
              <img src="https://quiz.miaswebsites.art/email-assets/crown.gif" width="92" height="80" alt="" style="display:block;width:92px;height:80px;margin:0 auto 4px;"/>
              <div style="font-family:Fredoka,sans-serif;font-weight:700;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#1B0440;">The grand prize</div>
              <div style="font-family:Fredoka,sans-serif;font-weight:700;font-size:24px;color:#1B0440;line-height:1.15;margin-top:6px;">${esc(prizeLine)}</div>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:22px 36px 4px;">
          <p style="margin:0 0 10px;font-family:Fredoka,sans-serif;font-weight:700;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#1B2A4E;">⚙️ How it works</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${stepCopy
              .map(
                (step, i) => `
              <tr>
                <td width="36" valign="top" style="padding:6px 12px 6px 0;">
                  <div style="width:28px;height:28px;border-radius:999px;background:#FF6B9D;color:#fff;font-family:Fredoka,sans-serif;font-weight:700;font-size:14px;text-align:center;line-height:26px;border:2px solid #1B2A4E;">${i + 1}</div>
                </td>
                <td style="padding:6px 0;font-family:Quicksand,sans-serif;font-size:15px;color:#1B2A4E;line-height:1.55;">${step}</td>
              </tr>`
              )
              .join("")}
          </table>
        </td></tr>

        <tr><td style="padding:14px 24px 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="50%" valign="top" style="padding:6px;">
                <div style="background:#FFFFFF;border:3px solid #1B2A4E;border-radius:14px;box-shadow:3px 3px 0 #1B2A4E;padding:12px 14px;">
                  <p style="margin:0;font-family:Quicksand,sans-serif;font-size:13px;font-style:italic;color:#1B2A4E;line-height:1.5;">&ldquo;I lost my March Madness bracket. THIS bracket I&rsquo;m gonna win.&rdquo;</p>
                  <p style="margin:6px 0 0;font-family:Fredoka,sans-serif;font-weight:700;font-size:11px;letter-spacing:.06em;color:#E94B7E;">— Some guy who emailed us</p>
                </div>
              </td>
              <td width="50%" valign="top" style="padding:6px;">
                <div style="background:#FFFFFF;border:3px solid #1B2A4E;border-radius:14px;box-shadow:3px 3px 0 #1B2A4E;padding:12px 14px;">
                  <p style="margin:0;font-family:Quicksand,sans-serif;font-size:13px;font-style:italic;color:#1B2A4E;line-height:1.5;">&ldquo;Finally, a way to lord over my family without spending money.&rdquo;</p>
                  <p style="margin:6px 0 0;font-family:Fredoka,sans-serif;font-weight:700;font-size:11px;letter-spacing:.06em;color:#E94B7E;">— a verified pre-existing customer</p>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td align="center" style="padding:26px 36px 6px;">
          <a href="${esc(ctaUrl)}" style="display:inline-block;background:linear-gradient(180deg,#FFCC00 0%,#FF6B00 100%);color:#1B0440;padding:20px 38px;border:4px solid #1B2A4E;border-radius:16px;box-shadow:6px 6px 0 #1B2A4E;font-family:Fredoka,sans-serif;font-weight:700;font-size:24px;text-decoration:none;letter-spacing:.04em;text-transform:uppercase;">▶ Claim Your Picks</a>
          <p style="margin:10px 4px 0;font-family:Fredoka,sans-serif;font-weight:700;font-size:11px;letter-spacing:.16em;color:#1B2A4E;text-transform:uppercase;">No fee. No money. No regret. Just glory.</p>
        </td></tr>

        <tr><td style="padding:18px 36px 8px;">
          <div style="margin:6px 0 4px;font-family:Fredoka,sans-serif;">
            <p style="margin:0;font-weight:600;font-size:16px;color:#1B2A4E;">See you at the top of the board,</p>
            <p style="margin:6px 0 0;font-weight:700;font-size:32px;color:#E94B7E;line-height:1;">— Sam</p>
            <p style="margin:6px 0 0;font-family:Quicksand,sans-serif;font-size:13px;color:#3B4A7E;">Site administrator&nbsp;·&nbsp;Mia&rsquo;s Quiz Tournament</p>
          </div>
        </td></tr>

        <tr><td style="padding:8px 36px 16px;">
          <p style="margin:14px 0 0;padding:14px;background:#F4ECFF;border:2px dashed #B23AFF;border-radius:10px;font-family:Quicksand,sans-serif;font-size:10px;line-height:1.45;color:#3B1F70;">
            <strong style="text-transform:uppercase;letter-spacing:.1em;">Required disclosures:</strong>
            Bracket Pick&rsquo;Em is a strategic skill-based competition between consenting tournament participants and is <em>not gambling</em>. No money, fiat, crypto, vintage Pokémon cards, or other items of monetary value will be wagered, exchanged, or otherwise change hands at any point. Past predictions do not guarantee future results. Players of all ages are welcome and in fact encouraged. Please do not consult a financial advisor before participating; consult Mia. Bracket Pick&rsquo;Em is brought to you by The Quiz Book, a wholly-owned subsidiary of an 8-year-old. By tapping a button you agree to be a good sport. Void where prohibited by parents. Side effects may include bragging.
          </p>
        </td></tr>

        <tr><td style="padding:0;line-height:0;font-size:0;">
          <div style="background:#7BC4A4;border-top:3px solid #1B2A4E;height:48px;">&nbsp;</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    return { subject: finalSubject, html, text };
  },
};

const NEW_AUTH_AND_MIAMAIL: EmailTemplate = {
  id: "new-auth-and-miamail",
  name: "New sign-in + Miamail",
  description:
    "Heads-up: we've moved sign-in over to Auth0 (six-digit code instead of magic link) and shipped Miamail, the in-app inbox where every email you've ever sent shows up.",
  defaultSubject:
    "Two upgrades on Mia's Quiz Tournament — new sign-in + Miamail 📬",
  fields: [
    {
      key: "intro",
      label: "Opener",
      kind: "textarea",
      defaultValue:
        "Quick one — two changes landed on Mia's Quiz Tournament that you'll notice next time you sign in. Nothing's broken, your account is exactly the same, but the door looks a little different.",
      rows: 3,
      maxLength: 600,
    },
    {
      key: "authBlurb",
      label: "Auth0 explainer",
      kind: "textarea",
      defaultValue:
        "Sign-in is now powered by Auth0. Instead of a magic link in your inbox, you'll get a six-digit code on the Auth0 page — type it in and you're back. Same email address, same account, same data. The login screen is at the same place: just click \"Continue with Auth0\".",
      rows: 4,
      maxLength: 800,
    },
    {
      key: "miamailBlurb",
      label: "Miamail explainer",
      kind: "textarea",
      defaultValue:
        "Miamail is a brand-new inbox baked right into the site. Every email I send you — schedule notes, bracket updates, tiebreaker quizzes, this very email — shows up in your Miamail. So if you lose one in your real inbox, it's still there. Tap the 📬 Miamail button in the nav after you sign in.",
      rows: 4,
      maxLength: 800,
    },
    {
      key: "logoutNote",
      label: "Forced sign-out note",
      kind: "textarea",
      defaultValue:
        "I've signed everyone out across the board so the next time you visit, you'll go through the new flow once. Takes thirty seconds. Promise.",
      rows: 3,
      maxLength: 600,
    },
    {
      key: "outro",
      label: "Closing",
      kind: "textarea",
      defaultValue:
        "Any weirdness, just reply to this email. Have fun!",
      rows: 2,
      maxLength: 400,
    },
  ],
  render({ subject, fields }) {
    const intro = getField(this, fields, "intro");
    const authBlurb = getField(this, fields, "authBlurb");
    const miamailBlurb = getField(this, fields, "miamailBlurb");
    const logoutNote = getField(this, fields, "logoutNote");
    const outro = getField(this, fields, "outro");
    const finalSubject = subject.trim() || this.defaultSubject;

    const text = [
      "Mia's Quiz Tournament",
      "Two upgrades — what changed",
      "(From Sam, site admin)",
      "",
      "Hi {firstName}!",
      "",
      intro,
      "",
      "1. New sign-in via Auth0",
      authBlurb,
      "",
      "2. Miamail — your in-app inbox",
      miamailBlurb,
      "",
      logoutNote,
      "",
      outro,
      "",
      "Sign in: https://quiz.miaswebsites.art/signin",
      "",
      "— Sam",
      "Site administrator · Mia's Quiz Tournament",
    ].join("\n");

    const paragraph = (s: string) =>
      `<p style="margin:0 0 14px;font-family:Quicksand,system-ui,sans-serif;font-size:16px;line-height:1.65;color:#1B2A4E;">${esc(
        s
      )}</p>`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(finalSubject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
</style>
</head>
<body style="margin:0;padding:0;background:#B7E5FF;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">New sign-in flow + Miamail inbox — quick walkthrough.</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#B7E5FF;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:28px;box-shadow:8px 8px 0 0 #1B2A4E;">
          <tr>
            <td style="padding:36px 36px 8px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:14px;vertical-align:middle;">
                    <img src="https://quiz.miaswebsites.art/email-assets/sun.gif" width="64" height="64" alt="" style="display:block;width:64px;height:64px;"/>
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:24px;color:#1B2A4E;line-height:1;">Mia&rsquo;s Quiz Tournament</p>
                    <p style="margin:4px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:13px;color:#E94B7E;letter-spacing:.05em;text-transform:uppercase;">Two upgrades — what changed</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:22px;">
                <tr>
                  <td align="right">
                    <span style="display:inline-block;background:#87CEEB;color:#1B2A4E;padding:5px 14px;border-radius:999px;border:3px solid #1B2A4E;box-shadow:2px 2px 0 0 #1B2A4E;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;letter-spacing:.04em;">✉️&nbsp;FROM SAM, SITE ADMIN</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 8px 36px;">
              <h1 style="margin:0 0 16px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:30px;color:#1B2A4E;line-height:1.1;">Hi {firstName}!&nbsp;👋</h1>
              ${paragraph(intro)}

              <!-- Change 1: Auth0 -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0 18px;background:#FFD93D;border:3px solid #1B2A4E;border-radius:18px;box-shadow:4px 4px 0 0 #1B2A4E;">
                <tr>
                  <td style="padding:18px 22px 8px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="44" style="vertical-align:middle;padding-right:12px;">
                          <div style="width:36px;height:36px;border-radius:999px;background:#FF6B9D;border:3px solid #1B2A4E;text-align:center;line-height:30px;font-size:16px;box-shadow:2px 2px 0 0 #1B2A4E;">🔐</div>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;color:#3B4A7E;letter-spacing:.06em;text-transform:uppercase;">Change #1</p>
                          <p style="margin:2px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#1B2A4E;line-height:1.15;">New sign-in via Auth0</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 18px 22px;">
                    <p style="margin:8px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1B2A4E;">${esc(
                      authBlurb
                    )}</p>
                  </td>
                </tr>
              </table>

              <!-- Change 2: Miamail -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;background:#87CEEB;border:3px solid #1B2A4E;border-radius:18px;box-shadow:4px 4px 0 0 #1B2A4E;">
                <tr>
                  <td style="padding:18px 22px 8px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="44" style="vertical-align:middle;padding-right:12px;">
                          <div style="width:36px;height:36px;border-radius:999px;background:#FFFFFF;border:3px solid #1B2A4E;text-align:center;line-height:30px;font-size:16px;box-shadow:2px 2px 0 0 #1B2A4E;">📬</div>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;color:#3B4A7E;letter-spacing:.06em;text-transform:uppercase;">Change #2</p>
                          <p style="margin:2px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#1B2A4E;line-height:1.15;">Miamail — in-app inbox</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 18px 22px;">
                    <p style="margin:8px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1B2A4E;">${esc(
                      miamailBlurb
                    )}</p>
                  </td>
                </tr>
              </table>

              ${paragraph(logoutNote)}

              <!-- Big sign-in button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 18px;">
                <tr>
                  <td align="center">
                    <a href="https://quiz.miaswebsites.art/signin" style="display:inline-block;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:20px;color:#FFFFFF;text-decoration:none;background:#FF6B9D;border:3px solid #1B2A4E;border-radius:16px;box-shadow:4px 4px 0 0 #1B2A4E;padding:14px 32px;">
                      🚪&nbsp;Sign back in
                    </a>
                  </td>
                </tr>
              </table>

              ${paragraph(outro)}

              <div style="margin:28px 0 8px;">
                <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:16px;color:#1B2A4E;">Talk soon,</p>
                <p style="margin:6px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:36px;color:#E94B7E;line-height:1;">— Sam</p>
                <p style="margin:6px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:13px;color:#3B4A7E;">Site administrator&nbsp;·&nbsp;Mia&rsquo;s Quiz Tournament</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <div style="background:#7BC4A4;border-top:3px solid #1B2A4E;height:48px;border-bottom-left-radius:24px;border-bottom-right-radius:24px;">&nbsp;</div>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:11px;color:#3B4A7E;opacity:.8;">You&rsquo;re receiving this because you have an account on Mia&rsquo;s Quiz Tournament. Reply any time.</p>
      </td>
    </tr>
  </table>
</body></html>`;

    return { subject: finalSubject, html, text };
  },
};

const ROUND_SCHEDULED: EmailTemplate = {
  id: "round-scheduled",
  name: "Round scheduled · save the date",
  description:
    "Heads-up that a round is on the calendar. Use BEFORE the round goes live to give players a window to plan around. Pairs naturally with the 'Round started · go play' template when the doors actually open.",
  defaultSubject: "Save the date — Round {chapterNumber} drops {liveDateShort}",
  fields: [
    {
      key: "chapterNumber",
      label: "Round / chapter number",
      kind: "text",
      defaultValue: "2",
      hint: "Goes in the subject and the big card heading.",
      maxLength: 8,
    },
    {
      key: "roundTitle",
      label: "Round title (the picture-book chapter name)",
      kind: "text",
      defaultValue: "What's Bigger?",
      hint: "Shown right under the chapter number.",
      maxLength: 80,
    },
    {
      key: "liveTime",
      label: "When the round goes live",
      kind: "text",
      defaultValue: "Sunday · 7:00 PM",
      hint: "The full human-readable time. Shows in the schedule card.",
      maxLength: 60,
    },
    {
      key: "liveDateShort",
      label: "Short date (for subject line)",
      kind: "text",
      defaultValue: "Sunday",
      hint: "Slots into the default subject. Keep it punchy.",
      maxLength: 20,
    },
    {
      key: "deadline",
      label: "Deadline to finish",
      kind: "text",
      defaultValue: "Tuesday · 9:00 PM",
      maxLength: 60,
    },
    {
      key: "questionCount",
      label: "Roughly how many questions",
      kind: "text",
      defaultValue: "15",
      maxLength: 6,
    },
    {
      key: "topicTeaser",
      label: "Topic teaser",
      kind: "textarea",
      defaultValue:
        "This round is a size showdown — fifteen tiny match-ups where you pick what's bigger. No homework needed, no era trivia, no \"did you grow up with this.\" Just stuff that's been the same size for thousands of years.",
      rows: 3,
      maxLength: 600,
    },
    {
      key: "prepTips",
      label: "What to expect (light prep tips)",
      kind: "textarea",
      defaultValue:
        "It opens at the time above and stays open for the full window — play whenever you have a clear ten minutes. The clock doesn't matter; the score does. One attempt only.",
      rows: 3,
      maxLength: 600,
    },
  ],
  render({ subject, fields }) {
    const chapterNumber = getField(this, fields, "chapterNumber");
    const roundTitle = getField(this, fields, "roundTitle");
    const liveTime = getField(this, fields, "liveTime");
    const liveDateShort = getField(this, fields, "liveDateShort");
    const deadline = getField(this, fields, "deadline");
    const questionCount = getField(this, fields, "questionCount");
    const topicTeaser = getField(this, fields, "topicTeaser");
    const prepTips = getField(this, fields, "prepTips");
    // Subject merge — replace {chapterNumber} and {liveDateShort} tokens.
    const finalSubject =
      (subject.trim() || this.defaultSubject)
        .replace(/\{chapterNumber\}/g, chapterNumber)
        .replace(/\{liveDateShort\}/g, liveDateShort);

    const text = [
      "Mia's Quiz Tournament",
      `Round ${chapterNumber} · save the date`,
      "(From Sam, site admin)",
      "",
      "Hi {firstName}!",
      "",
      `Round ${chapterNumber} — "${roundTitle}" — is on the calendar.`,
      "",
      "Schedule:",
      `  • Goes live: ${liveTime}`,
      `  • Deadline:  ${deadline}`,
      `  • Length:    about ${questionCount} questions`,
      "",
      topicTeaser,
      "",
      prepTips,
      "",
      "I'll send another email the moment it opens.",
      "",
      "— Sam",
      "Site administrator · Mia's Quiz Tournament",
    ].join("\n");

    const paragraph = (s: string) =>
      `<p style="margin:0 0 14px;font-family:Quicksand,system-ui,sans-serif;font-size:16px;line-height:1.65;color:#1B2A4E;">${esc(
        s
      )}</p>`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(finalSubject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
</style>
</head>
<body style="margin:0;padding:0;background:#B7E5FF;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">Round ${esc(
    chapterNumber
  )} drops ${esc(liveDateShort)}. Save the date.</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#B7E5FF;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:28px;box-shadow:8px 8px 0 0 #1B2A4E;">
          <tr>
            <td style="padding:36px 36px 8px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:14px;vertical-align:middle;">
                    <img src="https://quiz.miaswebsites.art/email-assets/sun.gif" width="64" height="64" alt="" style="display:block;width:64px;height:64px;"/>
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:24px;color:#1B2A4E;line-height:1;">Mia&rsquo;s Quiz Tournament</p>
                    <p style="margin:4px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:13px;color:#E94B7E;letter-spacing:.05em;text-transform:uppercase;">📅&nbsp;Save the date</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:22px;">
                <tr>
                  <td align="right">
                    <span style="display:inline-block;background:#87CEEB;color:#1B2A4E;padding:5px 14px;border-radius:999px;border:3px solid #1B2A4E;box-shadow:2px 2px 0 0 #1B2A4E;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;letter-spacing:.04em;">✉️&nbsp;FROM SAM, SITE ADMIN</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 8px 36px;">
              <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:13px;color:#3B4A7E;letter-spacing:.06em;text-transform:uppercase;">Hi {firstName} — heads up:</p>
              <h1 style="margin:6px 0 4px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:36px;color:#1B2A4E;line-height:1;">📖&nbsp;Round ${esc(
                chapterNumber
              )}</h1>
              <p style="margin:0 0 18px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#E94B7E;line-height:1.1;">${esc(
                roundTitle
              )}</p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;background:#B7E5FF;border:3px solid #1B2A4E;border-radius:16px;box-shadow:4px 4px 0 0 #1B2A4E;">
                <tr>
                  <td style="padding:16px 22px 6px 22px;">
                    <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:13px;color:#E94B7E;letter-spacing:.06em;text-transform:uppercase;">⏰&nbsp;The schedule</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 22px 6px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="52" style="padding:8px 12px 8px 0;vertical-align:middle;">
                          <div style="width:38px;height:38px;border-radius:999px;background:#FF6B9D;border:3px solid #1B2A4E;text-align:center;line-height:32px;font-size:18px;box-shadow:2px 2px 0 0 #1B2A4E;">🚀</div>
                        </td>
                        <td style="padding:8px 0;vertical-align:middle;">
                          <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:12px;color:#3B4A7E;letter-spacing:.06em;text-transform:uppercase;">Goes live</p>
                          <p style="margin:2px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:20px;color:#1B2A4E;line-height:1.2;">${esc(
                            liveTime
                          )}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px;">
                    <div style="border-top:2px dashed rgba(27,42,78,.22);height:0;line-height:0;font-size:0;">&nbsp;</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 22px 6px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="52" style="padding:8px 12px 8px 0;vertical-align:middle;">
                          <div style="width:38px;height:38px;border-radius:999px;background:#FFD93D;border:3px solid #1B2A4E;text-align:center;line-height:32px;font-size:18px;box-shadow:2px 2px 0 0 #1B2A4E;">🏁</div>
                        </td>
                        <td style="padding:8px 0;vertical-align:middle;">
                          <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:12px;color:#3B4A7E;letter-spacing:.06em;text-transform:uppercase;">Deadline</p>
                          <p style="margin:2px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:20px;color:#1B2A4E;line-height:1.2;">${esc(
                            deadline
                          )}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px;">
                    <div style="border-top:2px dashed rgba(27,42,78,.22);height:0;line-height:0;font-size:0;">&nbsp;</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 22px 16px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="52" style="padding:8px 12px 8px 0;vertical-align:middle;">
                          <div style="width:38px;height:38px;border-radius:999px;background:#7DD87D;border:3px solid #1B2A4E;text-align:center;line-height:32px;font-size:18px;box-shadow:2px 2px 0 0 #1B2A4E;">📝</div>
                        </td>
                        <td style="padding:8px 0;vertical-align:middle;">
                          <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:12px;color:#3B4A7E;letter-spacing:.06em;text-transform:uppercase;">Length</p>
                          <p style="margin:2px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:20px;color:#1B2A4E;line-height:1.2;">~${esc(
                            questionCount
                          )} questions</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${paragraph(topicTeaser)}
              ${paragraph(prepTips)}
              ${paragraph(
                "I'll fire off a second email the moment the doors open — that one has the play button."
              )}

              <div style="margin:28px 0 8px;">
                <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:16px;color:#1B2A4E;">See you Sunday,</p>
                <p style="margin:6px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:36px;color:#E94B7E;line-height:1;">— Sam</p>
                <p style="margin:6px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:13px;color:#3B4A7E;">Site administrator&nbsp;·&nbsp;Mia&rsquo;s Quiz Tournament</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <div style="background:#7BC4A4;border-top:3px solid #1B2A4E;height:48px;border-bottom-left-radius:24px;border-bottom-right-radius:24px;">&nbsp;</div>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:11px;color:#3B4A7E;opacity:.8;">You&rsquo;re receiving this because you&rsquo;re in Mia&rsquo;s Quiz Tournament. Reply any time.</p>
      </td>
    </tr>
  </table>
</body></html>`;

    return { subject: finalSubject, html, text };
  },
};

const ROUND_STARTED: EmailTemplate = {
  id: "round-started",
  name: "Round started · go play",
  description:
    "Doors-are-open email. Sent the moment the round goes live. Big play button at the top, deadline reminder, lives reminder. Pairs with 'Round scheduled · save the date'.",
  defaultSubject: "🚪 Round {chapterNumber} is open — go play!",
  fields: [
    {
      key: "chapterNumber",
      label: "Round / chapter number",
      kind: "text",
      defaultValue: "2",
      maxLength: 8,
    },
    {
      key: "roundTitle",
      label: "Round title",
      kind: "text",
      defaultValue: "What's Bigger?",
      maxLength: 80,
    },
    {
      key: "deadline",
      label: "Deadline to finish",
      kind: "text",
      defaultValue: "Tuesday · 9:00 PM",
      hint: "Shown big in the urgency card.",
      maxLength: 60,
    },
    {
      key: "questionCount",
      label: "Roughly how many questions",
      kind: "text",
      defaultValue: "15",
      maxLength: 6,
    },
    {
      key: "intro",
      label: "Opener",
      kind: "textarea",
      defaultValue:
        "It's go time. The round is open, the questions are loaded, and the bracket is watching. Hit the button below and you're in.",
      rows: 3,
      maxLength: 600,
    },
    {
      key: "rules",
      label: "Quick reminders",
      kind: "textarea",
      defaultValue:
        "One attempt only — when you submit, that's your final score. Take your time within the deadline window; the clock doesn't matter, accuracy does. If you skip the round entirely, you lose a heart ❤️.",
      rows: 3,
      maxLength: 600,
    },
    {
      key: "outro",
      label: "Closing line",
      kind: "textarea",
      defaultValue: "Good luck out there.",
      rows: 2,
      maxLength: 240,
    },
  ],
  render({ subject, fields }) {
    const chapterNumber = getField(this, fields, "chapterNumber");
    const roundTitle = getField(this, fields, "roundTitle");
    const deadline = getField(this, fields, "deadline");
    const questionCount = getField(this, fields, "questionCount");
    const intro = getField(this, fields, "intro");
    const rules = getField(this, fields, "rules");
    const outro = getField(this, fields, "outro");
    const finalSubject =
      (subject.trim() || this.defaultSubject)
        .replace(/\{chapterNumber\}/g, chapterNumber);

    const text = [
      "Mia's Quiz Tournament",
      `Round ${chapterNumber} · doors are open`,
      "(From Sam, site admin)",
      "",
      "Hi {firstName}!",
      "",
      `Round ${chapterNumber} — "${roundTitle}" — is live right now.`,
      "",
      intro,
      "",
      "→ Play now: https://quiz.miaswebsites.art/play",
      "",
      `Deadline: ${deadline}.`,
      `Length: about ${questionCount} questions.`,
      "",
      rules,
      "",
      outro,
      "",
      "— Sam",
      "Site administrator · Mia's Quiz Tournament",
    ].join("\n");

    const paragraph = (s: string) =>
      `<p style="margin:0 0 14px;font-family:Quicksand,system-ui,sans-serif;font-size:16px;line-height:1.65;color:#1B2A4E;">${esc(
        s
      )}</p>`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(finalSubject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
</style>
</head>
<body style="margin:0;padding:0;background:#B7E5FF;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">Round ${esc(
    chapterNumber
  )} is open. ${esc(intro.slice(0, 90))}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#B7E5FF;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:28px;box-shadow:8px 8px 0 0 #1B2A4E;">
          <tr>
            <td style="padding:36px 36px 8px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:14px;vertical-align:middle;">
                    <img src="https://quiz.miaswebsites.art/email-assets/sun.gif" width="64" height="64" alt="" style="display:block;width:64px;height:64px;"/>
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:24px;color:#1B2A4E;line-height:1;">Mia&rsquo;s Quiz Tournament</p>
                    <p style="margin:4px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:13px;color:#E94B7E;letter-spacing:.05em;text-transform:uppercase;">🚪&nbsp;The doors are open</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:22px;">
                <tr>
                  <td align="right">
                    <span style="display:inline-block;background:#87CEEB;color:#1B2A4E;padding:5px 14px;border-radius:999px;border:3px solid #1B2A4E;box-shadow:2px 2px 0 0 #1B2A4E;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;letter-spacing:.04em;">✉️&nbsp;FROM SAM, SITE ADMIN</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 8px 36px;">
              <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:13px;color:#3B4A7E;letter-spacing:.06em;text-transform:uppercase;">Hi {firstName} — it's go time:</p>
              <h1 style="margin:6px 0 4px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:40px;color:#1B2A4E;line-height:1;">📖&nbsp;Round ${esc(
                chapterNumber
              )} is live!</h1>
              <p style="margin:0 0 22px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#E94B7E;line-height:1.1;">${esc(
                roundTitle
              )}</p>

              ${paragraph(intro)}

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 22px;">
                <tr>
                  <td align="center">
                    <a href="https://quiz.miaswebsites.art/play" style="display:inline-block;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#FFFFFF;text-decoration:none;background:#FF6B9D;border:3px solid #1B2A4E;border-radius:18px;box-shadow:6px 6px 0 0 #1B2A4E;padding:16px 36px;">
                      ▶&nbsp;&nbsp;Play Round ${esc(chapterNumber)}
                    </a>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;background:#FFD93D;border:3px solid #1B2A4E;border-radius:16px;box-shadow:4px 4px 0 0 #1B2A4E;">
                <tr>
                  <td style="padding:14px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="52" style="padding:0 12px 0 0;vertical-align:middle;">
                          <div style="width:38px;height:38px;border-radius:999px;background:#FF6B9D;border:3px solid #1B2A4E;text-align:center;line-height:32px;font-size:18px;box-shadow:2px 2px 0 0 #1B2A4E;">🏁</div>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:12px;color:#3B4A7E;letter-spacing:.06em;text-transform:uppercase;">Submit before</p>
                          <p style="margin:2px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:20px;color:#1B2A4E;line-height:1.2;">${esc(
                            deadline
                          )}</p>
                        </td>
                        <td style="vertical-align:middle;text-align:right;">
                          <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:12px;color:#3B4A7E;letter-spacing:.06em;text-transform:uppercase;">Length</p>
                          <p style="margin:2px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:20px;color:#1B2A4E;line-height:1.2;">~${esc(
                            questionCount
                          )} qs</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${paragraph(rules)}
              ${paragraph(outro)}

              <div style="margin:28px 0 8px;">
                <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:16px;color:#1B2A4E;">Talk soon,</p>
                <p style="margin:6px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:36px;color:#E94B7E;line-height:1;">— Sam</p>
                <p style="margin:6px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:13px;color:#3B4A7E;">Site administrator&nbsp;·&nbsp;Mia&rsquo;s Quiz Tournament</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <div style="background:#7BC4A4;border-top:3px solid #1B2A4E;height:48px;border-bottom-left-radius:24px;border-bottom-right-radius:24px;">&nbsp;</div>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:11px;color:#3B4A7E;opacity:.8;">You&rsquo;re receiving this because you&rsquo;re in Mia&rsquo;s Quiz Tournament. Reply any time.</p>
      </td>
    </tr>
  </table>
</body></html>`;

    return { subject: finalSubject, html, text };
  },
};

const QOTD_ANNOUNCEMENT: EmailTemplate = {
  id: "qotd-announcement",
  name: "Question of the Day · launch",
  description:
    "Announces the new Question of the Day feature — a fresh fun question every morning, A/B/C/D + write-your-own, and players can suggest topics. Sized like a real launch email so people actually click.",
  defaultSubject:
    "🌞 New on Mia's Quiz: a Question of the Day — and you can suggest the topics",
  fields: [
    {
      key: "headline",
      label: "Big headline (top of card)",
      kind: "text",
      defaultValue: "Something fresh every morning ☀️",
      maxLength: 80,
    },
    {
      key: "intro",
      label: "Opener",
      kind: "textarea",
      defaultValue:
        "I shipped a tiny new thing on Mia's Quiz Tournament that I think you're going to love. Every morning at 7am, a brand-new Question of the Day pops up on the homepage. One question. Four options. Or, type your own answer and the AI tidies it up before it joins the board.",
      rows: 4,
      maxLength: 800,
    },
    {
      key: "howItWorks",
      label: "How it works",
      kind: "textarea",
      defaultValue:
        "It's right at the top of the homepage now — gold spotlight card you can't miss. Tap it, pick A/B/C/D, or hit \"Other\" and write whatever comes to mind. You'll see everyone else's answers on the board the second you submit yours. No scoring, no pressure, no streaks. Just a tiny daily check-in.",
      rows: 4,
      maxLength: 800,
    },
    {
      key: "suggestBlurb",
      label: "Suggest-a-question blurb",
      kind: "textarea",
      defaultValue:
        "Here's the fun part: you pick the topics. Every player gets two lifetime suggestions — drop a topic (\"weird animals\") or a specific question (\"what's the deepest lake?\") and the AI turns it into a real question with four options. Once your suggestion runs, that's it — choose wisely. Hit \"💡 Suggest a question\" once you're signed in.",
      rows: 4,
      maxLength: 800,
    },
    {
      key: "safetyNote",
      label: "Safety / vibe note",
      kind: "textarea",
      defaultValue:
        "Everything that goes on the board — the question, the options, every \"Other\" answer — runs through a safeguard first. So it's safe for Mia, safe for the group chat, and the vibe stays picture-book.",
      rows: 3,
      maxLength: 600,
    },
    {
      key: "outro",
      label: "Closing line",
      kind: "textarea",
      defaultValue:
        "Today's question is already up. Go take a look — and please, suggest something good.",
      rows: 2,
      maxLength: 400,
    },
  ],
  render({ subject, fields }) {
    const headline = getField(this, fields, "headline");
    const intro = getField(this, fields, "intro");
    const howItWorks = getField(this, fields, "howItWorks");
    const suggestBlurb = getField(this, fields, "suggestBlurb");
    const safetyNote = getField(this, fields, "safetyNote");
    const outro = getField(this, fields, "outro");
    const finalSubject = subject.trim() || this.defaultSubject;

    const text = [
      "Mia's Quiz Tournament",
      "New: Question of the Day",
      "(From Sam, site admin)",
      "",
      "Hi {firstName}!",
      "",
      headline,
      "",
      intro,
      "",
      "How it works:",
      howItWorks,
      "",
      "You can suggest the topics:",
      suggestBlurb,
      "",
      safetyNote,
      "",
      outro,
      "",
      "Today's question: https://quiz.miaswebsites.art/qotd",
      "Suggest one: https://quiz.miaswebsites.art/qotd/recommend",
      "",
      "— Sam",
      "Site administrator · Mia's Quiz Tournament",
    ].join("\n");

    const paragraph = (s: string) =>
      `<p style="margin:0 0 14px;font-family:Quicksand,system-ui,sans-serif;font-size:16px;line-height:1.65;color:#1B2A4E;">${esc(
        s
      )}</p>`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(finalSubject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
</style>
</head>
<body style="margin:0;padding:0;background:#B7E5FF;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">A new Question of the Day drops on the site every morning — and you can suggest the topics.</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#B7E5FF;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:28px;box-shadow:8px 8px 0 0 #1B2A4E;">
          <tr>
            <td style="padding:36px 36px 8px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:14px;vertical-align:middle;">
                    <img src="https://quiz.miaswebsites.art/email-assets/sun.gif" width="64" height="64" alt="" style="display:block;width:64px;height:64px;"/>
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:24px;color:#1B2A4E;line-height:1;">Mia&rsquo;s Quiz Tournament</p>
                    <p style="margin:4px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:13px;color:#E94B7E;letter-spacing:.05em;text-transform:uppercase;">New · Question of the Day</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:22px;">
                <tr>
                  <td align="right">
                    <span style="display:inline-block;background:#87CEEB;color:#1B2A4E;padding:5px 14px;border-radius:999px;border:3px solid #1B2A4E;box-shadow:2px 2px 0 0 #1B2A4E;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;letter-spacing:.04em;">✉️&nbsp;FROM SAM, SITE ADMIN</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 8px 36px;">
              <h1 style="margin:0 0 16px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:30px;color:#1B2A4E;line-height:1.1;">Hi {firstName}!&nbsp;💡</h1>

              <!-- Big spotlight headline card -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 22px;background:linear-gradient(135deg,#FFE873 0%,#FFD93D 60%,#FFC100 100%);border:4px solid #1B2A4E;border-radius:22px;box-shadow:6px 6px 0 0 #1B2A4E;">
                <tr>
                  <td style="padding:24px 24px 22px 24px;text-align:center;">
                    <p style="margin:0 0 6px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;color:#E94B7E;letter-spacing:.18em;text-transform:uppercase;">✨ Brand new feature</p>
                    <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:30px;color:#1B2A4E;line-height:1.15;">${esc(
                      headline
                    )}</p>
                    <p style="margin:14px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:14px;color:#1B2A4E;opacity:.85;">A fresh question every morning · A/B/C/D or your own answer · You pick the topics</p>
                  </td>
                </tr>
              </table>

              ${paragraph(intro)}

              <!-- How it works -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 18px;background:#87CEEB;border:3px solid #1B2A4E;border-radius:18px;box-shadow:4px 4px 0 0 #1B2A4E;">
                <tr>
                  <td style="padding:18px 22px 8px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="44" style="vertical-align:middle;padding-right:12px;">
                          <div style="width:36px;height:36px;border-radius:999px;background:#FFFFFF;border:3px solid #1B2A4E;text-align:center;line-height:30px;font-size:16px;box-shadow:2px 2px 0 0 #1B2A4E;">🎯</div>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;color:#3B4A7E;letter-spacing:.06em;text-transform:uppercase;">How it works</p>
                          <p style="margin:2px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#1B2A4E;line-height:1.15;">Tap, pick, or write your own</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 18px 22px;">
                    <p style="margin:8px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1B2A4E;">${esc(
                      howItWorks
                    )}</p>
                  </td>
                </tr>
              </table>

              <!-- Suggest a topic -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;background:#FF6B9D;border:3px solid #1B2A4E;border-radius:18px;box-shadow:4px 4px 0 0 #1B2A4E;">
                <tr>
                  <td style="padding:18px 22px 8px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="44" style="vertical-align:middle;padding-right:12px;">
                          <div style="width:36px;height:36px;border-radius:999px;background:#FFD93D;border:3px solid #1B2A4E;text-align:center;line-height:30px;font-size:16px;box-shadow:2px 2px 0 0 #1B2A4E;">💡</div>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;color:#FFD93D;letter-spacing:.06em;text-transform:uppercase;">Your move</p>
                          <p style="margin:2px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#FFFFFF;line-height:1.15;">Suggest the questions</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 18px 22px;">
                    <p style="margin:8px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#FFFFFF;">${esc(
                      suggestBlurb
                    )}</p>
                  </td>
                </tr>
              </table>

              ${paragraph(safetyNote)}

              <!-- Two CTAs side by side, with stack-on-mobile fallback -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 12px;">
                <tr>
                  <td align="center" style="padding:0 0 12px 0;">
                    <a href="https://quiz.miaswebsites.art/qotd" style="display:inline-block;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:20px;color:#FFFFFF;text-decoration:none;background:#FF6B9D;border:3px solid #1B2A4E;border-radius:16px;box-shadow:4px 4px 0 0 #1B2A4E;padding:14px 28px;">
                      🌞&nbsp;See today&rsquo;s question
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="https://quiz.miaswebsites.art/qotd/recommend" style="display:inline-block;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:16px;color:#1B2A4E;text-decoration:none;background:#FFFFFF;border:3px solid #1B2A4E;border-radius:14px;box-shadow:3px 3px 0 0 #1B2A4E;padding:11px 22px;">
                      💡&nbsp;Suggest a question
                    </a>
                  </td>
                </tr>
              </table>

              ${paragraph(outro)}

              <div style="margin:28px 0 8px;">
                <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:16px;color:#1B2A4E;">Have fun,</p>
                <p style="margin:6px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:36px;color:#E94B7E;line-height:1;">— Sam</p>
                <p style="margin:6px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:13px;color:#3B4A7E;">Site administrator&nbsp;·&nbsp;Mia&rsquo;s Quiz Tournament</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <div style="background:#7BC4A4;border-top:3px solid #1B2A4E;height:48px;border-bottom-left-radius:24px;border-bottom-right-radius:24px;">&nbsp;</div>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:11px;color:#3B4A7E;opacity:.8;">You&rsquo;re receiving this because you have an account on Mia&rsquo;s Quiz Tournament. Reply any time.</p>
      </td>
    </tr>
  </table>
</body></html>`;

    return { subject: finalSubject, html, text };
  },
};

const GRAND_FINAL_HYPE: EmailTemplate = {
  id: "grand-final-hype",
  name: "Grand Final · hype + format (DEPRECATED — live edition)",
  description:
    "[Pre-taped season: superseded by PRETAPED_CHANGE_OF_PLANS.] The original big-night announcement for the live broadcast format. Kept so existing template archives still render, but don't send this without rewriting the fields — it announces a live show that's been cancelled.",
  defaultSubject:
    "🏆 The Grand Final {liveDateShort} — you don't want to miss this",
  fields: [
    {
      key: "finalistA",
      label: "Finalist A name",
      kind: "text",
      defaultValue: "Finalist A",
      hint: "Used in the matchup line. Just first name is fine.",
      maxLength: 40,
    },
    {
      key: "finalistB",
      label: "Finalist B name",
      kind: "text",
      defaultValue: "Finalist B",
      maxLength: 40,
    },
    {
      key: "liveTime",
      label: "When",
      kind: "text",
      defaultValue: "Sunday · 7:00 PM ET",
      hint: "Full human-readable time. Shows in the hero card.",
      maxLength: 60,
    },
    {
      key: "liveDateShort",
      label: "Short date (subject line)",
      kind: "text",
      defaultValue: "Sunday",
      maxLength: 20,
    },
    {
      key: "watchUrl",
      label: "Where to watch (broadcast URL)",
      kind: "text",
      defaultValue: "https://youtube.com/live/your-stream-id",
      hint: "YouTube Live / Twitch / Streamyard / Discord — wherever the stream is.",
      maxLength: 300,
    },
    {
      key: "headline",
      label: "Opener headline",
      kind: "text",
      defaultValue: "Two players. One trophy. Live.",
      maxLength: 80,
    },
    {
      key: "intro",
      label: "Opener body",
      kind: "textarea",
      defaultValue:
        "We made it. After weeks of bracket chaos, two players are still standing — and they're going head-to-head LIVE on the site. I'll be hosting on camera, both finalists will be on the stream, and the rest of you tune in to watch in real time and yell at your screen.",
      rows: 4,
      maxLength: 800,
    },
    {
      key: "formatBlurb",
      label: "Format explainer",
      kind: "textarea",
      defaultValue:
        "Here's how it works: I drive the round live from my laptop, and every screen on the site stays in sync. A new question pops up, I read it aloud (the site can do it for me too — TTS!), both finalists have 30 seconds to lock in their answer, and at the end of each question we reveal who picked what. Wrong answers get tomato'd. Right answers get confetti. The scoreboard updates live. Ten questions, sudden-death tiebreaker if it's even.",
      rows: 5,
      maxLength: 1000,
    },
    {
      key: "howToWatch",
      label: "How to watch + interact",
      kind: "textarea",
      defaultValue:
        "Open the broadcast link below at the start time. The questions show up on the stream, but you can also pull up the spectator page on the site (you'll get a 🔴 LIVE banner the second I start the round) so the answers and timer are RIGHT in front of you on your phone. Cheer in the stream chat. Or just watch and judge silently like a true family member.",
      rows: 5,
      maxLength: 1000,
    },
    {
      key: "outro",
      label: "Closing",
      kind: "textarea",
      defaultValue:
        "Set a reminder. Show up. Bring snacks. This is the big one.",
      rows: 2,
      maxLength: 400,
    },
  ],
  render({ subject, fields }) {
    const finalistA = getField(this, fields, "finalistA");
    const finalistB = getField(this, fields, "finalistB");
    const liveTime = getField(this, fields, "liveTime");
    const liveDateShort = getField(this, fields, "liveDateShort");
    const watchUrl = getField(this, fields, "watchUrl");
    const headline = getField(this, fields, "headline");
    const intro = getField(this, fields, "intro");
    const formatBlurb = getField(this, fields, "formatBlurb");
    const howToWatch = getField(this, fields, "howToWatch");
    const outro = getField(this, fields, "outro");
    const finalSubject = (subject || this.defaultSubject)
      .replace("{liveDateShort}", liveDateShort)
      .trim();

    const text = [
      "Mia's Quiz Tournament",
      "🏆 The Grand Final — LIVE",
      "(From Sam, site admin)",
      "",
      "Hi {firstName}!",
      "",
      headline,
      "",
      `${finalistA} vs ${finalistB}`,
      `When: ${liveTime}`,
      `Watch: ${watchUrl}`,
      "",
      intro,
      "",
      "Format:",
      formatBlurb,
      "",
      "How to watch:",
      howToWatch,
      "",
      outro,
      "",
      "— Sam",
      "Site administrator · Mia's Quiz Tournament",
    ].join("\n");

    const paragraph = (s: string) =>
      `<p style="margin:0 0 14px;font-family:Quicksand,system-ui,sans-serif;font-size:16px;line-height:1.65;color:#1B2A4E;">${esc(
        s
      )}</p>`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(finalSubject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
</style>
</head>
<body style="margin:0;padding:0;background:#B7E5FF;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${esc(
    finalistA
  )} vs ${esc(finalistB)} · live ${esc(
      liveDateShort
    )} · format inside.</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#B7E5FF;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:28px;box-shadow:8px 8px 0 0 #1B2A4E;">
          <tr>
            <td style="padding:36px 36px 8px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:14px;vertical-align:middle;">
                    <img src="https://quiz.miaswebsites.art/email-assets/sun.gif" width="64" height="64" alt="" style="display:block;width:64px;height:64px;"/>
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:24px;color:#1B2A4E;line-height:1;">Mia&rsquo;s Quiz Tournament</p>
                    <p style="margin:4px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:13px;color:#E94B7E;letter-spacing:.05em;text-transform:uppercase;">🏆 The Grand Final · LIVE</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:22px;">
                <tr>
                  <td align="right">
                    <span style="display:inline-block;background:#FF4D6D;color:#FFFFFF;padding:5px 14px;border-radius:999px;border:3px solid #1B2A4E;box-shadow:2px 2px 0 0 #1B2A4E;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;letter-spacing:.04em;">🔴&nbsp;LIVE BROADCAST</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 8px 36px;">
              <h1 style="margin:0 0 16px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:30px;color:#1B2A4E;line-height:1.1;">Hi {firstName}!&nbsp;🎙️</h1>

              <!-- Hero hype card -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 22px;border:4px solid #1B2A4E;border-radius:22px;box-shadow:8px 8px 0 0 #1B2A4E;">
                <tr>
                  <td style="padding:26px 24px 24px 24px;text-align:center;background:linear-gradient(135deg,#FF6B9D 0%,#FF4D6D 35%,#FF8C42 70%,#FFB627 100%);border-radius:18px;">
                    <p style="margin:0 0 6px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;color:#FFFFFF;letter-spacing:.22em;text-transform:uppercase;">The Grand Final</p>
                    <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:28px;color:#FFFFFF;line-height:1.1;text-shadow:3px 3px 0 #1B2A4E;">${esc(
                      headline
                    )}</p>
                    <p style="margin:18px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:34px;color:#FFFFFF;line-height:1.1;text-shadow:3px 3px 0 #1B2A4E;">${esc(
                      finalistA
                    )}<br/><span style="font-size:16px;opacity:.9;">vs</span><br/>${esc(
                      finalistB
                    )}</p>
                    <div style="margin-top:18px;display:inline-block;background:#FFFFFF;color:#1B2A4E;border:3px solid #1B2A4E;border-radius:14px;padding:8px 16px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:18px;box-shadow:3px 3px 0 0 #1B2A4E;">⏰&nbsp;${esc(
                      liveTime
                    )}</div>
                  </td>
                </tr>
              </table>

              ${paragraph(intro)}

              <!-- Format card -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 18px;background:#FFD93D;border:3px solid #1B2A4E;border-radius:18px;box-shadow:4px 4px 0 0 #1B2A4E;">
                <tr>
                  <td style="padding:18px 22px 8px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="44" style="vertical-align:middle;padding-right:12px;">
                          <div style="width:36px;height:36px;border-radius:999px;background:#FFFFFF;border:3px solid #1B2A4E;text-align:center;line-height:30px;font-size:16px;box-shadow:2px 2px 0 0 #1B2A4E;">🎯</div>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;color:#3B4A7E;letter-spacing:.06em;text-transform:uppercase;">Format</p>
                          <p style="margin:2px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#1B2A4E;line-height:1.15;">10 questions · 30 seconds each</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 18px 22px;">
                    <p style="margin:8px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1B2A4E;">${esc(
                      formatBlurb
                    )}</p>
                  </td>
                </tr>
              </table>

              <!-- How to watch -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;background:#87CEEB;border:3px solid #1B2A4E;border-radius:18px;box-shadow:4px 4px 0 0 #1B2A4E;">
                <tr>
                  <td style="padding:18px 22px 8px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="44" style="vertical-align:middle;padding-right:12px;">
                          <div style="width:36px;height:36px;border-radius:999px;background:#FFFFFF;border:3px solid #1B2A4E;text-align:center;line-height:30px;font-size:16px;box-shadow:2px 2px 0 0 #1B2A4E;">📺</div>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;color:#3B4A7E;letter-spacing:.06em;text-transform:uppercase;">How to watch</p>
                          <p style="margin:2px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#1B2A4E;line-height:1.15;">Stream + spectator page</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 18px 22px;">
                    <p style="margin:8px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1B2A4E;">${esc(
                      howToWatch
                    )}</p>
                  </td>
                </tr>
              </table>

              <!-- Big watch-now button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 14px;">
                <tr>
                  <td align="center">
                    <a href="${esc(
                      watchUrl
                    )}" style="display:inline-block;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#FFFFFF;text-decoration:none;background:#FF4D6D;border:3px solid #1B2A4E;border-radius:16px;box-shadow:4px 4px 0 0 #1B2A4E;padding:16px 36px;">
                      🔴&nbsp;Watch the broadcast
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:12px;">
                    <a href="https://quiz.miaswebsites.art/play" style="display:inline-block;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:14px;color:#1B2A4E;text-decoration:none;background:#FFFFFF;border:3px solid #1B2A4E;border-radius:14px;box-shadow:3px 3px 0 0 #1B2A4E;padding:10px 22px;">
                      🎙️&nbsp;Open the spectator page
                    </a>
                  </td>
                </tr>
              </table>

              ${paragraph(outro)}

              <div style="margin:28px 0 8px;">
                <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:16px;color:#1B2A4E;">See you ${esc(
                  liveDateShort
                )},</p>
                <p style="margin:6px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:36px;color:#E94B7E;line-height:1;">— Sam</p>
                <p style="margin:6px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:13px;color:#3B4A7E;">Site administrator&nbsp;·&nbsp;Mia&rsquo;s Quiz Tournament</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <div style="background:#7BC4A4;border-top:3px solid #1B2A4E;height:48px;border-bottom-left-radius:24px;border-bottom-right-radius:24px;">&nbsp;</div>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:11px;color:#3B4A7E;opacity:.8;">You&rsquo;re receiving this because you have an account on Mia&rsquo;s Quiz Tournament. Reply any time.</p>
      </td>
    </tr>
  </table>
</body></html>`;

    return { subject: finalSubject, html, text };
  },
};

// ─── Finals trio (winners-finalist, losers-finalist, eliminated) ───────
//
// Three coordinated templates for the finals announcement. The two
// finalist variants walk recipients through forum sign-in + the NDA
// agreement step before they can see the briefing. The eliminated
// variant is public-friendly and just hypes the broadcast.
//
// Picture-book wrapper, condensed compared to GRAND_FINAL_HYPE.

function finalsShell(args: {
  bgColor: string;
  bannerText: string;
  bannerColor: string;
  title: string;
  bodyHtml: string;
}): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${args.bgColor};font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${args.bgColor};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 0 #1B2A4E;">
        <tr><td style="padding:30px 30px 8px;">
          <p style="margin:0;font-weight:700;font-size:22px;line-height:1;">🌞 Mia&rsquo;s Quiz Tournament</p>
          <p style="margin:6px 0 0;font-weight:600;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${args.bannerColor};">${args.bannerText}</p>
        </td></tr>
        <tr><td style="padding:14px 30px 28px;">
          <h1 style="margin:0 0 16px;font-weight:700;font-size:28px;line-height:1.15;">${args.title}</h1>
          ${args.bodyHtml}
          <hr style="border:none;border-top:2px dashed #B7E5FF;margin:24px 0"/>
          <p style="margin:0;font-size:13px;color:#3B4A7E;">— Sam &amp; Mia</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const FINALS_HYPE_WINNERS_FINALIST: EmailTemplate = {
  id: "finals-hype-winners-finalist",
  name: "Finals · winners-bracket finalist",
  description:
    "For the two players who advanced to the winners-bracket final. Hypes the finals (date TBD), walks them through Discourse sign-in + the NDA agreement step, and tells them the Finalist Briefing waits in Finals Room once they agree.",
  defaultSubject: "🏆 You're a winners-bracket FINALIST, {firstName} — read this carefully",
  fields: [
    {
      key: "openerLine",
      label: "Opening line",
      kind: "text",
      defaultValue: "You did it. You fought your way through every chapter of the bracket and you're one of the last two standing in the winners bracket.",
      maxLength: 400,
      hint: "Sets the celebratory tone before we shift into instructions.",
    },
    {
      key: "matchupLine",
      label: "Matchup line",
      kind: "text",
      defaultValue: "It's coming down to you and your opponent — winner advances to the championship.",
      maxLength: 200,
    },
  ],
  render({ subject, fields }) {
    const finalSubject =
      subject || "🏆 You're a winners-bracket FINALIST — read this carefully";
    const opener = fields.openerLine || "You did it.";
    const matchup = fields.matchupLine || "Winner advances to the championship.";
    const text = `Hi {firstName},

${opener}

${matchup}

The finals date is not yet locked — I'll send a calendar invite once it's set. Before then, there's a one-time access step.

⚠️ Important — confidentiality
From the moment you read this, you're under finals confidentiality. Don't tell anyone you're a finalist, don't research, don't compare notes with the other finalist. Details (especially the topic) need to stay inside the finalist circle.

Walk-through — please do this in the next 24 hours:

1. Open https://discuss.miaswebsites.art and click "Sign in" (top right). It bounces you through the main quiz site and right back.

2. As soon as you're in, the forum will send you a Personal Message titled "🔒 Finals access — confidentiality required". You'll find it in your inbox icon (top right). Click it.

3. Read the terms. Reply to the PM with the words "yes I agree".

4. Once you've replied, you'll get a confirmation message. The Finals Room category becomes visible to you. There's a pinned 📋 Finalist Briefing topic — read it once and drop a 👍 reply.

5. From now on, all finals coordination happens in Finals Room. Don't email about it.

If anything goes sideways during the walk-through (the PM doesn't show up, you can't reply, etc.), email me back and I'll fix it.

— Sam & Mia`;
    const body = `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Hi {firstName},</p>
<p style="margin:0 0 14px;font-size:16px;line-height:1.6;">${esc(opener)}</p>
<p style="margin:0 0 14px;font-size:16px;line-height:1.6;"><strong>${esc(matchup)}</strong></p>

<div style="margin:20px 0;padding:16px 18px;background:#FFE8EE;border:3px solid #C9296A;border-radius:14px;">
  <p style="margin:0 0 6px;font-weight:700;font-size:13px;color:#C9296A;letter-spacing:.06em;text-transform:uppercase;">⚠️ Confidentiality starts now</p>
  <p style="margin:0;font-size:14px;line-height:1.55;">From the moment you read this, you're under finals confidentiality. Don't tell anyone you're a finalist, don't research the format, don't compare notes with the other finalist. Topic + format details stay inside the circle.</p>
</div>

<p style="margin:0 0 10px;font-weight:700;font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:#3B4A7E;">📋 Walk-through (next 24h)</p>
<ol style="margin:0 0 18px 22px;padding:0;font-size:15px;line-height:1.6;">
  <li style="margin-bottom:10px;">Open <a href="https://discuss.miaswebsites.art" style="color:#E94B7E;text-decoration:underline;">discuss.miaswebsites.art</a> and click <strong>Sign in</strong> (top right). It bounces through the main quiz site and back.</li>
  <li style="margin-bottom:10px;">The forum sends you a Personal Message titled <strong>"🔒 Finals access — confidentiality required"</strong>. Find it in your inbox (top-right icon). Click in.</li>
  <li style="margin-bottom:10px;">Read the terms. Reply to the PM with the words <strong>"yes I agree"</strong>.</li>
  <li style="margin-bottom:10px;">You'll get a confirmation. The <strong>Finals Room</strong> category becomes visible. There's a pinned 📋 Finalist Briefing — read it, drop a 👍.</li>
  <li>From here on, all finals coordination happens in Finals Room. Not email.</li>
</ol>

<div style="margin:20px 0 6px;text-align:center;">
  <a href="https://discuss.miaswebsites.art" style="display:inline-block;background:#E94B7E;color:#FFFFFF;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E;padding:12px 28px;font-weight:700;font-size:16px;text-decoration:none;">→ Open the forum</a>
</div>

<p style="margin:18px 0 0;font-size:14px;color:#3B4A7E;">If anything sticks during the walk-through, just reply to this email and I'll fix it.</p>`;
    const html = finalsShell({
      bgColor: "#FFD93D",
      bannerText: "Winners bracket · finalist",
      bannerColor: "#C9296A",
      title: "🏆 You're in the winners final",
      bodyHtml: body,
    });
    return { subject: finalSubject, html, text };
  },
};

const FINALS_HYPE_LOSERS_FINALIST: EmailTemplate = {
  id: "finals-hype-losers-finalist",
  name: "Finals · losers-bracket finalist",
  description:
    "For the two players who fought their way back through the losers bracket and reached its final. Same NDA + walk-through as the winners variant, but reframed: they're one match away from the championship and it's the comeback story.",
  defaultSubject: "🥈 You're back, {firstName} — losers-bracket FINAL is yours",
  fields: [
    {
      key: "openerLine",
      label: "Opening line",
      kind: "text",
      defaultValue: "You took an early loss and refused to stay down. You ground your way back through the losers bracket and now you're one match from the championship.",
      maxLength: 400,
    },
    {
      key: "matchupLine",
      label: "Matchup line",
      kind: "text",
      defaultValue: "Win this and you face the winners-bracket champion in the grand final.",
      maxLength: 200,
    },
  ],
  render({ subject, fields }) {
    const finalSubject =
      subject || "🥈 You're a losers-bracket FINALIST — read this carefully";
    const opener = fields.openerLine || "You fought back.";
    const matchup =
      fields.matchupLine ||
      "Win this and you face the winners-bracket champion in the grand final.";
    const text = `Hi {firstName},

${opener}

${matchup}

The finals date is not yet locked — I'll send a calendar invite once it's set. Before then, there's a one-time access step.

⚠️ Important — confidentiality
From the moment you read this, you're under finals confidentiality. Don't tell anyone you're a finalist, don't research the format, don't compare notes with the other finalist (or anyone in the winners bracket).

Walk-through — please do this in the next 24 hours:

1. Open https://discuss.miaswebsites.art and click "Sign in".
2. The forum sends you a PM titled "🔒 Finals access — confidentiality required". Open it.
3. Reply with the words "yes I agree".
4. Confirmation arrives, Finals Room becomes visible, the 📋 Finalist Briefing is pinned there. Read it.
5. All finals coordination happens in Finals Room from this point.

If something breaks, email me.

— Sam & Mia`;
    const body = `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Hi {firstName},</p>
<p style="margin:0 0 14px;font-size:16px;line-height:1.6;">${esc(opener)}</p>
<p style="margin:0 0 14px;font-size:16px;line-height:1.6;"><strong>${esc(matchup)}</strong></p>

<div style="margin:20px 0;padding:16px 18px;background:#FFE8EE;border:3px solid #C9296A;border-radius:14px;">
  <p style="margin:0 0 6px;font-weight:700;font-size:13px;color:#C9296A;letter-spacing:.06em;text-transform:uppercase;">⚠️ Confidentiality starts now</p>
  <p style="margin:0;font-size:14px;line-height:1.55;">You're under finals confidentiality from this point. Don't tell anyone you're a finalist, don't research, don't compare notes — including with anyone in the winners bracket.</p>
</div>

<p style="margin:0 0 10px;font-weight:700;font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:#3B4A7E;">📋 Walk-through (next 24h)</p>
<ol style="margin:0 0 18px 22px;padding:0;font-size:15px;line-height:1.6;">
  <li style="margin-bottom:10px;">Open <a href="https://discuss.miaswebsites.art" style="color:#E94B7E;text-decoration:underline;">discuss.miaswebsites.art</a> and click <strong>Sign in</strong>.</li>
  <li style="margin-bottom:10px;">Find the PM <strong>"🔒 Finals access — confidentiality required"</strong> in your inbox.</li>
  <li style="margin-bottom:10px;">Reply with the words <strong>"yes I agree"</strong>.</li>
  <li style="margin-bottom:10px;">Confirmation arrives. <strong>Finals Room</strong> appears. Pinned 📋 Finalist Briefing — read it, drop a 👍.</li>
  <li>All coordination from now on happens in Finals Room. Not email.</li>
</ol>

<div style="margin:20px 0 6px;text-align:center;">
  <a href="https://discuss.miaswebsites.art" style="display:inline-block;background:#E94B7E;color:#FFFFFF;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E;padding:12px 28px;font-weight:700;font-size:16px;text-decoration:none;">→ Open the forum</a>
</div>

<p style="margin:18px 0 0;font-size:14px;color:#3B4A7E;">Reply if any step sticks.</p>`;
    const html = finalsShell({
      bgColor: "#87CEEB",
      bannerText: "Losers bracket · final",
      bannerColor: "#C9296A",
      title: "🥈 The comeback is real",
      bodyHtml: body,
    });
    return { subject: finalSubject, html, text };
  },
};

const FINALS_HYPE_ELIMINATED: EmailTemplate = {
  id: "finals-hype-eliminated",
  name: "Finals hype · eliminated players",
  description:
    "For everyone who's already out of the bracket. Hypes the upcoming finals broadcast (date TBD) and invites them to spectate. No NDA — these recipients are not part of the finalist circle.",
  defaultSubject: "🍿 The finals are coming — pull up a chair",
  fields: [
    {
      key: "headlineLine",
      label: "Headline",
      kind: "text",
      defaultValue: "Two finals. Four players. You're invited to the show.",
      maxLength: 100,
    },
    {
      key: "openerLine",
      label: "Opener",
      kind: "textarea",
      defaultValue:
        "You ran a great tournament. The bracket has shaken out — both bracket finals are locked, and the championship is around the corner. The exact date isn't set yet, but I want you in the audience when it goes live.",
      rows: 3,
      maxLength: 600,
    },
  ],
  render({ subject, fields }) {
    const finalSubject = subject || "🍿 The finals are coming — pull up a chair";
    const headline = fields.headlineLine || "Two finals. Four players.";
    const opener =
      fields.openerLine ||
      "You ran a great tournament. Both bracket finals are locked. Date TBD — but I want you watching.";
    const text = `Hi {firstName},

${headline}

${opener}

What's coming up:
• A winners-bracket final
• A losers-bracket final
• The grand championship between the two winners

The full broadcast goes live on the site. I'll send a calendar invite once the date locks. In the meantime, the bracket page (https://quiz.miaswebsites.art/standings) is the live source of truth — refresh whenever.

If you want to talk smack about who's going to win, the forum is open: https://discuss.miaswebsites.art/c/tournament-talk

— Sam & Mia`;
    const body = `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Hi {firstName},</p>
<p style="margin:0 0 14px;font-size:18px;line-height:1.4;font-weight:700;color:#C9296A;">${esc(headline)}</p>
<p style="margin:0 0 14px;font-size:16px;line-height:1.6;">${esc(opener)}</p>

<div style="margin:20px 0;padding:16px 18px;background:#FFFAE0;border:3px solid #1B2A4E;border-radius:14px;">
  <p style="margin:0 0 8px;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#3B4A7E;">What's coming up</p>
  <ul style="margin:0;padding-left:22px;font-size:15px;line-height:1.7;">
    <li>A 🏆 <strong>winners-bracket final</strong></li>
    <li>A 🥈 <strong>losers-bracket final</strong></li>
    <li>A grand championship between the two winners</li>
  </ul>
</div>

<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">The full broadcast goes live on the site. I'll send a calendar invite once the date locks. In the meantime, the bracket page is the live source of truth — refresh whenever.</p>

<div style="margin:20px 0 6px;text-align:center;">
  <a href="https://quiz.miaswebsites.art/standings" style="display:inline-block;background:#FFD93D;color:#1B2A4E;border:3px solid #1B2A4E;border-radius:14px;box-shadow:4px 4px 0 0 #1B2A4E;padding:12px 28px;font-weight:700;font-size:16px;text-decoration:none;">📊 Open the bracket</a>
</div>
<div style="margin:10px 0 6px;text-align:center;">
  <a href="https://discuss.miaswebsites.art/c/tournament-talk" style="display:inline-block;background:#FFFFFF;color:#1B2A4E;border:3px solid #1B2A4E;border-radius:14px;box-shadow:3px 3px 0 0 #1B2A4E;padding:10px 22px;font-weight:700;font-size:14px;text-decoration:none;">💬 Talk smack on the forum</a>
</div>`;
    const html = finalsShell({
      bgColor: "#B7E5FF",
      bannerText: "Tournament · finals incoming",
      bannerColor: "#C9296A",
      title: "🍿 The finals are coming",
      bodyHtml: body,
    });
    return { subject: finalSubject, html, text };
  },
};

// Top-of-funnel finals invite. Hero is a 5-second animated GIF of
// the envelope opening (rendered from remotion/EnvelopeReveal.tsx
// via `npm run video:render-envelope-gif`); the still PNG of the
// card is the fallback for clients that strip animation. Headline
// has flipped from "save the date" → "REGISTRATION IS OPEN" since
// the Zoho webinar is live.
const FINALS_GRAND_INVITATION: EmailTemplate = {
  id: "finals-grand-invitation",
  name: "Finals · registration open (animated)",
  description:
    "Animated GIF of the envelope opening, then the invitation card. Headlined 'REGISTRATION IS OPEN' with the Zoho webinar URL as the primary CTA. Send to the whole list now that registration is live.",
  defaultSubject: "🎟️ Registration is OPEN — Mia's Quiz Grand Final, Sat May 16",
  fields: [
    {
      key: "registrationUrl",
      label: "Zoho registration URL",
      kind: "text",
      defaultValue:
        "https://meetinglab.zoho.com/meeting/register/embed?sessionId=1028992076",
      hint: "Goes on the primary 'Register now' button.",
      maxLength: 400,
    },
    {
      key: "headline",
      label: "Headline",
      kind: "text",
      defaultValue:
        "Registration is officially open — and you're invited to the Grand Final.",
      maxLength: 140,
    },
    {
      key: "blurb",
      label: "Body",
      kind: "textarea",
      defaultValue:
        "After eight weeks of bracket battles, only four players are left: Karen vs Marc in the winners' final, Grandpa vs Sam in the losers' final, then a championship match. It's all going down live this Saturday — and you're in the audience.",
      rows: 4,
      maxLength: 600,
    },
  ],
  render({ subject, fields }) {
    const finalSubject =
      subject ||
      "🎟️ Registration is OPEN — Mia's Quiz Grand Final, Sat May 16";
    const registrationUrl =
      fields.registrationUrl?.trim() ||
      "https://meetinglab.zoho.com/meeting/register/embed?sessionId=1028992076";
    const headline =
      fields.headline?.trim() ||
      "Registration is officially open — and you're invited to the Grand Final.";
    const blurb =
      fields.blurb?.trim() ||
      "After eight weeks of bracket battles, only four players are left.";

    const text = `Hi {firstName},

REGISTRATION IS OPEN.

${headline}

${blurb}

📅 When: Saturday, May 16, 2026 · 12:00 PM Eastern (NY · DC)
🎙️ Format: Live broadcast — host + four finalists on camera
🏆 Brackets:
  • Winners' Final — Karen vs Marc
  • Losers' Final — Grandpa vs Sam

→ Register here: ${registrationUrl}
→ See the invitation + trailer: https://quiz.miaswebsites.art/finals

— Sam`;

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#1B2A4E;font-family:'Quicksand',system-ui,sans-serif;color:#1B2A4E;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#1B2A4E;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;">
      <tr><td>

        <!-- "REGISTRATION IS OPEN" badge -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td align="center" style="padding-bottom:14px;">
            <span style="display:inline-block;background:#FFD93D;color:#1B2A4E;border:4px solid #1B2A4E;border-radius:999px;padding:10px 26px;font-weight:700;font-size:14px;letter-spacing:.22em;text-transform:uppercase;box-shadow:4px 4px 0 #C9296A;">
              🎟️ Registration is open
            </span>
          </td></tr>
        </table>

        <!-- Hero: animated envelope opening. Falls back to the still
             PNG card in clients that strip animation (set as 'alt'
             and via a nested <img> further down for safety). -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFFDF0;border:4px solid #FFD93D;border-radius:24px;box-shadow:0 14px 0 #C9296A;">
          <tr><td align="center" style="padding:28px;">
            <a href="${esc(registrationUrl)}" style="display:block;text-decoration:none;">
              <img src="https://quiz.miaswebsites.art/images/envelope-reveal.gif"
                   alt="Envelope opening — your invitation to the Grand Final"
                   width="480"
                   style="display:block;width:100%;max-width:480px;height:auto;border-radius:16px;border:3px solid #1B2A4E;"/>
            </a>
            <p style="margin:14px 0 0;font-size:11px;color:#3B4A7E;font-style:italic;">
              Don't see the animation? <a href="https://quiz.miaswebsites.art/finals" style="color:#C9296A;text-decoration:underline;">Open it on the web</a>.
            </p>
          </td></tr>
        </table>

        <!-- Body card -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:22px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 #FFD93D;">
          <tr><td style="padding:30px 30px 8px;">
            <p style="margin:0;font-weight:700;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#C9296A;">Registration is open</p>
            <h1 style="margin:8px 0 0;font-weight:700;font-size:28px;line-height:1.2;color:#1B2A4E;">${esc(headline)}</h1>
            <p style="margin:14px 0 0;font-size:16px;line-height:1.6;">Hi {firstName},</p>
            <p style="margin:12px 0 0;font-size:16px;line-height:1.6;">${esc(blurb)}</p>
          </td></tr>

          <!-- Primary CTA — Zoho registration -->
          <tr><td align="center" style="padding:24px 30px 8px;">
            <a href="${esc(registrationUrl)}" style="display:inline-block;background:#E94B7E;color:#FFFFFF;border:4px solid #1B2A4E;border-radius:18px;box-shadow:6px 6px 0 #1B2A4E;padding:18px 40px;font-weight:700;font-size:22px;text-decoration:none;letter-spacing:.04em;text-transform:uppercase;">
              🎟️ Register now
            </a>
            <p style="margin:12px 0 0;font-size:12px;color:#3B4A7E;">
              60-second form. Zoho emails you a personal join link.
            </p>
          </td></tr>

          <tr><td style="padding:14px 30px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFFAE0;border:3px solid #1B2A4E;border-radius:18px;">
              <tr>
                <td align="center" style="padding:18px 8px;">
                  <p style="margin:0;font-weight:700;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#3B4A7E;">📅 When</p>
                  <p style="margin:6px 0 0;font-weight:700;font-size:22px;color:#1B2A4E;">Saturday<br/>May 16, 2026</p>
                </td>
                <td style="width:2px;background:#1B2A4E;opacity:.2;"></td>
                <td align="center" style="padding:18px 8px;">
                  <p style="margin:0;font-weight:700;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#3B4A7E;">🎙️ Tip-off</p>
                  <p style="margin:6px 0 0;font-weight:700;font-size:22px;color:#1B2A4E;">12:00 PM<br/>Eastern</p>
                </td>
              </tr>
            </table>
          </td></tr>

          <tr><td style="padding:14px 30px 8px;">
            <p style="margin:14px 0 6px;font-weight:700;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#3B4A7E;">🏆 The brackets</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="49%" style="background:#FFD93D;border:3px solid #1B2A4E;border-radius:14px;padding:14px;text-align:center;">
                  <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;">Winners' Final</p>
                  <p style="margin:6px 0 0;font-weight:700;font-size:22px;color:#1B2A4E;line-height:1.1;">Karen<br/><span style="font-style:italic;font-size:14px;opacity:.7;">vs</span><br/>Marc</p>
                </td>
                <td width="2%"></td>
                <td width="49%" style="background:#C9296A;border:3px solid #1B2A4E;border-radius:14px;padding:14px;text-align:center;color:#FFFFFF;">
                  <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;">Losers' Final</p>
                  <p style="margin:6px 0 0;font-weight:700;font-size:22px;line-height:1.1;">Grandpa<br/><span style="font-style:italic;font-size:14px;opacity:.85;">vs</span><br/>Sam</p>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Secondary CTAs -->
          <tr><td align="center" style="padding:20px 30px 8px;">
            <a href="${esc(registrationUrl)}" style="display:inline-block;background:#FFFFFF;color:#1B2A4E;border:3px solid #1B2A4E;border-radius:14px;box-shadow:3px 3px 0 #1B2A4E;padding:10px 22px;font-weight:700;font-size:14px;text-decoration:none;margin:4px;">
              🎟️ Register
            </a>
            <a href="https://quiz.miaswebsites.art/finals" style="display:inline-block;background:#FFFFFF;color:#1B2A4E;border:3px solid #1B2A4E;border-radius:14px;box-shadow:3px 3px 0 #1B2A4E;padding:10px 22px;font-weight:700;font-size:14px;text-decoration:none;margin:4px;">
              ▶ Watch the trailer
            </a>
          </td></tr>

          <tr><td align="center" style="padding:8px 30px 8px;">
            <p style="margin:8px 0 0;font-size:11px;color:#3B4A7E;">
              Button not working? Copy this:<br/>
              <span style="font-family:monospace;word-break:break-all;">${esc(registrationUrl)}</span>
            </p>
          </td></tr>

          <tr><td style="padding:8px 30px 28px;">
            <hr style="border:none;border-top:2px dashed #B7E5FF;margin:18px 0"/>
            <p style="margin:0;font-size:13px;color:#3B4A7E;">— Sam &amp; Mia</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
    return { subject: finalSubject, html, text };
  },
};

const PRETAPED_CHANGE_OF_PLANS: EmailTemplate = {
  id: "pretaped-change-of-plans",
  name: "Finals · change of plans (now pre-taped)",
  description:
    "Profuse apology — the Saturday live broadcast is cancelled. The finals will be pre-recorded and sent out as a watch-anytime video. Use this for the whole list (finalists + spectators).",
  defaultSubject:
    "Sorry — the Mia's Quiz Tournament finals are going pre-taped 💌",
  fields: [
    {
      key: "headline",
      label: "Hero headline",
      kind: "text",
      defaultValue: "A real apology + a small change of plans.",
      maxLength: 100,
    },
    {
      key: "apology",
      label: "Apology paragraph",
      kind: "textarea",
      defaultValue:
        "I'm really sorry. I know everyone has been counting down to the live finals on Saturday May 16 — I built up months of hype for this, you all rearranged your weekends for it, and now I'm changing the plan less than 24 hours out. That's on me. I should have called this earlier instead of pushing until the last minute. I'm sorry.",
      rows: 6,
      maxLength: 1200,
    },
    {
      key: "newPlan",
      label: "The new plan",
      kind: "textarea",
      defaultValue:
        "Here's what we're doing instead: the finals will be PRE-TAPED. Mia and I are going to record all three rounds (Losers' Bracket Final, Winners' Bracket Final, and the Championship) over the next few days, edit the whole thing into one watch-anytime video — and then send everyone a link to watch on their own time. Same questions, same effects, same trophy, same scoreboard. Just no live chat + no live worry about whether your wifi will hold up.",
      rows: 6,
      maxLength: 1200,
    },
    {
      key: "whatChanges",
      label: "What's changing for you specifically",
      kind: "textarea",
      defaultValue:
        "Finalists: I'll be in touch directly to schedule your recording session. We'll do it over a quick video call where you'll see + answer the questions exactly the way you would have lived. It'll take ~25 minutes of your time. Spectators: nothing changes — you'll just get a video link instead of a Zoho webinar link. The reveal of who won stays a surprise until the video drops.",
      rows: 5,
      maxLength: 1000,
    },
    {
      key: "etaLine",
      label: "When to expect the video",
      kind: "text",
      defaultValue:
        "Aiming to have the finished video sent out by next weekend (Sat May 23). I'll email a new ETA if that slips.",
      maxLength: 240,
    },
    {
      key: "closing",
      label: "Closing",
      kind: "textarea",
      defaultValue:
        "Thank you for being patient with a 13-year-old running a quiz tournament for his 7-year-old sister. I promise the recording is going to be every bit as fun as the live show would have been — and you get to rewind the good parts. — Sam",
      rows: 4,
      maxLength: 600,
    },
  ],
  render({ subject, fields }) {
    const headline = getField(this, fields, "headline");
    const apology = getField(this, fields, "apology");
    const newPlan = getField(this, fields, "newPlan");
    const whatChanges = getField(this, fields, "whatChanges");
    const etaLine = getField(this, fields, "etaLine");
    const closing = getField(this, fields, "closing");
    const finalSubject = (subject || this.defaultSubject).trim();

    const text = [
      "Mia's Quiz Tournament",
      "💌 Change of plans — finals going pre-taped",
      "(From Sam, site admin)",
      "",
      "Hi {firstName},",
      "",
      headline,
      "",
      apology,
      "",
      "THE NEW PLAN:",
      newPlan,
      "",
      "WHAT CHANGES FOR YOU:",
      whatChanges,
      "",
      etaLine,
      "",
      closing,
      "",
      "— Sam",
      "Mia's Quiz Tournament",
    ].join("\n");

    const paragraph = (s: string) =>
      `<p style="margin:0 0 14px;font-family:Quicksand,system-ui,sans-serif;font-size:16px;line-height:1.65;color:#1B2A4E;">${esc(
        s
      )}</p>`;

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>${esc(finalSubject)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
</style>
</head>
<body style="margin:0;padding:0;background:#FFE9D6;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">The Saturday live finals are cancelled. We're going pre-taped and sending out a video link instead. Sorry — details inside.</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFE9D6;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:28px;box-shadow:8px 8px 0 0 #1B2A4E;">
        <tr><td style="padding:36px 36px 8px 36px;">
          <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:22px;color:#1B2A4E;line-height:1;">Mia&rsquo;s Quiz Tournament</p>
          <p style="margin:6px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:600;font-size:12px;color:#E94B7E;letter-spacing:.06em;text-transform:uppercase;">💌 Change of plans</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0 0;">
            <tr><td align="right">
              <span style="display:inline-block;background:#FF8C42;color:#FFFFFF;padding:5px 14px;border-radius:999px;border:3px solid #1B2A4E;box-shadow:2px 2px 0 0 #1B2A4E;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;letter-spacing:.04em;">📼 NOW PRE-TAPED</span>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 36px 8px 36px;">
          <h1 style="margin:0 0 16px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:28px;color:#1B2A4E;line-height:1.15;">Hi {firstName} —</h1>
          <p style="margin:0 0 18px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:20px;color:#1B2A4E;line-height:1.25;">${esc(
            headline
          )}</p>
          ${paragraph(apology)}

          <h2 style="margin:24px 0 10px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:16px;color:#E94B7E;letter-spacing:.04em;text-transform:uppercase;">The new plan</h2>
          ${paragraph(newPlan)}

          <h2 style="margin:24px 0 10px;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:16px;color:#E94B7E;letter-spacing:.04em;text-transform:uppercase;">What changes for you</h2>
          ${paragraph(whatChanges)}

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0;">
            <tr><td style="background:#FFF6E0;border:3px solid #1B2A4E;border-radius:16px;padding:14px 18px;">
              <p style="margin:0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:11px;color:#1B2A4E;letter-spacing:.16em;text-transform:uppercase;">When to expect the video</p>
              <p style="margin:6px 0 0;font-family:Quicksand,system-ui,sans-serif;font-size:15px;line-height:1.55;color:#1B2A4E;">${esc(
                etaLine
              )}</p>
            </td></tr>
          </table>

          ${paragraph(closing)}

          <p style="margin:28px 0 0;font-family:Fredoka,Quicksand,system-ui,sans-serif;font-weight:700;font-size:16px;color:#1B2A4E;">— Sam</p>
          <p style="margin:0 0 28px;font-family:Quicksand,system-ui,sans-serif;font-size:12px;color:#5A6B8A;">Site administrator · Mia&rsquo;s Quiz Tournament</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    return { subject: finalSubject, html, text };
  },
};

const TEMPLATES: EmailTemplate[] = [
  PRETAPED_CHANGE_OF_PLANS,
  FINALS_GRAND_INVITATION,
  FINALS_HYPE_WINNERS_FINALIST,
  FINALS_HYPE_LOSERS_FINALIST,
  FINALS_HYPE_ELIMINATED,
  GRAND_FINAL_HYPE,
  QOTD_ANNOUNCEMENT,
  ROUND_SCHEDULED,
  ROUND_STARTED,
  NEW_AUTH_AND_MIAMAIL,
  SCHEDULE_SHIFT_PUBLIC,
  BRACKET_UPDATE,
  STILL_IN,
  ELIMINATED_REVEAL,
  TIME_RUNNING_OUT,
  TIEBREAKER_QUIZ,
  R1_RESULTS_DOUBLE_ELIM,
  PICKEM_HYPE,
];

export function listTemplates(): EmailTemplate[] {
  return TEMPLATES;
}

export function getTemplate(id: string): EmailTemplate | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

// Strip the render closure when sending metadata to the client.
export type EmailTemplateMeta = Omit<EmailTemplate, "render">;

export function listTemplateMeta(): EmailTemplateMeta[] {
  return TEMPLATES.map(({ render: _r, ...rest }) => rest);
}
