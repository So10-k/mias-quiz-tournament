// Staff-portal article list. Permission gates:
//   articles:read   — required to view this page at all
//   articles:write  — required to see the "create" form
//   articles:delete — required to see the delete affordance

import Link from "next/link";
import { Stage } from "@/components/Stage";
import { requireStaff } from "@/lib/staff-auth";
import { staffCan } from "@/lib/staff-permissions";
import { listAllArticles } from "@/lib/articles";
import {
  createArticleAction,
  deleteArticleAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function StaffArticlesPage() {
  const me = await requireStaff({
    next: "/staff/articles",
    permission: "articles:read",
  });
  const canWrite = staffCan(me.role, "articles:write");
  const canDelete = staffCan(me.role, "articles:delete");

  const articles = await listAllArticles();
  const published = articles.filter((a) => a.status === "published");
  const drafts = articles.filter((a) => a.status === "draft");
  const archived = articles.filter((a) => a.status === "archived");

  return (
    <Stage scrollable>
      <div className="max-w-4xl mx-auto pt-4 px-4 pb-12 flex flex-col gap-4">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-2xl text-navy">📝 Articles</h1>
          <div className="flex items-center gap-2">
            <Link href="/blog" className="pop pop-white text-sm">
              👁 Public blog
            </Link>
            <Link href="/staff" className="pop pop-white text-sm">
              ← Staff
            </Link>
          </div>
        </div>

        {canWrite ? (
          <div className="card px-6 py-5">
            <h2 className="font-display text-lg text-navy">
              ✨ Start a new article
            </h2>
            <form action={createArticleAction} className="mt-3 flex gap-2">
              <input
                name="title"
                defaultValue="New article"
                maxLength={120}
                className="card-sm bg-white px-3 py-1.5 flex-1 font-body text-base border-2 border-navy"
                required
              />
              <button className="pop pop-coral text-base">Create</button>
            </form>
            <p className="font-body text-xs text-navy-soft mt-2">
              Creates a draft. You&rsquo;ll be redirected to the editor.
            </p>
          </div>
        ) : (
          <div className="card-sm bg-sun text-navy px-4 py-3">
            <p className="font-display text-sm">
              👁 Read-only view — your role doesn&rsquo;t have{" "}
              <code>articles:write</code>.
            </p>
          </div>
        )}

        <Section
          title="Drafts"
          articles={drafts}
          emptyText="No drafts."
          canDelete={canDelete}
        />
        <Section
          title="Published"
          articles={published}
          emptyText="Nothing published yet."
          canDelete={canDelete}
        />
        {archived.length > 0 ? (
          <Section
            title="Archived"
            articles={archived}
            emptyText=""
            canDelete={canDelete}
          />
        ) : null}
      </div>
    </Stage>
  );
}

function Section({
  title,
  articles,
  emptyText,
  canDelete,
}: {
  title: string;
  articles: Awaited<ReturnType<typeof listAllArticles>>;
  emptyText: string;
  canDelete: boolean;
}) {
  return (
    <div className="card px-6 py-5">
      <h2 className="font-display text-lg text-navy">{title}</h2>
      {articles.length === 0 ? (
        <p className="font-body text-sm text-navy-soft italic mt-2">
          {emptyText}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {articles.map((a) => (
            <li
              key={a.id}
              className="card-sm bg-white px-3 py-2 flex items-center gap-3 flex-wrap"
            >
              <span className="font-display text-base text-navy flex-1 min-w-0 truncate">
                {a.title}
              </span>
              <span className="font-body text-xs text-navy-soft">
                by {a.authorName}
              </span>
              <span className="font-body text-xs text-navy-soft">
                · {new Date(a.updatedAt).toLocaleDateString()}
              </span>
              <Link
                href={`/staff/articles/${a.id}`}
                className="pop pop-coral text-xs px-3 py-1"
              >
                ✏️ open
              </Link>
              {a.status === "published" ? (
                <Link
                  href={`/blog/${a.slug}`}
                  className="pop pop-sky text-xs px-3 py-1"
                >
                  👁 view
                </Link>
              ) : null}
              {canDelete ? (
                <details>
                  <summary className="font-body text-xs text-coral-deep cursor-pointer">
                    ⚠ delete
                  </summary>
                  <form
                    action={deleteArticleAction}
                    className="mt-2 flex gap-2"
                  >
                    <input type="hidden" name="id" value={a.id} />
                    <input
                      name="confirm"
                      placeholder="Type DELETE"
                      className="card-sm bg-white px-2 py-1 text-xs font-body border-2 border-navy"
                      required
                    />
                    <button className="pop pop-white text-xs px-2 py-1">
                      confirm
                    </button>
                  </form>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
