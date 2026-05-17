// Article CRUD + slug helpers + view-count bumps.
//
// All mutations go through `saveArticle` which validates `bodyJson`
// against the block schema, recomputes denormalized fields
// (bodyText/readMinutes), and updates updatedAt. Status transitions
// (draft → published) flip publishedAt.

import { db, schema } from "@/db";
import { and, asc, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { id as makeId, slug as makeSlug } from "@/lib/ids";
import {
  validateBlocks,
  blocksToPlainText,
  estimateReadMinutes,
  type ArticleBlock,
} from "@/lib/article-blocks";

const { articles } = schema;

export type ArticleRow = typeof articles.$inferSelect;
export type ArticleStatus = "draft" | "published" | "archived";
export type ArticleVisibility = "public" | "subscribers_only" | "unlisted";

export type SaveArticleInput = {
  // Provide id to update; omit to create.
  id?: string;
  slug?: string;
  title: string;
  subtitle?: string | null;
  dek?: string | null;
  coverImageUrl?: string | null;
  body: ArticleBlock[];
  status?: ArticleStatus;
  visibility?: ArticleVisibility;
  digestEligible?: boolean;
  // Author identification (caller decides which auth system applies).
  authorUserId?: string | null;
  authorStaffId?: string | null;
  authorName: string;
  authorAvatarUrl?: string | null;
};

export async function saveArticle(input: SaveArticleInput): Promise<ArticleRow> {
  const blocks = validateBlocks(input.body);
  const bodyText = blocksToPlainText(blocks);
  const readMinutes = estimateReadMinutes(bodyText);

  // Slug: caller-supplied or auto-derived from title. Collision handled
  // by appending a short random suffix.
  let slug = (input.slug ?? slugify(input.title)).slice(0, 80) || makeSlug();
  if (!input.id) {
    slug = await ensureUniqueSlug(slug);
  }

  const status = input.status ?? "draft";
  const now = new Date();

  if (input.id) {
    // Update path. Fetch existing to determine if status flipped to
    // published (so we set publishedAt once).
    const [existing] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, input.id))
      .limit(1);
    if (!existing) throw new Error("article not found");
    const publishedAt =
      status === "published" && !existing.publishedAt
        ? now
        : existing.publishedAt;

    const [row] = await db
      .update(articles)
      .set({
        slug: input.slug ?? existing.slug,
        title: input.title.trim(),
        subtitle: input.subtitle ?? null,
        dek: input.dek ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        bodyJson: blocks,
        bodyText,
        readMinutes,
        status,
        visibility: input.visibility ?? existing.visibility,
        digestEligible: input.digestEligible ?? existing.digestEligible,
        authorUserId: input.authorUserId ?? existing.authorUserId,
        authorStaffId: input.authorStaffId ?? existing.authorStaffId,
        authorName: input.authorName.trim(),
        authorAvatarUrl: input.authorAvatarUrl ?? existing.authorAvatarUrl,
        publishedAt,
        updatedAt: now,
      })
      .where(eq(articles.id, input.id))
      .returning();
    return row;
  }

  // Create path.
  const [row] = await db
    .insert(articles)
    .values({
      id: makeId(),
      slug,
      title: input.title.trim(),
      subtitle: input.subtitle ?? null,
      dek: input.dek ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      bodyJson: blocks,
      bodyText,
      readMinutes,
      status,
      visibility: input.visibility ?? "public",
      digestEligible: input.digestEligible ?? true,
      authorUserId: input.authorUserId ?? null,
      authorStaffId: input.authorStaffId ?? null,
      authorName: input.authorName.trim(),
      authorAvatarUrl: input.authorAvatarUrl ?? null,
      publishedAt: status === "published" ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

export async function deleteArticle(id: string) {
  await db.delete(articles).where(eq(articles.id, id));
}

export async function getArticleById(id: string): Promise<ArticleRow | null> {
  const [row] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  return row ?? null;
}

export async function getArticleBySlug(
  slug: string
): Promise<ArticleRow | null> {
  const [row] = await db
    .select()
    .from(articles)
    .where(eq(articles.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function listPublishedArticles(opts?: {
  limit?: number;
  offset?: number;
}): Promise<ArticleRow[]> {
  return db
    .select()
    .from(articles)
    .where(
      and(eq(articles.status, "published"), isNotNull(articles.publishedAt))
    )
    .orderBy(desc(articles.publishedAt))
    .limit(opts?.limit ?? 30)
    .offset(opts?.offset ?? 0);
}

// All articles regardless of status — author-facing dashboard.
export async function listAllArticles(): Promise<ArticleRow[]> {
  return db
    .select()
    .from(articles)
    .orderBy(desc(articles.updatedAt))
    .limit(200);
}

export async function bumpViewCount(id: string) {
  await db
    .update(articles)
    .set({ viewCount: sql`${articles.viewCount} + 1` })
    .where(eq(articles.id, id));
}

// ─── helpers ────────────────────────────────────────────────────────

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function ensureUniqueSlug(base: string): Promise<string> {
  const seed = base || makeSlug();
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? seed : `${seed}-${makeSlug().slice(0, 4)}`;
    const [existing] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  // Fallback — append fresh random.
  return `${seed}-${makeSlug()}`;
}
