// Callback endpoint hit by the Discourse bridge plugin when an
// admin runs `@support_bot respond [message]` in a Support Tickets
// topic. We verify the HMAC signature (same shared secret as SSO),
// then send the message to the original submitter via the active
// email provider.
//
// Body shape (JSON):
//   {
//     "topic_id": 123,
//     "recipient_email": "jane@example.com",
//     "recipient_name": "Jane Doe",
//     "subject": "[Ticket] my issue",
//     "message": "Hey Jane — sorry for the trouble..."
//   }

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sendOne } from "@/lib/email-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyHmac(rawBody: string, signature: string): boolean {
  const secret = process.env.DISCOURSE_SSO_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-quizbook-signature") ?? "";
  if (!verifyHmac(raw, sig)) {
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 }
    );
  }
  let body: {
    topic_id?: number;
    recipient_email?: string;
    recipient_name?: string;
    subject?: string;
    message?: string;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json" },
      { status: 400 }
    );
  }

  const email = (body.recipient_email ?? "").trim().toLowerCase();
  const message = (body.message ?? "").trim();
  if (!email || !message) {
    return NextResponse.json(
      { ok: false, error: "recipient_email and message required" },
      { status: 400 }
    );
  }

  const cleanSubject = (body.subject ?? "Your support ticket")
    .replace(/^\[Ticket\]\s*/, "")
    .slice(0, 200);

  const from =
    process.env.SUPPORT_FROM ||
    process.env.EMAIL_FROM ||
    "Mia's Quiz Tournament <support@miaswebsites.art>";

  const html = renderHtml({
    name: body.recipient_name?.trim() || null,
    message,
    topicId: body.topic_id ?? null,
  });
  const text = renderText({
    name: body.recipient_name?.trim() || null,
    message,
  });

  try {
    const result = await sendOne({
      from,
      to: email,
      subject: `Re: ${cleanSubject}`,
      html,
      text,
      templateId: "support-respond",
    });
    return NextResponse.json({
      ok: result.errors.length === 0,
      sent: result.sent,
      errors: result.errors,
      provider: result.provider,
      dryRun: !!result.dryRun,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "send failed",
      },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function paragraphs(s: string): string {
  return s
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="font-size:16px;line-height:1.6;margin:0 0 14px">${escapeHtml(
          p
        ).replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
}

function renderHtml(args: {
  name: string | null;
  message: string;
  topicId: number | null;
}): string {
  const greeting = args.name ? `Hey ${escapeHtml(args.name)},` : "Hey,";
  return `<!doctype html>
<html><body style="background:#87CEEB;margin:0;padding:32px;font-family:Quicksand,sans-serif;color:#1B2A4E">
  <div style="max-width:560px;margin:0 auto;background:white;padding:32px;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 0 #1B2A4E">
    <p style="font-family:Fredoka,sans-serif;font-weight:700;font-size:22px;margin:0 0 12px">🌞 Mia&rsquo;s Quiz Tournament — Support</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 14px">${greeting}</p>
    ${paragraphs(args.message)}
    <hr style="border:none;border-top:2px dashed #B7E5FF;margin:24px 0"/>
    <p style="font-size:12px;color:#3B4A7E;margin:0">— Sam &amp; Mia</p>
    <p style="font-size:12px;color:#3B4A7E;margin:6px 0 0">Reply to this email and we&rsquo;ll see it.</p>
  </div>
</body></html>`;
}

function renderText(args: { name: string | null; message: string }): string {
  const greeting = args.name ? `Hey ${args.name},` : "Hey,";
  return `${greeting}\n\n${args.message}\n\n— Sam & Mia\n(Reply to this email and we'll see it.)`;
}
