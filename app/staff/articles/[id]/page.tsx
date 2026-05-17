// Per-article editor (staff variant). Same client editor as before;
// just wires in the staff-flavored saveAction + permission flags.

import { notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { requireStaff } from "@/lib/staff-auth";
import { staffCan } from "@/lib/staff-permissions";
import { getArticleById } from "@/lib/articles";
import { ArticleEditorPage } from "@/components/articles/ArticleEditorPage";
import {
  validateBlocks,
  defaultBlocks,
  type ArticleBlock,
} from "@/lib/article-blocks";
import { saveArticleAction } from "../actions";
import {
  sendArticleTestAction,
  sendArticleSubscribersAction,
  sendArticleAllPlayersAction,
} from "./send-actions";

export const dynamic = "force-dynamic";

export default async function StaffArticleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireStaff({
    next: `/staff/articles/${id}`,
    permission: "articles:read",
  });

  const article = await getArticleById(id);
  if (!article) notFound();

  let blocks: ArticleBlock[];
  try {
    blocks = validateBlocks(article.bodyJson ?? []);
    if (blocks.length === 0) blocks = defaultBlocks();
  } catch {
    blocks = defaultBlocks();
  }

  const canWrite = staffCan(me.role, "articles:write");
  const canPublish = staffCan(me.role, "articles:publish");

  if (!canWrite) {
    // Read-only path — render the article body without the editor
    // chrome. Kept tight; the audit-only crowd doesn't need the full
    // surface here.
    return (
      <Stage scrollable>
        <div className="max-w-3xl mx-auto pt-4 px-4 pb-12 flex flex-col gap-4">
          <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
            <h1 className="font-display text-2xl text-navy">
              👁 {article.title}
            </h1>
            <span className="font-display text-xs px-3 py-1 rounded-full border-2 border-navy bg-sun text-navy">
              {article.status}
            </span>
          </div>
          <div className="card px-5 py-5">
            <p className="font-body text-sm text-navy-soft italic">
              You have <code>articles:read</code> but not{" "}
              <code>articles:write</code>. Ask an admin to bump your role.
            </p>
          </div>
        </div>
      </Stage>
    );
  }

  const canSendEmails = staffCan(me.role, "emails:write");
  const canSendBlast = canPublish && canSendEmails;

  return (
    <Stage scrollable>
      <div className="max-w-6xl mx-auto pt-4 px-4 pb-16 flex flex-col gap-4">
        <ArticleEditorPage
          article={article}
          initialBlocks={blocks}
          saveAction={saveArticleAction}
          backHref="/staff/articles"
          canPublish={canPublish}
        />

        {/* Send-as-email panel — only visible when the article is
            published. Test-send is available to anyone with
            articles:write; the blast targets require emails:write +
            articles:publish. */}
        {article.status === "published" ? (
          <div className="card px-6 py-5">
            <h2 className="font-display text-lg text-navy">
              📧 Use this article as an email
            </h2>
            <p className="font-body text-sm text-navy-soft mt-2">
              Renders the body via the picture-book email template and
              sends to the audience you choose. Per-recipient unsubscribe
              links are included for newsletter subscribers.
            </p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <form action={sendArticleTestAction} className="card-sm bg-white px-4 py-3 flex flex-col gap-2">
                <input type="hidden" name="id" value={article.id} />
                <p className="font-display text-sm text-navy">
                  🧪 Send a test
                </p>
                <p className="font-body text-xs text-navy-soft">
                  To <code>{me.email}</code> only. Always allowed.
                </p>
                <button className="pop pop-coral text-sm self-start">
                  Send test to me
                </button>
              </form>

              <form
                action={sendArticleSubscribersAction}
                className={
                  "card-sm px-4 py-3 flex flex-col gap-2 " +
                  (canSendBlast
                    ? "bg-white"
                    : "bg-white opacity-60 cursor-not-allowed")
                }
              >
                <input type="hidden" name="id" value={article.id} />
                <p className="font-display text-sm text-navy">
                  ✉️ Send to newsletter subscribers
                </p>
                <p className="font-body text-xs text-navy-soft">
                  Confirmed, non-unsubscribed subscribers only. Includes
                  one-click unsubscribe.
                </p>
                {canSendBlast ? (
                  <>
                    <input
                      name="confirm"
                      placeholder="Type SEND to confirm"
                      required
                      className="card-sm bg-white px-2 py-1 text-xs font-body border-2 border-navy"
                    />
                    <button className="pop pop-grass text-sm self-start">
                      ✉️ Send now
                    </button>
                  </>
                ) : (
                  <p className="font-body text-xs text-coral-deep">
                    Needs <code>articles:publish</code> +{" "}
                    <code>emails:write</code>.
                  </p>
                )}
              </form>

              <form
                action={sendArticleAllPlayersAction}
                className={
                  "card-sm px-4 py-3 flex flex-col gap-2 " +
                  (canSendBlast
                    ? "bg-white"
                    : "bg-white opacity-60 cursor-not-allowed")
                }
              >
                <input type="hidden" name="id" value={article.id} />
                <p className="font-display text-sm text-navy">
                  📣 Send to ALL players
                </p>
                <p className="font-body text-xs text-navy-soft">
                  Every <code>users.email</code>. Use sparingly — this
                  bypasses newsletter consent.
                </p>
                {canSendBlast ? (
                  <>
                    <input
                      name="confirm"
                      placeholder="Type SEND to confirm"
                      required
                      className="card-sm bg-white px-2 py-1 text-xs font-body border-2 border-navy"
                    />
                    <button className="pop pop-yellow text-sm self-start">
                      📣 Send blast
                    </button>
                  </>
                ) : (
                  <p className="font-body text-xs text-coral-deep">
                    Needs <code>articles:publish</code> +{" "}
                    <code>emails:write</code>.
                  </p>
                )}
              </form>
            </div>

            <p className="font-body text-xs text-navy-soft mt-4">
              All sends are logged in <code>staff_actions</code>. Each
              go-out is recorded under{" "}
              <code>article.send.test</code> /{" "}
              <code>article.send.subscribers</code> /{" "}
              <code>article.send.all-players</code>.
            </p>
          </div>
        ) : (
          <div className="card-sm bg-sun text-navy px-4 py-3">
            <p className="font-body text-sm">
              📧 Publish the article (status → Published) to unlock the
              email-send panel.
            </p>
          </div>
        )}
      </div>
    </Stage>
  );
}
