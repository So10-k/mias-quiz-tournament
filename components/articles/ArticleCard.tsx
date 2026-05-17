// Compact article card for blog index + related-posts strips. Picture-
// book themed: thick navy border, bobbing on hover, sun/coral accents.

import Link from "next/link";
import type { ArticleRow } from "@/lib/articles";

export function ArticleCard({
  article,
  size = "md",
}: {
  article: ArticleRow;
  size?: "sm" | "md" | "lg";
}) {
  const fontSize = size === "lg" ? "text-3xl md:text-4xl" : "text-2xl";
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="card px-5 py-5 flex flex-col gap-3 hover:-translate-y-0.5 transition-transform"
      style={{ textDecoration: "none" }}
    >
      {article.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.coverImageUrl}
          alt=""
          className="w-full rounded-xl border-3 border-navy aspect-[3/2] object-cover"
        />
      ) : (
        <div
          className="w-full rounded-xl border-3 border-navy aspect-[3/2] flex items-center justify-center text-6xl"
          style={{
            background:
              "linear-gradient(135deg,#FFE873 0%,#FFB627 60%,#FF8C42 100%)",
          }}
        >
          📖
        </div>
      )}
      <div>
        <p className="font-display text-xs uppercase tracking-[0.18em] text-coral-deep">
          {article.publishedAt
            ? new Date(article.publishedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Draft"}{" "}
          · {article.readMinutes} min read
        </p>
        <h2
          className={`font-display ${fontSize} text-navy mt-1 leading-tight`}
        >
          {article.title}
        </h2>
        {article.dek ? (
          <p className="font-body text-sm md:text-base text-navy-soft mt-2 line-clamp-3">
            {article.dek}
          </p>
        ) : null}
        <p className="font-body text-xs text-navy-soft mt-2">
          By {article.authorName}
        </p>
      </div>
    </Link>
  );
}
