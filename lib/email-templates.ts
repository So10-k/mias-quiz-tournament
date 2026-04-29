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
        "You're still welcome to follow the rest of the tournament — bracket, players, standings are all live for you any time. Mia would love to know you're still cheering. And there'll be a next one.",
      rows: 4,
      maxLength: 600,
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

const TEMPLATES: EmailTemplate[] = [
  SCHEDULE_SHIFT_PUBLIC,
  BRACKET_UPDATE,
  STILL_IN,
  ELIMINATED_REVEAL,
  TIME_RUNNING_OUT,
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
