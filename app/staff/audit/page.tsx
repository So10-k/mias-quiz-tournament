import Link from "next/link";
import { Stage } from "@/components/Stage";
import { AutoRefresh } from "@/components/AutoRefresh";
import { requireStaff } from "@/lib/staff-auth";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function StaffAuditPage() {
  await requireStaff({ next: "/staff/audit", permission: "audit:read" });

  const rows = await db
    .select()
    .from(schema.staffActions)
    .orderBy(desc(schema.staffActions.createdAt))
    .limit(200);

  return (
    <Stage scrollable>
      <AutoRefresh seconds={8} />
      <div className="max-w-5xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">📜 Audit log</h1>
          <Link href="/staff" className="pop pop-white text-sm">
            ← Overview
          </Link>
        </div>
        <div className="card px-3 py-2">
          {rows.length === 0 ? (
            <p className="font-body text-sm text-navy-soft px-3 py-3">
              No actions logged yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-navy-soft">
                  <th className="px-2 py-2 font-display">When</th>
                  <th className="px-2 py-2 font-display">Who</th>
                  <th className="px-2 py-2 font-display">Action</th>
                  <th className="px-2 py-2 font-display">Target</th>
                  <th className="px-2 py-2 font-display">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-navy/10">
                    <td className="px-2 py-2 font-body text-xs text-navy-soft whitespace-nowrap">
                      {r.createdAt.toLocaleString()}
                    </td>
                    <td className="px-2 py-2 font-body text-xs text-navy truncate max-w-[16ch]">
                      {r.staffEmail}
                    </td>
                    <td className="px-2 py-2 font-display text-sm text-navy">
                      {r.action}
                    </td>
                    <td className="px-2 py-2 font-body text-xs text-navy-soft truncate max-w-[20ch]">
                      {r.target ?? "—"}
                    </td>
                    <td className="px-2 py-2 font-mono text-[10px] text-navy-soft truncate max-w-[40ch]">
                      {r.details ? JSON.stringify(r.details) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Stage>
  );
}
