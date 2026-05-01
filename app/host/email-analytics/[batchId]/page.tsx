import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { db, schema } from "@/db";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function EmailAnalyticsBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/signin");
  if (me.role !== "author") redirect("/play");

  const { batchId: rawBatch } = await params;
  const batchId = decodeURIComponent(rawBatch);

  const sends = await db
    .select()
    .from(schema.emailSends)
    .where(eq(schema.emailSends.sendBatchId, batchId))
    .orderBy(asc(schema.emailSends.recipientEmail));
  if (sends.length === 0) notFound();

  const sendIds = sends.map((s) => s.id);
  const clickRows =
    sendIds.length === 0
      ? []
      : await db
          .select()
          .from(schema.emailClicks)
          .where(inArray(schema.emailClicks.sendId, sendIds))
          .orderBy(desc(schema.emailClicks.clickedAt));
  const clicksBySend = new Map<string, typeof clickRows>();
  for (const c of clickRows) {
    if (!clicksBySend.has(c.sendId)) clicksBySend.set(c.sendId, []);
    clicksBySend.get(c.sendId)!.push(c);
  }

  const subject = sends[0].subject;
  const total = sends.length;
  const opened = sends.filter((s) => !!s.openedAt).length;
  const totalClicks = clickRows.length;

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-2xl text-navy">📨 {subject}</h1>
          <Link href="/host/email-analytics" className="pop pop-white text-sm">
            ← All sends
          </Link>
        </div>
        <div className="card-sm bg-white px-5 py-3 flex flex-wrap gap-4">
          <span className="font-display text-sm text-navy">
            {total} recipients
          </span>
          <span className="font-display text-sm text-grass-deep">
            {opened} opened ({total > 0 ? ((opened / total) * 100).toFixed(0) : 0}%)
          </span>
          <span className="font-display text-sm text-coral-deep">
            {totalClicks} total clicks
          </span>
          <span className="font-body text-xs text-navy-soft">
            batch <code>{batchId}</code>
          </span>
        </div>

        <ul className="flex flex-col gap-2">
          {sends.map((s) => {
            const clicks = clicksBySend.get(s.id) ?? [];
            return (
              <li
                key={s.id}
                className="card-sm bg-white px-4 py-3 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-base text-navy flex-1 min-w-0 truncate">
                    {s.recipientEmail}
                  </span>
                  <span className="font-body text-xs text-navy-soft whitespace-nowrap">
                    {new Date(s.sentAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  {s.openedAt ? (
                    <span className="font-display text-xs px-2 py-0.5 rounded-md border-2 border-navy bg-grass text-white">
                      opened
                    </span>
                  ) : (
                    <span className="font-display text-xs px-2 py-0.5 rounded-md border-2 border-navy bg-coral text-white">
                      not opened
                    </span>
                  )}
                  <span className="font-display text-xs px-2 py-0.5 rounded-md border-2 border-navy bg-sky2 text-white">
                    {clicks.length} click{clicks.length === 1 ? "" : "s"}
                  </span>
                  <Link
                    href={`/miamail/${s.id}`}
                    className="pop pop-white text-xs"
                  >
                    view
                  </Link>
                </div>
                {clicks.length > 0 ? (
                  <ul className="flex flex-col gap-1 text-xs">
                    {clicks.map((c) => (
                      <li
                        key={c.id}
                        className="font-body text-navy-soft truncate"
                      >
                        →{" "}
                        <a
                          href={c.originalUrl}
                          className="underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {c.originalUrl}
                        </a>
                        {" · "}
                        {new Date(c.clickedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </Stage>
  );
}
