"use server";

// "Send article as email" actions. Reuse the article block-document
// renderer (lib/article-render-email.ts) to produce the email body,
// then push through the existing sendOne / sendBatch pipeline.
//
// Three send modes:
//   sendArticleTestAction     — to me only. articles:write.
//   sendArticleSubscribersAction — to confirmed newsletter subscribers.
//                                  articles:publish + emails:write.
//   sendArticleAllPlayersAction  — to every users.email row.
//                                  articles:publish + emails:write.
//
// All audited via logStaffAction. Per-recipient unsubscribe URLs are
// included in the "subscribers" mode so leaving is one click; the
// "all players" mode goes through the same Miamail logging the rest
// of /host/announce uses (sendBatch handles that automatically).

import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { eq, isNotNull, isNull, and } from "drizzle-orm";
import { requireStaff } from "@/lib/staff-auth";
import { staffCan } from "@/lib/staff-permissions";
import { logStaffAction } from "@/lib/staff-audit";
import { getArticleById } from "@/lib/articles";
import { validateBlocks } from "@/lib/article-blocks";
import { renderArticleEmail } from "@/lib/article-render-email";
import { sendOne, sendBatch, type EmailMessage } from "@/lib/email-provider";
import {
  publicBaseUrl,
  unsubscribeUrl,
} from "@/lib/newsletter";

function from(): string {
  return (
    process.env.EMAIL_FROM ||
    "Mia's Quiz Tournament <onboarding@resend.dev>"
  );
}

async function loadArticleOr404(id: string) {
  const article = await getArticleById(id);
  if (!article) throw new Error("article not found");
  if (article.status !== "published") {
    throw new Error("article must be published before sending");
  }
  return article;
}

function buildArticleEmailBody(
  article: Awaited<ReturnType<typeof getArticleById>>,
  unsubscribe?: string
) {
  if (!article) throw new Error("article missing");
  const blocks = validateBlocks(article.bodyJson ?? []);
  return renderArticleEmail({
    title: article.title,
    subtitle: article.subtitle,
    dek: article.dek,
    authorName: article.authorName,
    blocks,
    publicUrl: `${publicBaseUrl()}/blog/${article.slug}`,
    unsubscribeUrl: unsubscribe,
  });
}

// ─── send to me only ─────────────────────────────────────────────

export async function sendArticleTestAction(formData: FormData) {
  const me = await requireStaff({
    next: "/staff/articles",
    permission: "articles:write",
  });
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");
  const article = await loadArticleOr404(id);
  const { html, text } = buildArticleEmailBody(article);
  await sendOne({
    from: from(),
    to: me.email,
    subject: `[TEST] ${article.title}`,
    html,
    text,
    templateId: `article-${article.id}`,
  });
  await logStaffAction({
    action: "article.send.test",
    target: id,
    details: { to: me.email, slug: article.slug },
    actor: { id: me.id, email: me.email },
  });
  revalidatePath(`/staff/articles/${id}`);
}

// ─── send to confirmed newsletter subscribers ────────────────────

export async function sendArticleSubscribersAction(formData: FormData) {
  const me = await requireStaff({
    next: "/staff/articles",
    permission: "articles:publish",
  });
  if (!staffCan(me.role, "emails:write")) {
    throw new Error("forbidden — missing emails:write");
  }
  const id = String(formData.get("id") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!id) throw new Error("missing id");
  if (confirm !== "SEND") throw new Error("confirm=SEND required");
  const article = await loadArticleOr404(id);

  // Pull confirmed, non-unsubscribed subscribers.
  const subs = await db
    .select()
    .from(schema.newsletterSubscriptions)
    .where(
      and(
        isNotNull(schema.newsletterSubscriptions.confirmedAt),
        isNull(schema.newsletterSubscriptions.unsubscribedAt)
      )
    );

  const messages: EmailMessage[] = subs.map((s) => {
    const { html, text } = buildArticleEmailBody(
      article,
      unsubscribeUrl(s.unsubscribeToken)
    );
    return {
      from: from(),
      to: s.email,
      subject: article.title,
      html,
      text,
      templateId: `article-${article.id}`,
    };
  });

  let sent = 0;
  if (messages.length > 0) {
    const result = await sendBatch(messages);
    sent = result.sent;
  }

  await logStaffAction({
    action: "article.send.subscribers",
    target: id,
    details: {
      slug: article.slug,
      attempted: messages.length,
      sent,
    },
    actor: { id: me.id, email: me.email },
  });

  revalidatePath(`/staff/articles/${id}`);
}

// ─── send to every player ────────────────────────────────────────

export async function sendArticleAllPlayersAction(formData: FormData) {
  const me = await requireStaff({
    next: "/staff/articles",
    permission: "articles:publish",
  });
  if (!staffCan(me.role, "emails:write")) {
    throw new Error("forbidden — missing emails:write");
  }
  const id = String(formData.get("id") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!id) throw new Error("missing id");
  if (confirm !== "SEND") throw new Error("confirm=SEND required");
  const article = await loadArticleOr404(id);

  const players = await db
    .select({ email: schema.users.email })
    .from(schema.users);

  const messages: EmailMessage[] = players
    .filter((p) => p.email)
    .map((p) => {
      const { html, text } = buildArticleEmailBody(article);
      return {
        from: from(),
        to: p.email!,
        subject: article.title,
        html,
        text,
        templateId: `article-${article.id}`,
      };
    });

  let sent = 0;
  if (messages.length > 0) {
    const result = await sendBatch(messages);
    sent = result.sent;
  }

  await logStaffAction({
    action: "article.send.all-players",
    target: id,
    details: {
      slug: article.slug,
      attempted: messages.length,
      sent,
    },
    actor: { id: me.id, email: me.email },
  });

  revalidatePath(`/staff/articles/${id}`);
}
