// Click + open tracking for outgoing emails. Every <a href> in an email
// gets rewritten to point at /t/<token>; the tracker logs the click and
// 302s to the original URL with utm params appended. A 1×1 pixel at /t/o/<sendId>
// records opens (best-effort — many clients prefetch images).

import { createHmac, randomBytes } from "node:crypto";

const SECRET_FALLBACK = "miasquiz-tracker-fallback-secret";

function trackerSecret(): string {
  return (
    process.env.EMAIL_TRACKER_SECRET ??
    process.env.AUTH_SECRET ??
    SECRET_FALLBACK
  );
}

// Encode `${sendId}|${url}` then HMAC-sign. Token format:
//   base64url(payload).base64url(signature)
// keeping it short-ish so emails don't balloon.
export function signTrackerToken(sendId: string, originalUrl: string): string {
  const payload = `${sendId}|${originalUrl}`;
  const sig = createHmac("sha256", trackerSecret())
    .update(payload)
    .digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

export function verifyTrackerToken(
  token: string
): { sendId: string; originalUrl: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", trackerSecret())
    .update(payload)
    .digest("base64url");
  if (expected !== sig) return null;
  const sep = payload.indexOf("|");
  if (sep === -1) return null;
  return {
    sendId: payload.slice(0, sep),
    originalUrl: payload.slice(sep + 1),
  };
}

const SITE_ORIGIN =
  process.env.SITE_ORIGIN ?? "https://quiz.miaswebsites.art";

// Append utm_* params if not already present, so we know the click came
// from a specific email send / template.
export function withUtm(
  url: string,
  args: { campaign?: string; sendId: string }
): string {
  try {
    const u = new URL(url, SITE_ORIGIN);
    if (!u.searchParams.has("utm_source"))
      u.searchParams.set("utm_source", "miamail");
    if (!u.searchParams.has("utm_medium"))
      u.searchParams.set("utm_medium", "email");
    if (args.campaign && !u.searchParams.has("utm_campaign"))
      u.searchParams.set("utm_campaign", args.campaign);
    if (!u.searchParams.has("utm_send"))
      u.searchParams.set("utm_send", args.sendId);
    return u.toString();
  } catch {
    return url;
  }
}

// Rewrite every <a href="..."> in the HTML to point at the tracker.
// Skips anchors, mailto:, tel:, and links that already point at us with
// a tracker path (idempotent).
export function rewriteHtmlLinks(
  html: string,
  sendId: string,
  campaign?: string
): string {
  return html.replace(
    /(<a\b[^>]*\bhref\s*=\s*["'])([^"']+)(["'])/gi,
    (match, pre, url, post) => {
      const lower = url.toLowerCase();
      if (
        lower.startsWith("#") ||
        lower.startsWith("mailto:") ||
        lower.startsWith("tel:") ||
        url.includes("/t/") ||
        url.startsWith("data:")
      )
        return match;
      const target = withUtm(url, { sendId, campaign });
      const token = signTrackerToken(sendId, target);
      return `${pre}${SITE_ORIGIN}/t/${token}${post}`;
    }
  );
}

// Rewrite plain-text URLs (less common but the body field still gets one).
export function rewriteTextLinks(
  text: string,
  sendId: string,
  campaign?: string
): string {
  return text.replace(/(https?:\/\/[^\s<>"]+)/g, (url) => {
    if (url.includes("/t/")) return url;
    const target = withUtm(url, { sendId, campaign });
    const token = signTrackerToken(sendId, target);
    return `${SITE_ORIGIN}/t/${token}`;
  });
}

// Append a 1×1 tracking pixel at the end of the HTML body, before </body>.
export function injectOpenPixel(html: string, sendId: string): string {
  const pixel = `<img src="${SITE_ORIGIN}/t/o/${sendId}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" />`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${pixel}</body>`);
  }
  return html + pixel;
}

export function makeSendId(): string {
  return randomBytes(9).toString("base64url"); // 12 chars
}
