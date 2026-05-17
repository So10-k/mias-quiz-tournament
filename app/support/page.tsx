// Support portal home.
//   • Logged-out: just the new-ticket form
//   • Logged-in:  list of "Your tickets" + new-ticket form
//
// The thread itself + reply box live at /support/[id].

import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { submitSupportTicket } from "./actions";
import { listTicketsForUser, type LocalTicket } from "@/lib/support-tickets";
import { SupportDoor } from "./SupportDoor";
import Link from "next/link";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Submit a support ticket and track replies. Mia's Quiz Tournament support portal.",
  alternates: { canonical: `${SITE_URL}/support` },
};

export const dynamic = "force-dynamic";

export default async function SupportPortal({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const me = await currentUser();
  const sp = await searchParams;
  const success = !!sp.ok;
  const errMsg = sp.err ? decodeURIComponent(sp.err) : null;

  const myTickets =
    me && me.id ? await listTicketsForUser(me.id) : [];

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-6 px-4 pb-14 flex flex-col gap-6">
        <header>
          <p className="font-display text-sm uppercase tracking-[0.2em] text-coral-deep">
            Need a hand?
          </p>
          <h1 className="font-display text-4xl md:text-6xl text-navy mt-1 drop-shadow-[3px_3px_0_var(--navy)]">
            Support
          </h1>
          <p className="font-body text-base text-navy-soft mt-3 max-w-xl">
            Three ways in — pick whichever fits. Chat&rsquo;s the
            fastest. {me ? (
              <>
                Signed in as <strong>{me.name ?? me.email}</strong>.
              </>
            ) : (
              <>
                Sign in first if you want to track your tickets across
                visits.
              </>
            )}
          </p>
        </header>

        {/* ── Three doors: chat, ticket, help center ────────────── */}
        <section className="grid md:grid-cols-3 gap-3">
          <SupportDoor
            tone="bg-coral-deep text-white border-navy"
            primary
            emoji="💬"
            label="Chat now"
            tagline="Live · 24/7 AI · escalates to Sam"
            body="The fastest path. Tap chat and ask anything — Mia's sun mascot opens the messenger."
            actionLabel="Open chat →"
            jsAction="open-intercom"
          />
          <SupportDoor
            tone="bg-sun text-navy border-coral-deep"
            emoji="📋"
            label="File a ticket"
            tagline="Email-first · best for bugs"
            body="Drop us a structured note — we'll email you back, usually within a day. Your thread shows up below."
            actionLabel="Use the form ↓"
            scrollTo="#ticket-form"
          />
          <SupportDoor
            tone="bg-sky1 text-navy border-navy"
            emoji="📚"
            label="Help center"
            tagline="Browse · self-serve"
            body="Common answers about the bracket, predictions, sign-in, the forum, and the broadcast night."
            actionLabel="Browse articles →"
            jsAction="open-intercom-articles"
          />
        </section>

        {/* Existing tickets card — only for signed-in users */}
        {me && myTickets.length > 0 ? (
          <section className="card px-5 py-5">
            <h2 className="font-display text-2xl text-navy">
              Your tickets ({myTickets.length})
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {myTickets.map((t) => (
                <TicketRow key={t.id} ticket={t} />
              ))}
            </div>
          </section>
        ) : null}

        {success ? (
          <div className="card px-6 py-6 bg-grass-soft text-navy">
            <div className="text-5xl">✅</div>
            <h2 className="font-display text-2xl mt-2">Got it!</h2>
            <p className="font-body text-base mt-2">
              Your ticket reached the inbox. We&rsquo;ll email you back
              soon. {me ? (
                <>It&rsquo;s also visible above with status updates.</>
              ) : null}
            </p>
            <Link
              href="/support"
              className="pop pop-coral text-sm mt-4 inline-block"
            >
              Submit another →
            </Link>
          </div>
        ) : (
          <section id="ticket-form" className="card px-5 py-5">
            <h2 className="font-display text-2xl text-navy mb-3">
              Submit a new ticket
            </h2>
            <p className="font-body text-xs text-navy-soft -mt-2 mb-3 italic">
              Best for bugs, account problems, anything where you want a
              durable email thread. For quick questions, the chat door
              above is faster.
            </p>
            <form
              action={submitSupportTicket}
              className="flex flex-col gap-4"
            >
              {errMsg ? (
                <div className="border-3 border-navy bg-coral-soft text-white rounded-xl px-4 py-3 font-display text-sm">
                  ⚠️ {errMsg}
                </div>
              ) : null}

              <Field label="Your name" required>
                <input
                  type="text"
                  name="name"
                  required
                  maxLength={80}
                  defaultValue={me?.name ?? ""}
                  className="input"
                  placeholder="Jane Doe"
                />
              </Field>

              <Field label="Email we should reply to" required>
                <input
                  type="email"
                  name="email"
                  required
                  maxLength={120}
                  defaultValue={me?.email ?? ""}
                  className="input"
                  placeholder="jane@example.com"
                />
              </Field>

              <Field label="What's it about?">
                <select name="topic" className="input" defaultValue="">
                  <option value="">— Pick one (optional) —</option>
                  <option value="tournament">Tournament question</option>
                  <option value="account">Account / sign-in</option>
                  <option value="bug">Bug or glitch</option>
                  <option value="suggestion">Feature suggestion</option>
                  <option value="other">Other</option>
                </select>
              </Field>

              <Field label="Subject" required>
                <input
                  type="text"
                  name="subject"
                  required
                  maxLength={140}
                  className="input"
                  placeholder="Short summary"
                />
              </Field>

              <Field label="Message" required>
                <textarea
                  name="message"
                  required
                  maxLength={4000}
                  rows={6}
                  className="input"
                  placeholder="Tell us what's going on. Be as specific as you like — what you tried, what happened, what you expected."
                />
              </Field>

              <p className="font-body text-xs text-navy-soft">
                By submitting, you agree to be contacted at the email
                above. We&rsquo;ll only use it to reply to this ticket
                — no marketing.
              </p>

              <button type="submit" className="pop pop-coral text-base bob">
                📬 Send ticket
              </button>
            </form>
          </section>
        )}

        <section className="card px-5 py-4 bg-sky1 text-navy">
          <p className="font-display text-sm uppercase tracking-[0.18em]">
            Or post in the forum
          </p>
          <p className="font-body text-base mt-2">
            For public questions other folks might benefit from, the{" "}
            <a
              href="https://discuss.miaswebsites.art/c/help-and-suggestions"
              className="text-coral-deep underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Help &amp; Suggestions
            </a>{" "}
            category on the forum is a good fit.
          </p>
        </section>
      </div>
    </Stage>
  );
}

function TicketRow({ ticket }: { ticket: LocalTicket }) {
  const statusColor: Record<typeof ticket.status, string> = {
    open: "bg-coral text-white",
    pending: "bg-sun-deep text-navy",
    resolved: "bg-grass text-white",
    closed: "bg-navy-soft text-white",
  };
  return (
    <Link
      href={`/support/${ticket.discourseTopicId}`}
      className="block border-3 border-navy rounded-xl px-4 py-3 bg-white hover:-translate-y-0.5 transition-transform"
      style={{ textDecoration: "none" }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="font-display text-base text-navy">
          {ticket.subject}
        </div>
        <span
          className={`font-display text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border-2 border-navy ${statusColor[ticket.status]}`}
        >
          {ticket.status}
        </span>
      </div>
      <div className="font-body text-xs text-navy-soft mt-1">
        Submitted {ticket.createdAt.toLocaleDateString()}{" "}
        {ticket.topic ? <>· {ticket.topic}</> : null}
      </div>
    </Link>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-display text-sm uppercase tracking-[0.18em] text-navy">
        {label} {required ? <span className="text-coral-deep">*</span> : null}
      </span>
      {children}
    </label>
  );
}
