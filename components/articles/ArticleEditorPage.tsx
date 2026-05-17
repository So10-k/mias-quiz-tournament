"use client";

// Top-level wrapper around <ArticleEditor/>. Owns the form state for
// the article meta (title, dek, cover, status, visibility) and posts
// the whole thing as a single JSON payload to the server action.
//
// We keep this as one big form so the existing audit/permissions stack
// (rate limits, auth gate, revalidation) flows through one server
// action call. The block array is serialized into a hidden field.

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArticleEditor } from "@/components/articles/ArticleEditor";
import {
  validateBlocks,
  type ArticleBlock,
} from "@/lib/article-blocks";
import type { ArticleRow } from "@/lib/articles";

type Props = {
  article: ArticleRow;
  initialBlocks: ArticleBlock[];
  // Server Action passed in by the parent (server) page so this client
  // component is agnostic to which auth stack (host vs staff) owns the
  // save. Must accept the same FormData payload (id + JSON blob).
  saveAction: (formData: FormData) => Promise<void>;
  // Path to navigate back to (typically `/staff/articles`). Shown in
  // the sticky header so the editor doesn't have to assume a route.
  backHref: string;
  // Whether the current user can publish. When false, the status
  // dropdown is restricted to draft/archived. (Drafts can still be
  // saved.)
  canPublish: boolean;
};

export function ArticleEditorPage({
  article,
  initialBlocks,
  saveAction,
  backHref,
  canPublish,
}: Props) {
  const [title, setTitle] = useState(article.title);
  const [subtitle, setSubtitle] = useState(article.subtitle ?? "");
  const [dek, setDek] = useState(article.dek ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(
    article.coverImageUrl ?? ""
  );
  const [status, setStatus] = useState<ArticleRow["status"]>(article.status);
  const [visibility, setVisibility] = useState<ArticleRow["visibility"]>(
    article.visibility
  );
  const [digestEligible, setDigestEligible] = useState<boolean>(
    article.digestEligible
  );
  const [blocks, setBlocks] = useState<ArticleBlock[]>(initialBlocks);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Beforeunload guard if there are unsaved changes (heuristic: any
  // edit since the last save bumps a counter).
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const markDirty = () => setDirty(true);

  const submit = () => {
    setError(null);
    // Client-side block validation as well so we surface obvious shape
    // bugs before the server roundtrip.
    try {
      validateBlocks(blocks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "invalid blocks");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", article.id);
      fd.set(
        "payload",
        JSON.stringify({
          title,
          subtitle: subtitle || null,
          dek: dek || null,
          coverImageUrl: coverImageUrl || null,
          body: blocks,
          status,
          visibility,
          digestEligible,
        })
      );
      try {
        await saveAction(fd);
        setSavedAt(new Date());
        setDirty(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "save failed");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap sticky top-2 z-30 backdrop-blur">
        <div className="flex items-baseline gap-3 flex-wrap">
          <Link href={backHref} className="pop pop-white text-sm">
            ← Articles
          </Link>
          {article.status === "published" ? (
            <Link
              href={`/blog/${article.slug}`}
              className="font-body text-sm text-coral-deep underline"
            >
              /blog/{article.slug}
            </Link>
          ) : (
            <span className="font-body text-xs text-navy-soft">
              draft · slug locked until first publish
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {savedAt ? (
            <span className="font-body text-xs text-grass-deep">
              ✓ saved {savedAt.toLocaleTimeString()}
            </span>
          ) : null}
          {dirty ? (
            <span className="font-body text-xs text-coral-deep">
              ● unsaved
            </span>
          ) : null}
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="pop pop-coral text-sm"
          >
            {pending ? "Saving…" : "💾 Save"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="card-sm bg-coral-deep text-white px-4 py-3">
          <p className="font-display text-sm">⚠️ {error}</p>
        </div>
      ) : null}

      <div className="card px-5 py-5 flex flex-col gap-3">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markDirty();
          }}
          placeholder="Title"
          className="font-display text-3xl md:text-4xl text-navy bg-transparent border-0 border-b-3 border-navy pb-1 focus:outline-none focus:border-coral-deep"
          maxLength={120}
        />
        <input
          value={subtitle}
          onChange={(e) => {
            setSubtitle(e.target.value);
            markDirty();
          }}
          placeholder="Subtitle (optional)"
          className="font-display text-xl text-navy-soft bg-transparent border-0 border-b-2 border-navy/40 pb-1 focus:outline-none focus:border-coral-deep"
          maxLength={200}
        />
        <textarea
          value={dek}
          onChange={(e) => {
            setDek(e.target.value);
            markDirty();
          }}
          placeholder="Dek — 1–2 sentence summary for the index card and email preheader"
          rows={2}
          className="card-sm bg-white px-3 py-2 font-body text-base border-2 border-navy"
          maxLength={300}
        />
        <input
          value={coverImageUrl}
          onChange={(e) => {
            setCoverImageUrl(e.target.value);
            markDirty();
          }}
          placeholder="Cover image URL (paste from /host/files)"
          className="card-sm bg-white px-3 py-1.5 font-body text-sm border-2 border-navy"
          maxLength={800}
        />
        <div className="flex flex-wrap gap-3 items-stretch">
          <label className="font-display text-xs text-navy flex flex-col gap-1">
            Status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as typeof status);
                markDirty();
              }}
              className="card-sm bg-white px-2 py-1 border-2 border-navy text-base font-body"
            >
              <option value="draft">Draft</option>
              {canPublish ? (
                <option value="published">Published</option>
              ) : null}
              <option value="archived">Archived</option>
            </select>
            {!canPublish ? (
              <p className="font-body text-xs text-navy-soft mt-1">
                You can save drafts. Publishing requires{" "}
                <code>articles:publish</code>.
              </p>
            ) : null}
          </label>
          <label className="font-display text-xs text-navy flex flex-col gap-1">
            Visibility
            <select
              value={visibility}
              onChange={(e) => {
                setVisibility(e.target.value as typeof visibility);
                markDirty();
              }}
              className="card-sm bg-white px-2 py-1 border-2 border-navy text-base font-body"
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted (link-only)</option>
              <option value="subscribers_only">Subscribers only</option>
            </select>
          </label>
          <label className="font-display text-xs text-navy flex flex-col gap-1 justify-end">
            <span>Newsletter</span>
            <label className="font-body text-sm text-navy flex items-center gap-2 card-sm bg-white px-3 py-1.5 border-2 border-navy">
              <input
                type="checkbox"
                checked={digestEligible}
                onChange={(e) => {
                  setDigestEligible(e.target.checked);
                  markDirty();
                }}
              />
              Include in digest
            </label>
          </label>
        </div>
      </div>

      <ArticleEditor
        blocks={blocks}
        onChange={(next) => {
          setBlocks(next);
          markDirty();
        }}
      />
    </div>
  );
}
