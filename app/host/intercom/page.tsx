// Host dashboard for Intercom-adjacent controls:
//   • Site-wide banner editor (lives in app_settings, rendered by
//     components/SiteBanner.tsx in the root layout)
//   • Read-only health check: app id set, JWT secret set, access
//     token set, open conversation count (via Intercom REST)
//   • Quick links to the Intercom inbox + settings pages
//
// Future: outbound message sender, live AI-bot training status, etc.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { SiteBanner } from "@/components/SiteBanner";
import { currentUser } from "@/lib/session";
import { getSiteBanner, BANNER_PRESETS } from "@/lib/site-banner";
import {
  intercomApiReady,
  countOpenConversations,
} from "@/lib/intercom-api";
import { intercomEnabled } from "@/lib/intercom";
import { applyPresetAction, saveBannerAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function HostIntercomPage() {
  const me = await currentUser();
  if (!me) redirect("/signin?next=/host/intercom");
  if (me.role !== "author") redirect("/");

  const banner = await getSiteBanner();
  const apiReady = intercomApiReady();
  const messengerReady = intercomEnabled();
  const hasJwtSecret = !!process.env.INTERCOM_JWT_SECRET;
  const openCount = apiReady ? await countOpenConversations() : null;

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 pb-12 flex flex-col gap-5">
        <header className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
              Host · Intercom
            </p>
            <h1 className="font-display text-3xl text-navy mt-0.5">
              💬 Messenger &amp; banners
            </h1>
          </div>
          <Link href="/host" className="pop pop-white text-sm">
            ← Host
          </Link>
        </header>

        {/* ── Health check ─────────────────────────────────────── */}
        <section className="card px-6 py-5">
          <h2 className="font-display text-xl text-navy">⚙️ Health</h2>
          <ul className="mt-3 flex flex-col gap-1.5 font-body text-sm text-navy">
            <HealthLine
              ok={messengerReady}
              label="Messenger app id"
              detail={
                messengerReady
                  ? "INTERCOM_APP_ID set — sun-mascot launcher is live."
                  : "INTERCOM_APP_ID missing — launcher hidden site-wide."
              }
            />
            <HealthLine
              ok={hasJwtSecret}
              label="Identity verification (JWT)"
              detail={
                hasJwtSecret
                  ? "INTERCOM_JWT_SECRET set — signed-in users are identity-verified."
                  : "INTERCOM_JWT_SECRET missing — Messenger runs in anonymous mode."
              }
            />
            <HealthLine
              ok={apiReady}
              label="REST API access"
              detail={
                apiReady
                  ? `INTERCOM_ACCESS_TOKEN set — sync hooks + inbox stats enabled. ${
                      openCount != null ? `${openCount} open conversations.` : ""
                    }`
                  : "INTERCOM_ACCESS_TOKEN missing — Discourse→Intercom note sync + outbound features disabled. Generate at Settings → Developers → Access tokens."
              }
            />
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`https://app.intercom.com/a/inbox/${process.env.INTERCOM_APP_ID ?? ""}/inbox`}
              target="_blank"
              rel="noopener noreferrer"
              className="pop pop-coral text-sm"
            >
              📥 Open Intercom inbox
            </a>
            <a
              href={`https://app.intercom.com/a/apps/${process.env.INTERCOM_APP_ID ?? ""}/messenger`}
              target="_blank"
              rel="noopener noreferrer"
              className="pop pop-white text-sm"
            >
              🎨 Messenger settings
            </a>
            <a
              href={`https://app.intercom.com/a/apps/${process.env.INTERCOM_APP_ID ?? ""}/developer-hub`}
              target="_blank"
              rel="noopener noreferrer"
              className="pop pop-white text-sm"
            >
              🔑 Developer hub
            </a>
          </div>
        </section>

        {/* ── Banner presets ───────────────────────────────────── */}
        <section className="card px-6 py-5">
          <h2 className="font-display text-xl text-navy">⚡ Quick presets</h2>
          <p className="font-body text-sm text-navy-soft mt-1">
            One click applies the preset and turns the banner on (or off
            for the &ldquo;Hide&rdquo; preset).
          </p>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {BANNER_PRESETS.map((p, i) => (
              <form action={applyPresetAction} key={p.label}>
                <input type="hidden" name="idx" value={i} />
                <button
                  type="submit"
                  className="pop pop-white text-sm w-full"
                >
                  {p.label}
                </button>
              </form>
            ))}
          </div>
        </section>

        {/* ── Live preview ─────────────────────────────────────── */}
        <section className="card px-6 py-5">
          <h2 className="font-display text-xl text-navy">👁 Preview</h2>
          <p className="font-body text-xs text-navy-soft mt-1">
            Exactly what visitors see at the top of every page.
          </p>
          <div className="mt-3 border-3 border-navy rounded-xl overflow-hidden">
            {banner.visible && banner.text ? (
              <SiteBanner banner={banner} />
            ) : (
              <div className="bg-sky1 text-navy px-4 py-3 font-body text-sm text-center italic">
                (banner is hidden)
              </div>
            )}
          </div>
        </section>

        {/* ── Manual editor ────────────────────────────────────── */}
        <section className="card px-6 py-5">
          <h2 className="font-display text-xl text-navy">✏️ Custom banner</h2>
          <form
            action={saveBannerAction}
            className="mt-3 flex flex-col gap-3"
          >
            <label className="font-display text-sm text-navy">
              Message
              <input
                name="text"
                defaultValue={banner.text}
                placeholder="e.g. 🎙️ LIVE NOW — join the broadcast"
                maxLength={140}
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
              />
            </label>
            <label className="font-display text-sm text-navy">
              Link (optional — makes the banner clickable)
              <input
                name="href"
                defaultValue={banner.href}
                placeholder="/live"
                maxLength={200}
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
              />
            </label>
            <label className="font-display text-sm text-navy">
              Style
              <select
                name="style"
                defaultValue={banner.style}
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
              >
                <option value="info">Info (sky blue)</option>
                <option value="live">Live (coral + pulsing dot)</option>
                <option value="warn">Warn (orange)</option>
                <option value="celebrate">Celebrate (sun yellow)</option>
              </select>
            </label>
            <label className="font-display text-sm text-navy flex items-center gap-2">
              <input
                type="checkbox"
                name="visible"
                defaultChecked={banner.visible}
                className="w-4 h-4"
              />
              Show banner site-wide
            </label>
            <button className="pop pop-coral text-sm self-start">
              💾 Save banner
            </button>
          </form>
        </section>

        {/* ── How sync works (docs in-line) ────────────────────── */}
        <details className="card px-6 py-5">
          <summary className="font-display text-base text-navy cursor-pointer">
            🔗 How the Discourse ↔ Intercom sync works
          </summary>
          <ul className="mt-3 list-disc pl-5 flex flex-col gap-1.5 font-body text-sm text-navy">
            <li>
              When a forum support ticket changes status (open / pending
              / resolved / closed) via{" "}
              <code>@support_bot changestatus</code>, the plugin POSTs to{" "}
              <code>/api/support/sync-status</code>.
            </li>
            <li>
              That route mirrors the change into Intercom: drops a
              sidebar note on the submitter's contact, then tags them{" "}
              <code>support-open</code> / <code>support-pending</code> /{" "}
              <code>support-resolved</code> / <code>support-closed</code>.
            </li>
            <li>
              Use those tags as audience filters in Intercom Outbound:
              e.g. send a follow-up survey to everyone tagged{" "}
              <code>support-resolved</code> 24 hours after resolution.
            </li>
            <li>
              The reverse direction (Intercom conversation tagged
              &rdquo;→forum&ldquo; → auto-open a Discourse topic) is on
              the roadmap.
            </li>
          </ul>
        </details>
      </div>
    </Stage>
  );
}

function HealthLine({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        className="inline-block w-5 text-center font-display"
        style={{ color: ok ? "#5BCE7A" : "#C9296A" }}
      >
        {ok ? "✓" : "✗"}
      </span>
      <span>
        <strong>{label}</strong> — {detail}
      </span>
    </li>
  );
}
