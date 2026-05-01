import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { db, schema } from "@/db";
import { desc, eq, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function EmailAnalyticsPage() {
  const me = await currentUser();
  if (!me) redirect("/signin");
  if (me.role !== "author") redirect("/play");

  // Aggregate by send batch — most recent first.
  const batchRows = await db
    .select({
      batchId: schema.emailSends.sendBatchId,
      subject: sql<string>`MAX(${schema.emailSends.subject})`,
      provider: sql<string>`MAX(${schema.emailSends.provider})`,
      templateId: sql<string | null>`MAX(${schema.emailSends.templateId})`,
      sentAt: sql<Date>`MAX(${schema.emailSends.sentAt})`,
      total: sql<number>`COUNT(*)::int`,
      opened: sql<number>`COUNT(${schema.emailSends.openedAt})::int`,
    })
    .from(schema.emailSends)
    .groupBy(schema.emailSends.sendBatchId)
    .orderBy(desc(sql`MAX(${schema.emailSends.sentAt})`))
    .limit(50);

  // Click counts per batch (separate query because emailClicks joins via send.batchId).
  const batchIds = batchRows.map((b) => b.batchId).filter((x): x is string => !!x);
  const clickCountsByBatch = new Map<string, number>();
  if (batchIds.length > 0) {
    const rows = await db
      .select({
        batchId: schema.emailSends.sendBatchId,
        clicks: sql<number>`COUNT(*)::int`,
      })
      .from(schema.emailClicks)
      .innerJoin(
        schema.emailSends,
        eq(schema.emailSends.id, schema.emailClicks.sendId)
      )
      .where(inArray(schema.emailSends.sendBatchId, batchIds))
      .groupBy(schema.emailSends.sendBatchId);
    for (const r of rows) {
      if (r.batchId) clickCountsByBatch.set(r.batchId, r.clicks);
    }
  }

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">📨 Email analytics</h1>
          <Link href="/host" className="pop pop-white text-sm">
            ← Host
          </Link>
        </div>

        <p className="font-body text-sm text-navy-soft">
          Each row is one send batch. <strong>Open</strong> rate is best-effort
          (Gmail/Apple prefetch images = pre-recorded opens).{" "}
          <strong>Click</strong> rate is rock-solid: every link in every email
          goes through the tracker, so a click recorded here is a real click.
        </p>

        {batchRows.length === 0 ? (
          <div className="card px-7 py-7 text-center">
            <p className="font-display text-xl text-navy">
              No sends recorded yet.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {batchRows.map((b) => {
              const clicks = b.batchId
                ? clickCountsByBatch.get(b.batchId) ?? 0
                : 0;
              const openPct = b.total > 0 ? (b.opened / b.total) * 100 : 0;
              const clickPct = b.total > 0 ? (clicks / b.total) * 100 : 0;
              const when = new Date(b.sentAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <li
                  key={b.batchId ?? "no-batch"}
                  className="card-sm bg-white px-4 py-3 flex flex-wrap items-center gap-3"
                >
                  <Link
                    href={`/host/email-analytics/${encodeURIComponent(
                      b.batchId ?? ""
                    )}`}
                    className="font-display text-base text-navy flex-1 min-w-0 truncate"
                  >
                    {b.subject}
                  </Link>
                  <span className="font-body text-xs text-navy-soft whitespace-nowrap">
                    {when}
                  </span>
                  <span className="font-display text-xs px-2 py-0.5 rounded-md border-2 border-navy bg-sky2 text-white">
                    {b.provider}
                  </span>
                  <span className="font-display text-sm text-navy whitespace-nowrap">
                    {b.total} sent
                  </span>
                  <span className="font-display text-sm text-grass-deep whitespace-nowrap">
                    {b.opened} opened ({openPct.toFixed(0)}%)
                  </span>
                  <span className="font-display text-sm text-coral-deep whitespace-nowrap">
                    {clicks} clicks ({clickPct.toFixed(0)}%)
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Stage>
  );
}
