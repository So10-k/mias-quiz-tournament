import { headers } from "next/headers";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getRealIpFromHeaders } from "@/lib/blocks";
import { AUTHOR_NAME } from "@/lib/author";

export const dynamic = "force-dynamic";

export default async function BlockedPage() {
  const h = await headers();
  const ip = getRealIpFromHeaders(h);

  let reason: string | null = null;
  let blockedAt: Date | null = null;
  if (ip) {
    const [row] = await db
      .select()
      .from(schema.blockedIps)
      .where(eq(schema.blockedIps.ip, ip.trim().toLowerCase()))
      .limit(1);
    if (row) {
      reason = row.reason ?? null;
      blockedAt = row.createdAt;
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-5 text-center"
      style={{
        background:
          "linear-gradient(180deg, #2A1F4F 0%, #4D2F4F 60%, #1B1539 100%)",
      }}
    >
      <article className="max-w-md w-full">
        <div className="text-6xl mb-5">🛑</div>
        <h1
          className="font-display leading-none"
          style={{ color: "#FFE9C7", fontSize: "clamp(38px, 7vw, 60px)" }}
        >
          You&rsquo;ve been blocked.
        </h1>

        <div
          className="mt-7 rounded-2xl border-3 px-5 py-4 text-left"
          style={{
            borderColor: "rgba(255,233,199,0.25)",
            background: "rgba(0,0,0,0.25)",
          }}
        >
          <p
            className="font-body text-sm uppercase tracking-wider"
            style={{ color: "rgba(255,233,199,0.55)" }}
          >
            Reason
          </p>
          <p
            className="font-display mt-1"
            style={{ color: "#FFE9C7", fontSize: "clamp(18px, 2.4vw, 22px)" }}
          >
            {reason ?? "No reason given."}
          </p>
        </div>

        <p
          className="font-body mt-7"
          style={{
            color: "rgba(255, 233, 199, 0.6)",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          The site is working — you specifically aren&rsquo;t welcome here right
          now. Please don&rsquo;t text Sam saying the site is broken; it
          isn&rsquo;t.
        </p>

        <p
          className="font-body mt-3"
          style={{
            color: "rgba(255, 233, 199, 0.4)",
            fontSize: "12px",
            fontFamily: "monospace",
          }}
        >
          IP: {ip ?? "—"}
          {blockedAt
            ? ` · since ${blockedAt.toLocaleDateString()}`
            : ""}
        </p>

        <p
          className="font-body mt-7"
          style={{
            color: "rgba(255, 233, 199, 0.5)",
            fontSize: "12px",
          }}
        >
          — {AUTHOR_NAME}&rsquo;s Quiz Tournament
        </p>
      </article>
    </div>
  );
}
