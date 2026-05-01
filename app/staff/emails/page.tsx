import Link from "next/link";
import { Stage } from "@/components/Stage";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { requireStaff } from "@/lib/staff-auth";
import { staffCan } from "@/lib/staff-permissions";

export const dynamic = "force-dynamic";

export default async function StaffEmailsPage() {
  const me = await requireStaff({
    next: "/staff/emails",
    permission: "emails:read",
  });
  const canSend = staffCan(me.role, "emails:write");
  const recent = await db
    .select()
    .from(schema.emailSends)
    .orderBy(desc(schema.emailSends.sentAt))
    .limit(50);
  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">📨 Email log</h1>
          <div className="flex gap-2">
            {canSend ? (
              <Link
                href="/staff/announce"
                className="pop pop-coral text-sm"
              >
                ✉️ Send announcement
              </Link>
            ) : null}
            <Link href="/staff" className="pop pop-white text-sm">
              ← Staff
            </Link>
          </div>
        </div>
        {recent.length === 0 ? (
          <div className="card px-7 py-7 text-center">
            <p className="font-display text-xl text-navy">
              No sends recorded yet.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((m) => (
              <li
                key={m.id}
                className="card-sm bg-white px-4 py-3 flex flex-wrap items-baseline gap-3"
              >
                <span className="font-display text-base text-navy flex-1 min-w-0 truncate">
                  {m.subject}
                </span>
                <span className="font-body text-xs text-navy-soft truncate max-w-[160px]">
                  {m.recipientEmail}
                </span>
                <span className="font-body text-xs text-navy-soft whitespace-nowrap">
                  {new Date(m.sentAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <Link
                  href={`/miamail/${m.id}`}
                  className="pop pop-white text-xs"
                >
                  view
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Stage>
  );
}
