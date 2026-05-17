// Public article page. Renders the validated bodyJson via the
// picture-book ArticleRenderer. Fires a fire-and-forget view-count
// bump.

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { ArticleRenderer } from "@/components/articles/ArticleRenderer";
import {
  bumpViewCount,
  getArticleBySlug,
} from "@/lib/articles";
import {
  validateBlocks,
  type ArticleBlock,
} from "@/lib/article-blocks";
import {
  ld,
  articleLD,
  breadcrumbLD,
  SITE_URL,
} from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticleBySlug(slug);
  if (!a || a.status !== "published") {
    return { title: "Not found", robots: { index: false } };
  }
  return {
    title: a.title,
    description: a.dek ?? a.bodyText.slice(0, 200),
    alternates: { canonical: `${SITE_URL}/blog/${a.slug}` },
    openGraph: {
      type: "article",
      title: a.title,
      description: a.dek ?? a.bodyText.slice(0, 200),
      url: `${SITE_URL}/blog/${a.slug}`,
      publishedTime: a.publishedAt?.toISOString(),
      modifiedTime: a.updatedAt?.toISOString(),
      authors: [a.authorName],
      images: a.coverImageUrl ? [a.coverImageUrl] : undefined,
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();
  // Drafts/archived → 404 from the public path. Unlisted is allowed
  // (those are link-only) but subscribers_only requires a logged-in
  // user check — we'll defer to v2; for now treat as public.
  if (article.status !== "published") notFound();

  // Validate blocks once at render. If the row was tampered with we
  // still render whatever validates and ignore the rest, rather than
  // blowing up the whole page.
  let blocks: ArticleBlock[] = [];
  try {
    blocks = validateBlocks(article.bodyJson ?? []);
  } catch {
    blocks = [];
  }

  // Fire-and-forget view count. Don't await — the user shouldn't wait
  // on a write for a read.
  void bumpViewCount(article.id).catch(() => {});

  return (
    <Stage scrollable>
      {/* JSON-LD: Article schema for the post + BreadcrumbList for
          context. Both reference the site-wide #org from the root
          layout via @id. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ld(
          articleLD({
            title: article.title,
            slug: article.slug,
            dek: article.dek,
            authorName: article.authorName,
            publishedAt: article.publishedAt,
            updatedAt: article.updatedAt,
            coverImageUrl: article.coverImageUrl,
            bodyText: article.bodyText,
            readMinutes: article.readMinutes,
          })
        )}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ld(
          breadcrumbLD([
            { name: "Home", url: SITE_URL },
            { name: "Blog", url: `${SITE_URL}/blog` },
            {
              name: article.title,
              url: `${SITE_URL}/blog/${article.slug}`,
            },
          ])
        )}
      />
      <div className="max-w-3xl mx-auto pt-6 px-4 pb-16 flex flex-col gap-6">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <Link href="/blog" className="pop pop-white text-sm">
            ← All posts
          </Link>
          <Link
            href="/blog/subscribe"
            className="font-display text-xs px-3 py-1 rounded-full border-2 border-navy bg-coral text-white"
          >
            ✉️ Subscribe
          </Link>
        </div>

        {article.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.coverImageUrl}
            alt=""
            className="w-full rounded-2xl border-4 border-navy shadow-pop-sm aspect-[3/2] object-cover"
          />
        ) : null}

        <header>
          <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
            {article.publishedAt
              ? new Date(article.publishedAt).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : ""}{" "}
            · {article.readMinutes} min read
          </p>
          <h1 className="font-display text-4xl md:text-6xl text-navy mt-2 leading-tight">
            {article.title}
          </h1>
          {article.subtitle ? (
            <p className="font-display text-xl md:text-2xl text-navy-soft mt-2">
              {article.subtitle}
            </p>
          ) : null}
          {article.dek ? (
            <p className="font-body text-base text-navy-soft mt-3 italic">
              {article.dek}
            </p>
          ) : null}
          <p className="font-body text-sm text-navy-soft mt-4">
            By <strong className="text-navy">{article.authorName}</strong>
          </p>
        </header>

        <article className="card px-6 md:px-8 py-7 md:py-9">
          <ArticleRenderer blocks={blocks} />
        </article>

        <footer className="card-sm px-5 py-5 bg-sky1 flex flex-col items-center text-center gap-2">
          <p className="font-display text-lg text-navy">
            Want more like this?
          </p>
          <Link href="/blog/subscribe" className="pop pop-coral text-base">
            ✉️ Subscribe to digests
          </Link>
        </footer>
      </div>
    </Stage>
  );
}
