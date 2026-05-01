// Provider-agnostic email sender. The host picks "resend" or "brevo"
// from /host (stored in app_settings); both anonymous and announcement
// flows go through this module so the switch covers everything.
//
// - Resend: native batch endpoint (up to 100 per call).
// - Brevo: no real batch — we fan out with bounded concurrency over the
//   /v3/smtp/email REST endpoint.

import { Resend } from "resend";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import {
  injectOpenPixel,
  makeSendId,
  rewriteHtmlLinks,
  rewriteTextLinks,
} from "@/lib/email-tracker";

const { appSettings, emailSends, users } = schema;
const KEY = "email_provider";

export type EmailProvider = "resend" | "brevo";

export type EmailMessage = {
  /** "Display Name <addr@example.com>" or just "addr@example.com" */
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Optional template id for analytics tagging */
  templateId?: string;
};

export type SendResult = {
  sent: number;
  errors: string[];
  provider: EmailProvider;
  dryRun?: boolean;
};

// 30s in-process cache so we don't hit the DB on every email of a batch.
type Cache = { p: EmailProvider; expiresAt: number };
let cache: Cache | null = null;

export async function getActiveProvider(): Promise<EmailProvider> {
  if (cache && cache.expiresAt > Date.now()) return cache.p;
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, KEY))
    .limit(1);
  const p: EmailProvider = row?.value === "brevo" ? "brevo" : "resend";
  cache = { p, expiresAt: Date.now() + 30_000 };
  return p;
}

export async function setActiveProvider(p: EmailProvider): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: KEY, value: p })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: p, updatedAt: new Date() },
    });
  cache = null;
}

// ─── public send API ───────────────────────────────────────────────────

// Per-provider `from:` override. Each provider can have its own verified
// sender address — Resend uses RESEND_FROM, Brevo uses BREVO_FROM, with
// EMAIL_FROM as a shared fallback. Whatever the caller passed in
// `message.from` is overridden if a provider-specific value is set.
function fromForProvider(provider: EmailProvider): string | null {
  if (provider === "resend")
    return process.env.RESEND_FROM ?? process.env.EMAIL_FROM ?? null;
  if (provider === "brevo")
    return process.env.BREVO_FROM ?? process.env.EMAIL_FROM ?? null;
  return process.env.EMAIL_FROM ?? null;
}

export async function sendBatch(
  messages: EmailMessage[],
  override?: EmailProvider
): Promise<SendResult> {
  if (messages.length === 0) {
    const provider = override ?? (await getActiveProvider());
    return { sent: 0, errors: [], provider };
  }
  const provider = override ?? (await getActiveProvider());

  // Override the from-address based on active provider's verified sender.
  const providerFrom = fromForProvider(provider);
  if (providerFrom) {
    messages = messages.map((m) => ({ ...m, from: providerFrom }));
  }

  // Persist + rewrite links so every send is tracked + readable in Miamail.
  const batchId = makeSendId();
  const userByEmail = await lookupUsersByEmail(
    messages.map((m) => m.to.toLowerCase())
  );
  const persisted: Array<{ message: EmailMessage; sendId: string }> = [];
  for (const m of messages) {
    const sendId = makeSendId();
    const recipientUserId = userByEmail.get(m.to.toLowerCase()) ?? null;
    const trackedHtml = injectOpenPixel(
      rewriteHtmlLinks(m.html, sendId, m.templateId),
      sendId
    );
    const trackedText = rewriteTextLinks(m.text, sendId, m.templateId);
    try {
      await db.insert(emailSends).values({
        id: sendId,
        recipientEmail: m.to,
        recipientUserId,
        subject: m.subject,
        htmlBody: trackedHtml,
        textBody: trackedText,
        templateId: m.templateId ?? null,
        sendBatchId: batchId,
        provider,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[email-provider] failed to persist send row:", e);
    }
    persisted.push({
      message: { ...m, html: trackedHtml, text: trackedText },
      sendId,
    });
  }
  messages = persisted.map((p) => p.message);

  // Dev-mode fallback: if the active provider's key isn't set, log + pretend.
  if (
    (provider === "resend" && !process.env.RESEND_API_KEY) ||
    (provider === "brevo" && !process.env.BREVO_API_KEY)
  ) {
    // eslint-disable-next-line no-console
    console.log(`[DEV email] would send ${messages.length} via ${provider}`);
    return {
      sent: messages.length,
      errors: [],
      provider,
      dryRun: true,
    };
  }

  if (provider === "brevo") {
    return sendBatchBrevo(messages);
  }
  return sendBatchResend(messages);
}

export async function sendOne(
  message: EmailMessage,
  override?: EmailProvider
): Promise<SendResult> {
  return sendBatch([message], override);
}

// Resolve recipient userIds in one query to avoid N round-trips.
async function lookupUsersByEmail(
  emails: string[]
): Promise<Map<string, string>> {
  if (emails.length === 0) return new Map();
  const unique = [...new Set(emails)];
  // Drizzle inArray
  const { inArray } = await import("drizzle-orm");
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.email, unique));
  return new Map(rows.map((r) => [r.email.toLowerCase(), r.id]));
}

// ─── Resend ────────────────────────────────────────────────────────────

async function sendBatchResend(
  messages: EmailMessage[]
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      sent: 0,
      errors: ["RESEND_API_KEY not set"],
      provider: "resend",
    };
  }
  const resend = new Resend(apiKey);
  const errors: string[] = [];
  let sent = 0;
  const CHUNK = 90;
  for (let i = 0; i < messages.length; i += CHUNK) {
    const slice = messages.slice(i, i + CHUNK);
    try {
      const { data, error } = await resend.batch.send(
        slice.map((m) => ({
          from: m.from,
          to: m.to,
          subject: m.subject,
          text: m.text,
          html: m.html,
        }))
      );
      if (error) {
        errors.push(error.message ?? String(error));
      } else if (data && Array.isArray((data as { data?: unknown[] }).data)) {
        sent += (data as { data: unknown[] }).data.length;
      } else {
        sent += slice.length;
      }
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { sent, errors, provider: "resend" };
}

// ─── Brevo ─────────────────────────────────────────────────────────────

function parseFrom(from: string): { name: string; email: string } {
  const m = from.match(/^(.+?)\s*<\s*(.+?)\s*>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: "Mia's Quiz Tournament", email: from.trim() };
}

async function sendOneBrevo(
  m: EmailMessage,
  apiKey: string,
  batchId: string
): Promise<{ messageId?: string }> {
  const sender = parseFrom(m.from);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender,
      to: [{ email: m.to }],
      subject: m.subject,
      htmlContent: m.html,
      textContent: m.text,
    }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 240);
    } catch {}
    // eslint-disable-next-line no-console
    console.error(
      `[brevo:${batchId}] FAIL to=${m.to} status=${res.status} body=${detail}`
    );
    throw new Error(`Brevo ${res.status}: ${detail}`);
  }
  let messageId: string | undefined;
  try {
    const json = (await res.json()) as { messageId?: string };
    messageId = json.messageId;
  } catch {}
  // eslint-disable-next-line no-console
  console.log(
    `[brevo:${batchId}] OK to=${m.to} messageId=${messageId ?? "?"} subject="${m.subject.slice(0, 60)}"`
  );
  return { messageId };
}

async function sendBatchBrevo(
  messages: EmailMessage[]
): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return {
      sent: 0,
      errors: ["BREVO_API_KEY not set"],
      provider: "brevo",
    };
  }
  // Defensive: drop duplicate (to, subject) pairs inside a single batch.
  // If anything upstream is enqueueing the same message N times, only one
  // copy goes out.
  const seen = new Set<string>();
  const dupes: string[] = [];
  const unique = messages.filter((m) => {
    const key = `${m.to.toLowerCase()}|${m.subject}`;
    if (seen.has(key)) {
      dupes.push(m.to);
      return false;
    }
    seen.add(key);
    return true;
  });
  // Per-batch correlation id so we can see in logs whether 1 logical send
  // is producing 1, 2 or 3 calls (debug for the "sending 3x" report).
  const batchId = Math.random().toString(36).slice(2, 8);
  // eslint-disable-next-line no-console
  console.log(
    `[brevo:${batchId}] START in=${messages.length} unique=${unique.length}${
      dupes.length > 0 ? ` dropped-dupes=[${dupes.join(", ").slice(0, 200)}]` : ""
    }`
  );
  messages = unique;
  const errors: string[] = [];
  let sent = 0;
  const CONCURRENCY = 5;
  for (let i = 0; i < messages.length; i += CONCURRENCY) {
    const slice = messages.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      slice.map((m) => sendOneBrevo(m, apiKey, batchId))
    );
    for (const r of results) {
      if (r.status === "fulfilled") sent += 1;
      else
        errors.push(
          r.reason instanceof Error ? r.reason.message : String(r.reason)
        );
    }
  }
  // eslint-disable-next-line no-console
  console.log(
    `[brevo:${batchId}] DONE sent=${sent} errors=${errors.length}`
  );
  return { sent, errors, provider: "brevo" };
}
