// Newsletter digest cron. Runs once a day; per-frequency:
//   - daily   : all subscribers with frequency='daily' get any
//               digest_eligible articles published since their
//               lastSentAt (or, if null, in the last 24h).
//   - weekly  : Sundays only — collects past 7d.
//   - monthly : first of the month only — collects past ~31d.
//
// All gated behind CRON_SECRET (same shape as /api/qotd/cron).
//
// Idempotent within a window: we update each subscriber's lastSentAt
// once we've sent them a digest. Re-running the cron the same day
// won't re-deliver because there'll be no NEW articles past lastSentAt.

import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, desc, eq, gt, isNotNull } from "drizzle-orm";
import {
  getActiveSubscriptions,
  markSent,
  publicBaseUrl,
  unsubscribeUrl,
} from "@/lib/newsletter";
import { renderDigestEmail } from "@/lib/article-render-email";
import { sendOne } from "@/lib/email-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(req: NextRequest): Promise<boolean> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return process.env.NODE_ENV === "development";
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}

type FrequencyName = "daily" | "weekly" | "monthly";

function shouldRunFrequencyToday(freq: FrequencyName, now: Date): boolean {
  switch (freq) {
    case "daily":
      return true;
    case "weekly":
      // Sunday in UTC — Vercel cron fires in UTC.
      return now.getUTCDay() === 0;
    case "monthly":
      return now.getUTCDate() === 1;
  }
}

function lookbackWindowMs(freq: FrequencyName): number {
  switch (freq) {
    case "daily":
      return 24 * 60 * 60 * 1000;
    case "weekly":
      return 7 * 24 * 60 * 60 * 1000;
    case "monthly":
      return 31 * 24 * 60 * 60 * 1000;
  }
}

async function pickArticlesSince(since: Date) {
  return db
    .select()
    .from(schema.articles)
    .where(
      and(
        eq(schema.articles.status, "published"),
        eq(schema.articles.digestEligible, true),
        eq(schema.articles.visibility, "public"),
        isNotNull(schema.articles.publishedAt),
        gt(schema.articles.publishedAt, since)
      )
    )
    .orderBy(desc(schema.articles.publishedAt))
    .limit(20);
}

async function runFrequency(freq: FrequencyName) {
  const subs = await getActiveSubscriptions({ frequency: freq });
  if (subs.length === 0) return { freq, sent: 0, skipped: 0 };

  const now = new Date();
  const windowStart = new Date(now.getTime() - lookbackWindowMs(freq));
  // Per-subscriber, we use the later of (their lastSentAt, window
  // start). Subscribers who joined yesterday + opted weekly should
  // still get the latest week's articles.
  let sent = 0;
  let skipped = 0;
  for (const sub of subs) {
    const since =
      sub.lastSentAt && sub.lastSentAt > windowStart
        ? sub.lastSentAt
        : windowStart;
    const articles = await pickArticlesSince(since);
    if (articles.length === 0) {
      skipped++;
      continue;
    }
    const items = articles.map((a) => ({
      title: a.title,
      dek: a.dek ?? a.subtitle ?? "",
      url: `${publicBaseUrl()}/blog/${a.slug}`,
      authorName: a.authorName,
    }));
    const intro =
      articles.length === 1
        ? "One new post since you last heard from us:"
        : `${articles.length} new posts since you last heard from us:`;
    const { html, text } = renderDigestEmail({
      intro,
      items,
      unsubscribeUrl: unsubscribeUrl(sub.unsubscribeToken),
      frequency: freq,
    });
    try {
      const from =
        process.env.EMAIL_FROM ||
        "Mia's Quiz Tournament <onboarding@resend.dev>";
      await sendOne({
        from,
        to: sub.email,
        subject: subjectForDigest(freq, articles.length),
        html,
        text,
        templateId: `newsletter-${freq}-digest`,
      });
      await markSent([sub.id]);
      sent++;
    } catch (e) {
      // Log + continue; one bad recipient shouldn't sink the batch.
      // eslint-disable-next-line no-console
      console.error("digest send failed:", sub.email, e);
      skipped++;
    }
  }
  return { freq, sent, skipped };
}

function subjectForDigest(freq: FrequencyName, count: number): string {
  const word = count === 1 ? "post" : "posts";
  switch (freq) {
    case "daily":
      return `📚 Today's Quiz Book — ${count} new ${word}`;
    case "weekly":
      return `📚 This week on the Quiz Book — ${count} new ${word}`;
    case "monthly":
      return `📚 This month's Quiz Book digest — ${count} new ${word}`;
  }
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const results: Awaited<ReturnType<typeof runFrequency>>[] = [];
  for (const freq of ["daily", "weekly", "monthly"] as const) {
    if (!shouldRunFrequencyToday(freq, now)) {
      results.push({ freq, sent: 0, skipped: 0 });
      continue;
    }
    try {
      results.push(await runFrequency(freq));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("frequency run failed:", freq, e);
      results.push({ freq, sent: 0, skipped: -1 });
    }
  }
  return NextResponse.json({ ok: true, results, ranAt: now.toISOString() });
}

// Vercel cron may POST.
export async function POST(req: NextRequest) {
  return GET(req);
}
