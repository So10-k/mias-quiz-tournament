// Dynamic XML sitemap for Mia's Quiz Tournament.
//
// Includes:
//   • Static landing pages (home, blog, listen, qotd, bracket, etc.)
//   • Every published blog article
//   • Today's QOTD (changes daily — short max-age)
// Excludes:
//   • Auth-gated paths (/play/*, /miamail, /predict, etc.)
//   • Staff + host portals
//   • API + tracking routes (filtered server-side)
//
// Next 15's MetadataRoute.Sitemap is rendered to XML; freshness comes
// from `lastModified` per entry plus a per-route `changeFrequency`.

import type { MetadataRoute } from "next";
import { listPublishedArticles } from "@/lib/articles";
import { getTodayQuestion } from "@/lib/qotd";

export const revalidate = 1800; // 30 minutes; cron-fresh enough.

const SITE_URL =
  process.env.PUBLIC_BASE_URL ?? "https://quiz.miaswebsites.art";

type Entry = {
  url: string;
  lastModified?: Date;
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: Entry[] = [
    { url: `${SITE_URL}/`, changeFrequency: "daily" as const, priority: 1.0, lastModified: now },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily" as const, priority: 0.9, lastModified: now },
    { url: `${SITE_URL}/blog/subscribe`, changeFrequency: "monthly" as const, priority: 0.6, lastModified: now },
    { url: `${SITE_URL}/qotd`, changeFrequency: "daily" as const, priority: 0.9, lastModified: now },
    { url: `${SITE_URL}/qotd/recommend`, changeFrequency: "monthly" as const, priority: 0.5, lastModified: now },
    { url: `${SITE_URL}/listen`, changeFrequency: "monthly" as const, priority: 0.7, lastModified: now },
    { url: `${SITE_URL}/bracket`, changeFrequency: "weekly" as const, priority: 0.7, lastModified: now },
    { url: `${SITE_URL}/players`, changeFrequency: "weekly" as const, priority: 0.7, lastModified: now },
    { url: `${SITE_URL}/standings`, changeFrequency: "weekly" as const, priority: 0.7, lastModified: now },
    { url: `${SITE_URL}/join`, changeFrequency: "monthly" as const, priority: 0.5, lastModified: now },
    { url: `${SITE_URL}/signin`, changeFrequency: "yearly" as const, priority: 0.3, lastModified: now },
  ];

  // Blog articles — only published, public visibility.
  let articleEntries: Entry[] = [];
  try {
    const articles = await listPublishedArticles({ limit: 200 });
    articleEntries = articles
      .filter(
        (a) => a.visibility === "public" && a.status === "published"
      )
      .map((a) => ({
        url: `${SITE_URL}/blog/${a.slug}`,
        lastModified: a.updatedAt ?? a.publishedAt ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
  } catch {
    // Sitemap should never crash the build. Fail soft.
  }

  // QOTD has its own canonical /qotd page that updates daily; the
  // historical "today's question" doesn't have its own URL, so we
  // leave it as a fresh-daily entry on /qotd.
  const qotd = await getTodayQuestion().catch(() => null);
  if (qotd) {
    const qotdEntry = staticEntries.find(
      (e) => e.url === `${SITE_URL}/qotd`
    );
    if (qotdEntry) {
      qotdEntry.lastModified = qotd.createdAt ?? now;
    }
  }

  return [...staticEntries, ...articleEntries];
}
