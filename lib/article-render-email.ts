// Email-safe HTML renderer for article block-documents.
//
// Mirrors components/articles/ArticleRenderer.tsx but emits a plain
// HTML string with inline styles (no class names — most email clients
// strip <style>). Used by:
//   - the digest cron in app/api/newsletter/cron
//   - manual "send as email" actions on /host/articles/[id]
//
// All colors are hex copies of the Tailwind tokens (we don't have the
// CSS variables in email).

import type { ArticleBlock } from "@/lib/article-blocks";

const NAVY = "#1B2A4E";
const NAVY_SOFT = "#3B4A7E";
const CORAL = "#E94B7E";          // promoted to readable
const CORAL_DEEP = "#C9296A";
const CORAL_SOFT = "#FF6B9D";     // pastel — used for callout backgrounds
const SUN = "#FFD93D";
const SKY = "#87CEEB";
const SKY_LIGHT = "#B7E5FF";
const GRASS = "#4FB04F";          // promoted to readable
const GRASS_SOFT = "#7DD87D";     // pastel — used for callout backgrounds
const WHITE = "#FFFFFF";

const FAMILY_BODY = "Quicksand, system-ui, sans-serif";
const FAMILY_DISPLAY = "Fredoka, Quicksand, system-ui, sans-serif";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inlineMarkdown(s: string): string {
  // Escape first, then re-introduce specific markup spans. Order
  // matters; same as ArticleRenderer.tsx.
  let out = esc(s);
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label, href) =>
      `<a href="${esc(href)}" style="color:${CORAL_DEEP};text-decoration:underline;">${label}</a>`
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/_([^_]+)_/g, "<em>$1</em>");
  out = out.replace(
    /`([^`]+)`/g,
    `<code style="background:${WHITE};border:2px solid ${NAVY};border-radius:4px;padding:0 4px;font-family:monospace;font-size:13px;">$1</code>`
  );
  return out;
}

function renderBlock(b: ArticleBlock): string {
  switch (b.type) {
    case "heading": {
      const size = b.data.level === 2 ? "26px" : "20px";
      return `<h${b.data.level} style="margin:18px 0 8px;font-family:${FAMILY_DISPLAY};font-weight:700;color:${NAVY};font-size:${size};line-height:1.2;">${esc(b.data.text)}</h${b.data.level}>`;
    }
    case "paragraph":
      return `<p style="margin:0 0 14px;font-family:${FAMILY_BODY};font-size:16px;line-height:1.65;color:${NAVY};">${inlineMarkdown(b.data.text)}</p>`;
    case "image": {
      const cap = b.data.caption
        ? `<p style="margin:6px 0 0;font-family:${FAMILY_BODY};font-size:13px;color:${NAVY_SOFT};text-align:center;font-style:italic;">${esc(b.data.caption)}</p>`
        : "";
      return `<div style="margin:16px 0;"><img src="${esc(b.data.src)}" alt="${esc(b.data.alt)}" style="display:block;max-width:100%;width:100%;height:auto;border:4px solid ${NAVY};border-radius:18px;" />${cap}</div>`;
    }
    case "callout": {
      // Soft pastel + navy text for legibility on multi-sentence body
      // copy. Mirrors the swap in ArticleRenderer.tsx.
      const bg =
        b.data.tone === "coral"
          ? CORAL_SOFT
          : b.data.tone === "sun"
            ? SUN
            : b.data.tone === "sky"
              ? SKY
              : GRASS_SOFT;
      const fg = NAVY;
      const emoji = b.data.emoji
        ? `<span style="font-size:24px;margin-right:10px;display:inline-block;vertical-align:top;">${esc(b.data.emoji)}</span>`
        : "";
      return `<div style="margin:16px 0;background:${bg};color:${fg};border:3px solid ${NAVY};border-radius:18px;padding:16px 18px;box-shadow:4px 4px 0 0 ${NAVY};">${emoji}<span style="display:inline-block;font-family:${FAMILY_BODY};font-size:15px;line-height:1.6;color:${fg};max-width:calc(100% - 36px);vertical-align:top;">${inlineMarkdown(b.data.text)}</span></div>`;
    }
    case "quote":
      return `<blockquote style="margin:18px 0;padding:8px 0 8px 18px;border-left:4px solid ${CORAL_DEEP};"><p style="margin:0;font-family:${FAMILY_DISPLAY};font-size:22px;color:${NAVY};font-style:italic;line-height:1.35;">&ldquo;${esc(b.data.text)}&rdquo;</p>${b.data.attribution ? `<footer style="margin:6px 0 0;font-family:${FAMILY_BODY};font-size:14px;color:${NAVY_SOFT};">— ${esc(b.data.attribution)}</footer>` : ""}</blockquote>`;
    case "divider": {
      const ornament =
        b.data.variant === "stars"
          ? "✦ ✧ ✦"
          : b.data.variant === "sun"
            ? "✿ ✿ ✿"
            : "～～～";
      return `<div style="margin:18px 0;text-align:center;font-family:${FAMILY_DISPLAY};font-size:22px;color:${NAVY};">${ornament}</div>`;
    }
    case "button": {
      const bg =
        b.data.tone === "coral"
          ? CORAL
          : b.data.tone === "sun"
            ? SUN
            : b.data.tone === "sky"
              ? SKY
              : b.data.tone === "grass"
                ? GRASS
                : WHITE;
      const fg = b.data.tone === "sun" || b.data.tone === "white" || b.data.tone === "sky" ? NAVY : WHITE;
      return `<div style="margin:18px 0;text-align:center;"><a href="${esc(b.data.href)}" style="display:inline-block;font-family:${FAMILY_DISPLAY};font-weight:700;font-size:16px;color:${fg};text-decoration:none;background:${bg};border:3px solid ${NAVY};border-radius:14px;box-shadow:3px 3px 0 0 ${NAVY};padding:12px 26px;">${esc(b.data.text)}&nbsp;→</a></div>`;
    }
    case "list": {
      const tag = b.data.ordered ? "ol" : "ul";
      const items = b.data.items
        .map(
          (item) =>
            `<li style="margin:0 0 8px;font-family:${FAMILY_BODY};font-size:16px;line-height:1.6;color:${NAVY};">${inlineMarkdown(item)}</li>`
        )
        .join("");
      return `<${tag} style="margin:14px 0;padding-left:28px;color:${NAVY};">${items}</${tag}>`;
    }
  }
}

export function renderArticleEmailBody(blocks: ArticleBlock[]): string {
  return blocks.map(renderBlock).join("\n");
}

// Wraps article body in the same picture-book stationery as the other
// templates.
export function renderArticleEmail(args: {
  title: string;
  subtitle?: string | null;
  dek?: string | null;
  authorName: string;
  blocks: ArticleBlock[];
  unsubscribeUrl?: string;
  publicUrl?: string;
}): { html: string; text: string } {
  const body = renderArticleEmailBody(args.blocks);
  const text = [
    args.title,
    args.subtitle ?? "",
    "",
    args.dek ?? "",
    "",
    "Read on the site: " + (args.publicUrl ?? ""),
    "",
    args.unsubscribeUrl
      ? `Unsubscribe: ${args.unsubscribeUrl}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>${esc(args.title)}</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
</style>
</head>
<body style="margin:0;padding:0;background:${SKY_LIGHT};font-family:${FAMILY_BODY};color:${NAVY};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${SKY_LIGHT};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:${WHITE};border:4px solid ${NAVY};border-radius:28px;box-shadow:8px 8px 0 0 ${NAVY};">
          <tr><td style="padding:34px 36px 4px;">
            <p style="margin:0;font-family:${FAMILY_DISPLAY};font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${CORAL_DEEP};">From the Quiz Book blog</p>
            <h1 style="margin:6px 0 4px;font-family:${FAMILY_DISPLAY};font-weight:700;font-size:32px;line-height:1.1;color:${NAVY};">${esc(args.title)}</h1>
            ${args.subtitle ? `<p style="margin:0 0 6px;font-family:${FAMILY_DISPLAY};font-weight:600;font-size:18px;color:${NAVY_SOFT};">${esc(args.subtitle)}</p>` : ""}
            ${args.dek ? `<p style="margin:6px 0 0;font-family:${FAMILY_BODY};font-size:15px;color:${NAVY_SOFT};font-style:italic;">${esc(args.dek)}</p>` : ""}
            <p style="margin:14px 0 0;font-family:${FAMILY_BODY};font-size:13px;color:${NAVY_SOFT};">By ${esc(args.authorName)}</p>
          </td></tr>
          <tr><td style="padding:18px 36px 26px;">
            ${body}
            ${args.publicUrl ? `<div style="margin-top:20px;text-align:center;"><a href="${esc(args.publicUrl)}" style="display:inline-block;font-family:${FAMILY_DISPLAY};font-weight:700;font-size:14px;color:${NAVY};text-decoration:none;background:${WHITE};border:3px solid ${NAVY};border-radius:12px;box-shadow:3px 3px 0 0 ${NAVY};padding:10px 22px;">Read on the site →</a></div>` : ""}
          </td></tr>
          <tr><td style="padding:0;line-height:0;font-size:0;">
            <div style="background:${GRASS};border-top:3px solid ${NAVY};height:42px;border-bottom-left-radius:24px;border-bottom-right-radius:24px;">&nbsp;</div>
          </td></tr>
        </table>
        ${args.unsubscribeUrl ? `<p style="margin:18px 0 0;font-family:${FAMILY_BODY};font-size:11px;color:${NAVY_SOFT};opacity:.85;">You&rsquo;re receiving this because you subscribed to the Quiz Book blog. <a href="${esc(args.unsubscribeUrl)}" style="color:${NAVY_SOFT};">Unsubscribe</a>.</p>` : ""}
      </td>
    </tr>
  </table>
</body></html>`;

  return { html, text };
}

// Multi-article digest — rolls up titles + deks into one email with
// "read more" buttons per article.
export function renderDigestEmail(args: {
  intro: string;
  items: {
    title: string;
    dek?: string | null;
    url: string;
    authorName: string;
  }[];
  unsubscribeUrl: string;
  frequency: "daily" | "weekly" | "monthly";
}): { html: string; text: string } {
  const cards = args.items
    .map(
      (it, i) =>
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;background:${i % 2 === 0 ? SUN : SKY};border:3px solid ${NAVY};border-radius:18px;box-shadow:4px 4px 0 0 ${NAVY};">
          <tr><td style="padding:18px 22px 16px;">
            <h3 style="margin:0;font-family:${FAMILY_DISPLAY};font-weight:700;font-size:20px;color:${NAVY};line-height:1.2;">${esc(it.title)}</h3>
            ${it.dek ? `<p style="margin:6px 0 0;font-family:${FAMILY_BODY};font-size:14px;color:${NAVY};line-height:1.55;">${esc(it.dek)}</p>` : ""}
            <p style="margin:8px 0 0;font-family:${FAMILY_BODY};font-size:12px;color:${NAVY_SOFT};">By ${esc(it.authorName)}</p>
            <div style="margin:12px 0 0;">
              <a href="${esc(it.url)}" style="display:inline-block;font-family:${FAMILY_DISPLAY};font-weight:700;font-size:13px;color:${WHITE};text-decoration:none;background:${CORAL};border:3px solid ${NAVY};border-radius:10px;box-shadow:2px 2px 0 0 ${NAVY};padding:8px 16px;">Read it →</a>
            </div>
          </td></tr>
        </table>`
    )
    .join("\n");

  const text = [
    "The Quiz Book — " + args.frequency + " digest",
    "",
    args.intro,
    "",
    ...args.items.map((it) => `• ${it.title}\n  ${it.dek ?? ""}\n  ${it.url}\n`),
    "",
    "Unsubscribe: " + args.unsubscribeUrl,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(args.frequency)} digest from the Quiz Book</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap");
</style>
</head>
<body style="margin:0;padding:0;background:${SKY_LIGHT};font-family:${FAMILY_BODY};color:${NAVY};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${SKY_LIGHT};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:${WHITE};border:4px solid ${NAVY};border-radius:28px;box-shadow:8px 8px 0 0 ${NAVY};">
        <tr><td style="padding:30px 32px 6px;">
          <p style="margin:0;font-family:${FAMILY_DISPLAY};font-weight:700;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:${CORAL_DEEP};">${esc(args.frequency)} digest</p>
          <h1 style="margin:4px 0 0;font-family:${FAMILY_DISPLAY};font-weight:700;font-size:30px;line-height:1.1;color:${NAVY};">From the Quiz Book</h1>
          <p style="margin:14px 0 0;font-family:${FAMILY_BODY};font-size:15px;color:${NAVY};">${esc(args.intro)}</p>
        </td></tr>
        <tr><td style="padding:18px 32px 24px;">${cards}</td></tr>
        <tr><td style="padding:0;line-height:0;font-size:0;"><div style="background:${GRASS};border-top:3px solid ${NAVY};height:42px;border-bottom-left-radius:24px;border-bottom-right-radius:24px;">&nbsp;</div></td></tr>
      </table>
      <p style="margin:18px 0 0;font-family:${FAMILY_BODY};font-size:11px;color:${NAVY_SOFT};opacity:.85;">You&rsquo;re receiving this because you subscribed to the Quiz Book ${esc(args.frequency)} digest. <a href="${esc(args.unsubscribeUrl)}" style="color:${NAVY_SOFT};">Unsubscribe</a>.</p>
    </td></tr>
  </table>
</body></html>`;

  return { html, text };
}
