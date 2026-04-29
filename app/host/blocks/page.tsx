import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { listBlockedIps, getBlockMode } from "@/lib/blocks";
import {
  blockIpAction,
  unblockIpAction,
  setBlockModeAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function BlocksPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/signin");
  if (me.role !== "author") redirect("/play");
  const sp = await searchParams;
  const [blocks, mode] = await Promise.all([
    listBlockedIps(),
    getBlockMode(),
  ]);

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col gap-5">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">🛑 Blocked IPs</h1>
          <div className="flex gap-2">
            <Link href="/host/visitors" className="pop pop-sky text-sm">
              👁 Visitors
            </Link>
            <Link href="/host" className="pop pop-white text-sm">
              ← Host panel
            </Link>
          </div>
        </div>

        {sp.ok ? (
          <div className="card-sm bg-grass text-white px-5 py-3">✓ {sp.ok}</div>
        ) : null}
        {sp.error ? (
          <div className="card-sm bg-coral-deep text-white px-5 py-3">
            ⚠️ {sp.error}
          </div>
        ) : null}

        <section className="card px-5 py-5">
          <h2 className="font-display text-xl text-navy">
            What blocked visitors see
          </h2>
          <p className="font-body text-sm text-navy-soft mt-1">
            Pick how the site responds when a blocked IP visits. The toggle
            takes effect within ~60 seconds (cache window).
          </p>
          <form action={setBlockModeAction} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="mode" value="page" />
            <button
              type="submit"
              disabled={mode === "page"}
              className={
                "pop text-sm " +
                (mode === "page" ? "pop-coral" : "pop-white")
              }
            >
              {mode === "page" ? "● " : ""}🛑 Friendly page (with reason)
            </button>
          </form>
          <form action={setBlockModeAction} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="mode" value="bare" />
            <button
              type="submit"
              disabled={mode === "bare"}
              className={
                "pop text-sm " +
                (mode === "bare" ? "pop-coral" : "pop-white")
              }
            >
              {mode === "bare" ? "● " : ""}🌐 Browser default (HTTP 403)
            </button>
          </form>
          <p className="font-body text-xs text-navy-soft mt-3">
            Currently:{" "}
            <strong className="text-navy">
              {mode === "page"
                ? "showing friendly page"
                : "showing the browser default"}
            </strong>
            .
          </p>
        </section>

        <section className="card px-5 py-5">
          <h2 className="font-display text-xl text-navy">Block a new IP</h2>
          <form
            action={blockIpAction}
            className="mt-3 flex flex-wrap items-end gap-3"
          >
            <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
              <span className="font-display text-sm text-navy">IP address</span>
              <input
                name="ip"
                required
                placeholder="203.0.113.42"
                maxLength={64}
              />
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
              <span className="font-display text-sm text-navy">
                Reason (optional)
              </span>
              <input
                name="reason"
                placeholder="why?"
                maxLength={200}
              />
            </label>
            <button type="submit" className="pop pop-coral">
              Block
            </button>
          </form>

          <p className="font-body text-xs text-navy-soft mt-3">
            Tip: if you ever block your own IP by accident, hit{" "}
            <code className="font-display text-navy">
              ?permissionlevel=granted
            </code>{" "}
            on any URL — that sets a year-long bypass cookie that ignores the
            blocklist entirely.
          </p>
        </section>

        <section className="card px-5 py-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-display text-xl text-navy">Currently blocked</h2>
            <span className="font-body text-sm text-navy-soft">
              {blocks.length} IP{blocks.length === 1 ? "" : "s"}
            </span>
          </div>
          {blocks.length === 0 ? (
            <p className="font-body text-base text-navy-soft mt-3">
              Nobody&rsquo;s blocked.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {blocks.map((b) => (
                <li
                  key={b.id}
                  className="card-sm bg-white px-3 py-2 flex items-baseline gap-3 flex-wrap"
                >
                  <span className="font-display text-base text-navy" style={{ fontFamily: "monospace" }}>
                    {b.ip}
                  </span>
                  <span className="font-body text-sm text-navy-soft flex-1 min-w-0 truncate">
                    {b.reason ?? "no reason given"}
                  </span>
                  <span className="font-body text-xs text-navy-soft">
                    {new Date(b.createdAt).toLocaleString()}
                  </span>
                  <form action={unblockIpAction}>
                    <input type="hidden" name="idOrIp" value={b.id} />
                    <button
                      type="submit"
                      className="pop pop-white text-xs"
                    >
                      ✕ Unblock
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Stage>
  );
}
