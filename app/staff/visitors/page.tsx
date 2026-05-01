import Link from "next/link";
import { Stage } from "@/components/Stage";
import { AutoRefresh } from "@/components/AutoRefresh";
import { requireStaff } from "@/lib/staff-auth";
import { db, schema } from "@/db";
import { desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function StaffVisitorsPage() {
  await requireStaff({
    next: "/staff/visitors",
    permission: "visitors:read",
  });

  const [rows, byCountry, byPath] = await Promise.all([
    db
      .select({
        id: schema.visitLogs.id,
        path: schema.visitLogs.path,
        userId: schema.visitLogs.userId,
        ip: schema.visitLogs.ip,
        country: schema.visitLogs.country,
        region: schema.visitLogs.region,
        city: schema.visitLogs.city,
        userAgent: schema.visitLogs.userAgent,
        createdAt: schema.visitLogs.createdAt,
        userName: schema.users.name,
        userEmail: schema.users.email,
      })
      .from(schema.visitLogs)
      .leftJoin(schema.users, eq(schema.users.id, schema.visitLogs.userId))
      .orderBy(desc(schema.visitLogs.createdAt))
      .limit(200),
    db
      .select({
        country: schema.visitLogs.country,
        c: sql<number>`count(*)::int`,
      })
      .from(schema.visitLogs)
      .groupBy(schema.visitLogs.country)
      .orderBy(sql`count(*) desc`)
      .limit(8),
    db
      .select({
        path: schema.visitLogs.path,
        c: sql<number>`count(*)::int`,
      })
      .from(schema.visitLogs)
      .groupBy(schema.visitLogs.path)
      .orderBy(sql`count(*) desc`)
      .limit(8),
  ]);

  return (
    <Stage scrollable>
      <AutoRefresh seconds={8} />
      <div className="max-w-6xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">👀 Visitors</h1>
          <Link href="/staff" className="pop pop-white text-sm">
            ← Overview
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <section className="card px-5 py-5">
            <h2 className="font-display text-lg text-navy mb-2">
              Top countries
            </h2>
            <ul className="flex flex-col gap-1">
              {byCountry.map((c) => (
                <li
                  key={c.country ?? "—"}
                  className="flex justify-between text-sm font-body text-navy"
                >
                  <span>{c.country ?? "—"}</span>
                  <span>{c.c}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="card px-5 py-5">
            <h2 className="font-display text-lg text-navy mb-2">Top paths</h2>
            <ul className="flex flex-col gap-1">
              {byPath.map((p) => (
                <li
                  key={p.path}
                  className="flex justify-between text-sm font-body text-navy"
                >
                  <span className="truncate max-w-[70%]">{p.path}</span>
                  <span>{p.c}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="card px-3 py-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-navy-soft">
                <th className="px-2 py-2 font-display">When</th>
                <th className="px-2 py-2 font-display">Who</th>
                <th className="px-2 py-2 font-display">Path</th>
                <th className="px-2 py-2 font-display">Where</th>
                <th className="px-2 py-2 font-display">UA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-navy/10">
                  <td className="px-2 py-2 font-body text-xs text-navy-soft whitespace-nowrap">
                    {r.createdAt.toLocaleString()}
                  </td>
                  <td className="px-2 py-2 font-body text-xs text-navy truncate max-w-[16ch]">
                    {r.userName ?? r.userEmail ?? "—"}
                  </td>
                  <td className="px-2 py-2 font-body text-xs text-navy truncate max-w-[20ch]">
                    {r.path}
                  </td>
                  <td className="px-2 py-2 font-body text-xs text-navy-soft truncate max-w-[20ch]">
                    {[r.city, r.region, r.country].filter(Boolean).join(", ") ||
                      "—"}
                  </td>
                  <td className="px-2 py-2 font-body text-[10px] text-navy-soft truncate max-w-[40ch]">
                    {r.userAgent ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </Stage>
  );
}
