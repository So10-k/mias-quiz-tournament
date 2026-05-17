// Public blog index — combined feed of native long-form articles
// (authored via /staff/articles, stored in the `articles` table)
// AND mirrored Discourse Announcements topics (fetched from the
// forum at request time, cached for 5 min).
//
// Native articles get the full ArticleCard treatment + a working
// /blog/[slug] page; mirrored topics get a MirrorCard variant that
// links straight to discuss.miaswebsites.art. Both sort by date so
// the timeline reads chronologically.
//
// Why two surfaces in one page: the native ones support the email
// digest pipeline (only those have block-document JSON we can
// re-render in HTML email). Mirrors are forum-native — quicker to
// post, no email path. Different tools for different scales.

import Link from "next/link";
import type { Metadata } from "next";
import { Stage } from "@/components/Stage";
import { ArticleCard } from "@/components/articles/ArticleCard";
import { MirrorCard } from "@/components/articles/MirrorCard";
import { AnswerCapsule } from "@/components/AnswerCapsule";
import {
  listPublishedArticles,
  type ArticleRow,
} from "@/lib/articles";
import {
  fetchAnnouncementTopics,
  type MirroredTopic,
} from "@/lib/forum-mirror";
import { ld, blogLD, breadcrumbLD, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Stories, tournament recaps, behind-the-scenes development notes, and weekly digests from Mia's Quiz Tournament — written by Sam and Mia.",
  alternates: { canonical: `${SITE_URL}/blog` },
};

type TimelineItem =
  | { kind: "native"; date: Date; article: ArticleRow }
  | { kind: "mirror"; date: Date; topic: MirroredTopic };

export default async function BlogIndex() {
  // Fetch native articles + forum mirror in parallel. Mirror is
  // wrapped in a try/catch so a Discourse outage never takes down
  // the blog index — we just fall back to native-only.
  const [articles, mirrorTopics] = await Promise.all([
    listPublishedArticles({ limit: 60 }),
    fetchAnnouncementTopics().catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error("forum mirror fetch failed:", err);
      return [] as Awaited<ReturnType<typeof fetchAnnouncementTopics>>;
    }),
  ]);

  // Build a single timeline + sort newest first. Native articles
  // use publishedAt; mirrors use postedAt.
  const timeline: TimelineItem[] = [
    ...articles.map<TimelineItem>((a) => ({
      kind: "native",
      date: a.publishedAt ?? a.updatedAt,
      article: a,
    })),
    ...mirrorTopics.map<TimelineItem>((t) => ({
      kind: "mirror",
      date: t.postedAt,
      topic: t,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const featured = timeline[0];
  const rest = timeline.slice(1);
  const empty = timeline.length === 0;

  return (
    <Stage scrollable>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ld(
          blogLD({
            articles: articles.map((a) => ({
              title: a.title,
              slug: a.slug,
              dek: a.dek,
            })),
          })
        )}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ld(
          breadcrumbLD([
            { name: "Home", url: SITE_URL },
            { name: "Blog", url: `${SITE_URL}/blog` },
          ])
        )}
      />
      <div className="max-w-5xl mx-auto pt-6 px-4 pb-14 flex flex-col gap-6">
        <AnswerCapsule
          topic="blog"
          question="What is the Quiz Book Blog?"
          answer="The Quiz Book Blog is the official publication of Mia's Quiz Tournament, a friends-and-family quiz site. Sam and Mia (age 7) post tournament recaps, behind-the-scenes development notes, player spotlights, and short essays. Subscribers can opt into daily, weekly, or monthly email digests."
        />
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.2em] text-coral-deep">
              Stories &amp; updates
            </p>
            <h1 className="font-display text-4xl md:text-6xl text-navy mt-1 drop-shadow-[3px_3px_0_var(--navy)]">
              The Quiz Book Blog
            </h1>
            <p className="font-body text-sm text-navy-soft mt-2 max-w-2xl">
              Long-form articles from Sam + Mia, plus shorter
              announcements posted to{" "}
              <a
                href="https://discuss.miaswebsites.art/c/announcements"
                className="text-coral-deep underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                the forum
              </a>{" "}
              — both show up here.
            </p>
          </div>
          <Link href="/blog/subscribe" className="pop pop-coral text-base bob">
            ✉️ Subscribe to digests
          </Link>
        </div>

        {empty ? (
          <div className="card px-7 py-7 text-center">
            <div className="text-5xl bob">📝</div>
            <h2 className="font-display text-2xl text-navy mt-3">
              No posts yet
            </h2>
            <p className="font-body text-base text-navy-soft mt-2">
              Mia and Sam are still writing. Check back soon.
            </p>
          </div>
        ) : (
          <>
            {featured ? (
              <div>
                {featured.kind === "native" ? (
                  <ArticleCard article={featured.article} size="lg" />
                ) : (
                  <MirrorCard topic={featured.topic} size="lg" />
                )}
              </div>
            ) : null}
            {rest.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rest.map((it) =>
                  it.kind === "native" ? (
                    <ArticleCard
                      key={`a-${it.article.id}`}
                      article={it.article}
                    />
                  ) : (
                    <MirrorCard
                      key={`t-${it.topic.id}`}
                      topic={it.topic}
                    />
                  )
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </Stage>
  );
}
