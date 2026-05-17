// Single-ticket portal page. Shows the message thread (sourced from
// Discourse, internal-note whispers filtered out) and a reply box.
// Access control:
//   • The submitter (matched by user_id OR email) sees their own
//     ticket.
//   • Authors (Sam + Mia) see any ticket — handy for a quick check
//     without bouncing to Discourse.
//   • Others get 404.

import { notFound } from "next/navigation";
import Link from "next/link";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import {
  getTicketByTopicId,
  fetchTicketThread,
  type TicketMessage,
  ticketUrl,
} from "@/lib/support-tickets";
import { replyToTicketAction } from "../actions";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ticket",
  robots: { index: false, follow: false },
};

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { ticketId } = await params;
  const sp = await searchParams;
  const topicId = parseInt(ticketId, 10);
  if (!Number.isFinite(topicId) || topicId <= 0) notFound();

  const ticket = await getTicketByTopicId(topicId);
  if (!ticket) notFound();

  const me = await currentUser();
  const isAuthor = me?.role === "author";
  const isSubmitter =
    !!me &&
    (ticket.submitterUserId === me.id ||
      (me.email &&
        ticket.submitterEmail.toLowerCase() === me.email.toLowerCase()));
  if (!isAuthor && !isSubmitter) notFound();

  const messages = await fetchTicketThread(topicId);

  const statusColor: Record<typeof ticket.status, string> = {
    open: "bg-coral text-white",
    pending: "bg-sun-deep text-navy",
    resolved: "bg-grass text-white",
    closed: "bg-navy-soft text-white",
  };

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-6 px-4 pb-14 flex flex-col gap-5">
        <div>
          <Link
            href="/support"
            className="font-body text-sm text-coral-deep underline"
          >
            ← All tickets
          </Link>
          <div className="flex items-baseline justify-between gap-3 flex-wrap mt-2">
            <h1 className="font-display text-3xl md:text-4xl text-navy">
              {ticket.subject}
            </h1>
            <span
              className={`font-display text-xs uppercase tracking-[0.18em] px-3 py-1 rounded-full border-2 border-navy ${statusColor[ticket.status]}`}
            >
              {ticket.status}
            </span>
          </div>
          <p className="font-body text-xs text-navy-soft mt-2">
            Submitted {ticket.createdAt.toLocaleString()} · ticket #
            {ticket.discourseTopicId}{" "}
            {isAuthor ? (
              <>
                ·{" "}
                <a
                  href={ticketUrl(ticket.discourseTopicId)}
                  className="text-coral-deep underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  open in Discourse →
                </a>
              </>
            ) : null}
          </p>
        </div>

        <section className="flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="card px-5 py-5 text-center text-navy-soft font-body">
              Loading messages… (or none yet)
            </div>
          ) : (
            messages.map((m) => <Message key={m.postId} message={m} />)
          )}
        </section>

        {ticket.status === "closed" || ticket.status === "resolved" ? (
          <div className="card px-5 py-4 bg-sky1 text-navy">
            <p className="font-display text-sm uppercase tracking-[0.18em]">
              This ticket is {ticket.status}
            </p>
            <p className="font-body text-base mt-2">
              If you need more help on this issue, please{" "}
              <Link href="/support" className="text-coral-deep underline">
                submit a new ticket
              </Link>
              .
            </p>
          </div>
        ) : (
          <form
            action={replyToTicketAction}
            className="card px-5 py-5 flex flex-col gap-3"
          >
            <input type="hidden" name="topicId" value={ticket.discourseTopicId} />
            {sp.err ? (
              <div className="border-3 border-navy bg-coral-soft text-white rounded-xl px-4 py-3 font-display text-sm">
                ⚠️ {decodeURIComponent(sp.err)}
              </div>
            ) : null}
            <label className="flex flex-col gap-1">
              <span className="font-display text-sm uppercase tracking-[0.18em] text-navy">
                Reply
              </span>
              <textarea
                name="message"
                required
                maxLength={4000}
                rows={5}
                className="input"
                placeholder="Add to this ticket. Sam + Mia will see it."
              />
            </label>
            <button type="submit" className="pop pop-coral text-base bob">
              💬 Send reply
            </button>
          </form>
        )}
      </div>
    </Stage>
  );
}

function Message({ message }: { message: TicketMessage }) {
  const me = message.authorIsBot
    ? { label: "🤖 Support Bot", className: "bg-sun text-navy" }
    : message.authorIsAdmin
      ? {
          label: `🛡️ ${message.authorName ?? message.authorUsername}`,
          className: "bg-coral text-white",
        }
      : {
          label: message.authorName ?? message.authorUsername,
          className: "bg-sky1 text-navy",
        };
  return (
    <div className="card px-5 py-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span
          className={`font-display text-xs uppercase tracking-[0.18em] px-3 py-1 rounded-full border-2 border-navy ${me.className}`}
        >
          {me.label}
        </span>
        <span className="font-body text-xs text-navy-soft">
          {message.postedAt.toLocaleString()}
        </span>
      </div>
      <div
        className="prose prose-sm mt-3 font-body text-navy max-w-none"
        // Discourse-cooked HTML is already sanitized server-side by
        // Discourse. Source of truth is the forum.
        dangerouslySetInnerHTML={{ __html: message.rawHtml }}
      />
    </div>
  );
}
