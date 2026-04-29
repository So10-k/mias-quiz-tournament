import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import {
  listVisitors,
  listUserSummaries,
  getVisitorTimeline,
  getUserVisits,
} from "@/lib/visits";
import { blockIpAction } from "@/app/host/blocks/actions";

export const dynamic = "force-dynamic";

function fmtAgo(d: Date) {
  const ms = Date.now() - d.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function uaShort(ua: string | null) {
  if (!ua) return "—";
  // Heuristic: extract OS / browser names so the table stays readable.
  const m = ua.match(/(iPhone|iPad|Android|Macintosh|Windows|Linux)/);
  const b = ua.match(/(Chrome|Firefox|Safari|Edg|OPR)\/(\d+)/);
  return `${m ? m[1] : "?"} · ${b ? b[1] + " " + b[2] : "?"}`;
}

export default async function VisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; fp?: string; tab?: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/signin");
  if (me.role !== "author") redirect("/play");

  const sp = await searchParams;
  const tab = sp.tab === "fp" ? "fp" : sp.tab === "users" ? "users" : "users";

  // Drill-down views
  if (sp.user) {
    const rows = await getUserVisits(sp.user, 300);
    return (
      <Stage scrollable>
        <div className="max-w-4xl mx-auto pt-4 px-4 flex flex-col gap-4">
          <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
            <h1 className="font-display text-2xl text-navy">
              👁 Visits — by user
            </h1>
            <Link href="/host/visitors" className="pop pop-white text-sm">
              ← all visitors
            </Link>
          </div>
          <Timeline rows={rows} />
        </div>
      </Stage>
    );
  }

  if (sp.fp) {
    const rows = await getVisitorTimeline(sp.fp, 300);
    return (
      <Stage scrollable>
        <div className="max-w-4xl mx-auto pt-4 px-4 flex flex-col gap-4">
          <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
            <h1 className="font-display text-2xl text-navy">
              👁 Visits — by device
            </h1>
            <Link href="/host/visitors" className="pop pop-white text-sm">
              ← all visitors
            </Link>
          </div>
          <p className="font-body text-sm text-navy-soft">
            Fingerprint{" "}
            <code className="font-display text-navy">{sp.fp.slice(0, 12)}…</code>
          </p>
          <Timeline rows={rows} />
        </div>
      </Stage>
    );
  }

  // Index views: by user OR by device
  const userRows = await listUserSummaries();
  const deviceRows = await listVisitors();

  return (
    <Stage scrollable>
      <div className="max-w-5xl mx-auto pt-4 px-4 flex flex-col gap-4">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">👁 Visitors</h1>
          <Link href="/host" className="pop pop-white text-sm">
            ← Host panel
          </Link>
        </div>

        <div className="flex gap-2">
          <Link
            href="/host/visitors?tab=users"
            className={
              "pop text-sm " + (tab === "users" ? "pop-coral" : "pop-white")
            }
          >
            By signed-in user
          </Link>
          <Link
            href="/host/visitors?tab=fp"
            className={
              "pop text-sm " + (tab === "fp" ? "pop-coral" : "pop-white")
            }
          >
            By device (incl. anonymous)
          </Link>
        </div>

        {tab === "users" ? (
          <section className="card px-5 py-5">
            {userRows.length === 0 ? (
              <p className="font-body text-base text-navy-soft">
                No signed-in visitors logged yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {userRows.map((u) => (
                  <li
                    key={u.userId}
                    className="card-sm bg-white px-3 py-3 flex items-baseline gap-3 flex-wrap"
                  >
                    <span className="font-display text-base text-navy flex-1 min-w-0 truncate">
                      {u.name ?? u.email}
                    </span>
                    <span className="font-body text-xs text-navy-soft truncate">
                      {u.email}
                    </span>
                    <span className="font-display text-sm text-navy">
                      {u.visits} visit{u.visits === 1 ? "" : "s"}
                    </span>
                    <span className="font-body text-xs text-navy-soft">
                      {u.fingerprints.length} device
                      {u.fingerprints.length === 1 ? "" : "s"}
                    </span>
                    <span className="font-body text-xs text-navy-soft">
                      {u.lastSeen ? fmtAgo(u.lastSeen) : "—"}
                    </span>
                    <Link
                      href={`/host/visitors?user=${u.userId}`}
                      className="pop pop-coral text-xs px-3 py-1"
                    >
                      view
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <section className="card px-5 py-5">
            {deviceRows.length === 0 ? (
              <p className="font-body text-base text-navy-soft">
                No visitors logged yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {deviceRows.map((d) => (
                  <li
                    key={d.fingerprint}
                    className="card-sm bg-white px-3 py-3 flex items-baseline gap-3 flex-wrap"
                  >
                    <span className="font-display text-base text-navy flex-1 min-w-0 truncate">
                      {d.userName ?? d.userEmail ?? (
                        <span className="text-navy-soft italic">anonymous</span>
                      )}
                    </span>
                    <span className="font-body text-xs text-navy-soft truncate">
                      {[d.city, d.country].filter(Boolean).join(", ") || "—"}
                    </span>
                    <span className="font-body text-xs text-navy-soft truncate max-w-[10rem]">
                      {d.ip ?? "—"}
                    </span>
                    <span className="font-body text-xs text-navy-soft truncate max-w-[12rem]">
                      {uaShort(d.userAgent)}
                    </span>
                    <span className="font-display text-sm text-navy">
                      {d.visits}
                    </span>
                    <span className="font-body text-xs text-navy-soft">
                      {fmtAgo(d.lastSeen)}
                    </span>
                    {d.ip ? (
                      <form action={blockIpAction}>
                        <input type="hidden" name="ip" value={d.ip} />
                        <input
                          type="hidden"
                          name="reason"
                          value={`from visitors panel · ${
                            d.userEmail ?? "anonymous"
                          }`}
                        />
                        <button
                          type="submit"
                          className="pop pop-danger text-xs px-3 py-1"
                          title={`Block ${d.ip}`}
                        >
                          🛑 block
                        </button>
                      </form>
                    ) : null}
                    <Link
                      href={`/host/visitors?fp=${d.fingerprint}`}
                      className="pop pop-coral text-xs px-3 py-1"
                    >
                      view
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <p className="font-body text-xs text-navy-soft text-center">
          Logs include IP, geo (Vercel headers), user-agent, language, time
          zone, screen size, path, referrer, signed-in user. Each device is
          grouped by an opaque cookie fingerprint.
        </p>
      </div>
    </Stage>
  );
}

function Timeline({ rows }: { rows: any[] }) {
  if (rows.length === 0) {
    return (
      <p className="font-body text-base text-navy-soft">No visits found.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className="card-sm bg-white px-3 py-2 flex items-baseline gap-3 flex-wrap"
        >
          <span className="font-display text-sm text-navy w-44 truncate">
            {r.path}
          </span>
          <span className="font-body text-xs text-navy-soft truncate max-w-[16rem]">
            {r.referrer ?? "(direct)"}
          </span>
          <span className="font-body text-xs text-navy-soft">
            {[r.city, r.country].filter(Boolean).join(", ") || "—"}
          </span>
          <span className="font-body text-xs text-navy-soft truncate max-w-[8rem]">
            {r.ip ?? "—"}
          </span>
          <span className="font-body text-xs text-navy-soft">
            {r.timezone ?? "—"}
          </span>
          <span className="font-body text-xs text-navy-soft truncate max-w-[10rem]">
            {uaShort(r.userAgent)}
          </span>
          <span className="font-body text-xs text-navy-soft ml-auto">
            {fmtAgo(new Date(r.createdAt))}
          </span>
        </li>
      ))}
    </ul>
  );
}
