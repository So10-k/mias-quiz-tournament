"use server";

// Staff-portal server actions for the article CMS. Auth is via staff
// session (Duo / Auth0 Org); permission gates use staffCan() so each
// permission level lines up with role:
//
//   articles:read    — viewer (lists + reads only)
//   articles:write   — editor (drafts, edits)
//   articles:publish — editor (flips status to published)
//   articles:delete  — admin
//
// Every mutation logs a row in `staff_actions` for the audit feed.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/staff-auth";
import { staffCan } from "@/lib/staff-permissions";
import { logStaffAction } from "@/lib/staff-audit";
import {
  saveArticle,
  deleteArticle,
  getArticleById,
  type ArticleStatus,
  type ArticleVisibility,
} from "@/lib/articles";
import { validateBlocks, type ArticleBlock } from "@/lib/article-blocks";

async function gate(perm: Parameters<typeof staffCan>[1]) {
  const me = await requireStaff({
    next: "/staff/articles",
    permission: perm,
  });
  return me;
}

export async function createArticleAction(formData: FormData) {
  const me = await gate("articles:write");
  const title = String(formData.get("title") ?? "").trim() || "Untitled";
  const row = await saveArticle({
    title,
    body: [],
    status: "draft",
    authorStaffId: me.id,
    authorName: me.name ?? me.email ?? "Staff",
  });
  await logStaffAction({
    action: "article.create",
    target: row.id,
    details: { title: row.title, slug: row.slug },
    actor: { id: me.id, email: me.email },
  });
  revalidatePath("/staff/articles");
  redirect(`/staff/articles/${row.id}`);
}

type SaveInput = {
  title: string;
  subtitle?: string | null;
  dek?: string | null;
  coverImageUrl?: string | null;
  body: ArticleBlock[];
  status: ArticleStatus;
  visibility: ArticleVisibility;
  digestEligible: boolean;
};

export async function saveArticleAction(formData: FormData) {
  const me = await gate("articles:write");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");
  const payloadRaw = String(formData.get("payload") ?? "");
  let payload: SaveInput;
  try {
    payload = JSON.parse(payloadRaw) as SaveInput;
  } catch {
    throw new Error("invalid payload");
  }
  const blocks = validateBlocks(payload.body);
  const existing = await getArticleById(id);
  if (!existing) throw new Error("article not found");

  // Publish gate — only allow flipping to published if the actor has
  // articles:publish. Falling back to existing status preserves the
  // previous state without erroring (so a draft-saver can still save
  // a draft of an already-published article).
  let nextStatus: ArticleStatus = payload.status;
  if (
    payload.status === "published" &&
    existing.status !== "published" &&
    !staffCan(me.role, "articles:publish")
  ) {
    nextStatus = "draft";
  }

  await saveArticle({
    id,
    title: payload.title || existing.title,
    subtitle: payload.subtitle ?? null,
    dek: payload.dek ?? null,
    coverImageUrl: payload.coverImageUrl ?? null,
    body: blocks,
    status: nextStatus,
    visibility: payload.visibility,
    digestEligible: payload.digestEligible,
    authorUserId: existing.authorUserId,
    authorStaffId: existing.authorStaffId ?? me.id,
    authorName: existing.authorName,
  });

  await logStaffAction({
    action:
      nextStatus !== existing.status
        ? `article.status.${nextStatus}`
        : "article.save",
    target: id,
    details: {
      slug: existing.slug,
      titlePreview: payload.title.slice(0, 60),
      blocks: blocks.length,
      visibility: payload.visibility,
    },
    actor: { id: me.id, email: me.email },
  });

  revalidatePath("/staff/articles");
  revalidatePath(`/staff/articles/${id}`);
  revalidatePath(`/blog/${existing.slug}`);
  revalidatePath("/blog");
}

export async function deleteArticleAction(formData: FormData) {
  const me = await gate("articles:delete");
  const id = String(formData.get("id") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!id) throw new Error("missing id");
  if (confirm !== "DELETE") {
    throw new Error("delete requires confirm=DELETE");
  }
  const existing = await getArticleById(id);
  if (!existing) throw new Error("article not found");
  await deleteArticle(id);
  await logStaffAction({
    action: "article.delete",
    target: id,
    details: { slug: existing.slug, title: existing.title },
    actor: { id: me.id, email: me.email },
  });
  revalidatePath("/staff/articles");
  redirect("/staff/articles");
}
