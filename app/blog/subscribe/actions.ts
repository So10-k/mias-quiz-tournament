"use server";

// Public newsletter signup. Anonymous-friendly (we record userId if
// the visitor happens to be signed in, but it's optional). Sends a
// double-opt-in confirmation email immediately.

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import {
  subscribe,
  confirmUrl,
  type SubscriptionFrequency,
} from "@/lib/newsletter";
import { sendOne } from "@/lib/email-provider";

export async function subscribeAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const frequency = (
    String(formData.get("frequency") ?? "weekly") as SubscriptionFrequency
  );
  if (!["daily", "weekly", "monthly"].includes(frequency)) {
    redirect("/blog/subscribe?error=Invalid+frequency");
  }
  const me = await currentUser();
  let result: Awaited<ReturnType<typeof subscribe>>;
  try {
    result = await subscribe({
      email,
      userId: me?.id ?? null,
      frequency,
    });
  } catch (e) {
    redirect(
      `/blog/subscribe?error=${encodeURIComponent(
        e instanceof Error ? e.message : "subscribe failed"
      )}`
    );
  }

  // If they're already confirmed (re-subscribing with a flipped freq),
  // skip the opt-in email and just confirm success.
  if (result.subscription.confirmedAt) {
    redirect("/blog/subscribe?ok=already-confirmed");
  }

  // Fire the confirmation email. Failures shouldn't block the redirect
  // because a stale provider would lock people out — log and move on.
  try {
    const url = confirmUrl(result.subscription.confirmationToken);
    const from =
      process.env.EMAIL_FROM ||
      "Mia's Quiz Tournament <onboarding@resend.dev>";
    await sendOne({
      from,
      to: email,
      subject:
        "✉️ Confirm your subscription — The Quiz Book newsletter",
      html: confirmEmailHtml({ url, frequency }),
      text: confirmEmailText({ url, frequency }),
      templateId: "newsletter-confirm",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("subscribe confirm email failed:", err);
  }

  redirect("/blog/subscribe?ok=sent");
}

function confirmEmailText(args: { url: string; frequency: string }) {
  return [
    "Hi!",
    "",
    `You asked to receive the ${args.frequency} digest from the Quiz Book blog.`,
    "Click the link below to confirm:",
    "",
    args.url,
    "",
    "If you didn't request this, ignore the email — nothing else will happen.",
    "",
    "— Sam",
  ].join("\n");
}

function confirmEmailHtml(args: { url: string; frequency: string }) {
  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>@import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Quicksand:wght@500;700&display=swap");</style>
</head>
<body style="margin:0;padding:0;background:#B7E5FF;font-family:Quicksand,system-ui,sans-serif;color:#1B2A4E;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#B7E5FF;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;background:#FFFFFF;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 0 #1B2A4E;">
        <tr><td style="padding:30px 32px 4px;">
          <p style="margin:0;font-family:Fredoka;font-weight:700;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#E94B7E;">One more click</p>
          <h1 style="margin:6px 0 12px;font-family:Fredoka;font-weight:700;font-size:26px;color:#1B2A4E;line-height:1.15;">Confirm your subscription</h1>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1B2A4E;">You asked for the <strong>${args.frequency}</strong> digest from the Quiz Book blog. Tap below to confirm and you&rsquo;re in.</p>
          <div style="text-align:center;margin:18px 0 8px;"><a href="${args.url}" style="display:inline-block;font-family:Fredoka;font-weight:700;font-size:16px;color:#FFFFFF;text-decoration:none;background:#FF6B9D;border:3px solid #1B2A4E;border-radius:14px;box-shadow:3px 3px 0 0 #1B2A4E;padding:12px 26px;">✉️&nbsp;Confirm subscription</a></div>
          <p style="margin:14px 0 0;font-size:12px;color:#3B4A7E;">If the button doesn&rsquo;t work, paste this into your browser:<br/><a href="${args.url}" style="color:#3B4A7E;word-break:break-all;">${args.url}</a></p>
          <p style="margin:18px 0 0;font-size:12px;color:#3B4A7E;">Didn&rsquo;t ask for this? Just delete the email — nothing else will happen.</p>
        </td></tr>
        <tr><td style="padding:0;line-height:0;font-size:0;"><div style="background:#7BC4A4;border-top:3px solid #1B2A4E;height:36px;border-bottom-left-radius:20px;border-bottom-right-radius:20px;">&nbsp;</div></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
