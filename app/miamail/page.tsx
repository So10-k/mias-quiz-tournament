import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { db, schema } from "@/db";
import { desc, eq, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function MiamailInbox() {
  const me = await currentUser();
  if (!me) redirect("/signin");

  // Match by both userId AND email (covers magic-link emails sent before
  // the user row existed, plus any aliasing).
  const messages = await db
    .select()
    .from(schema.emailSends)
    .where(
      or(
        eq(schema.emailSends.recipientUserId, me.id),
        eq(schema.emailSends.recipientEmail, me.email ?? "")
      )
    )
    .orderBy(desc(schema.emailSends.sentAt))
    .limit(100);

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">📬 Miamail</h1>
          <span className="font-body text-xs text-navy-soft">
            Your inbox of everything we&rsquo;ve sent you
          </span>
        </div>

        {messages.length === 0 ? (
          <div className="card px-7 py-7 text-center">
            <div className="text-5xl">📭</div>
            <p className="font-display text-xl text-navy mt-3">
              No mail yet — your tournament emails will land here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((m) => {
              const when = new Date(m.sentAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <li key={m.id}>
                  <Link
                    href={`/miamail/${m.id}`}
                    className="card-sm bg-white px-4 py-3 flex items-baseline gap-3 hover:bg-sun"
                    style={{ display: "flex" }}
                  >
                    <span className="font-display text-base text-navy flex-1 min-w-0 truncate">
                      {m.subject}
                    </span>
                    <span className="font-body text-xs text-navy-soft whitespace-nowrap">
                      {when}
                    </span>
                    {m.openedAt ? (
                      <span className="font-display text-xs px-2 py-0.5 rounded-md border-2 border-navy bg-grass text-white">
                        opened
                      </span>
                    ) : (
                      <span className="font-display text-xs px-2 py-0.5 rounded-md border-2 border-navy bg-coral text-white">
                        new
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Stage>
  );
}
