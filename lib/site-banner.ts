// Site-wide banner Sam controls from /host/intercom. Renders as a
// thin strip at the top of every page (above the rest of the
// layout). Used for live-event call-outs ("LIVE NOW · join the
// broadcast"), registration nudges, schedule shifts, etc.
//
// Persisted as four keys in app_settings so the banner survives a
// deploy and toggles instantly (force-dynamic layout reads on every
// request).

import { db, schema } from "@/db";
import { eq, inArray } from "drizzle-orm";

const KEY_TEXT = "site_banner_text";
const KEY_STYLE = "site_banner_style";
const KEY_HREF = "site_banner_href";
const KEY_VISIBLE = "site_banner_visible";

export type BannerStyle = "info" | "live" | "warn" | "celebrate";

export type SiteBanner = {
  visible: boolean;
  text: string;
  style: BannerStyle;
  /** Optional URL — when set the banner becomes a link. */
  href: string;
};

const VALID_STYLES: BannerStyle[] = ["info", "live", "warn", "celebrate"];

const DEFAULT: SiteBanner = {
  visible: false,
  text: "",
  style: "info",
  href: "",
};

export async function getSiteBanner(): Promise<SiteBanner> {
  const rows = await db
    .select()
    .from(schema.appSettings)
    .where(
      inArray(schema.appSettings.key, [
        KEY_TEXT,
        KEY_STYLE,
        KEY_HREF,
        KEY_VISIBLE,
      ])
    );
  const m = new Map(rows.map((r) => [r.key, r.value ?? ""]));
  const styleRaw = m.get(KEY_STYLE) ?? "info";
  const style = VALID_STYLES.includes(styleRaw as BannerStyle)
    ? (styleRaw as BannerStyle)
    : "info";
  return {
    visible: (m.get(KEY_VISIBLE) ?? "no") === "yes",
    text: m.get(KEY_TEXT) ?? "",
    style,
    href: m.get(KEY_HREF) ?? "",
  };
}

export async function setSiteBanner(
  patch: Partial<SiteBanner>
): Promise<void> {
  const writeKey = (key: string, value: string) =>
    db
      .insert(schema.appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value, updatedAt: new Date() },
      });

  const ops: Array<Promise<unknown>> = [];
  if (patch.text !== undefined) ops.push(writeKey(KEY_TEXT, patch.text));
  if (patch.style !== undefined) ops.push(writeKey(KEY_STYLE, patch.style));
  if (patch.href !== undefined) ops.push(writeKey(KEY_HREF, patch.href));
  if (patch.visible !== undefined)
    ops.push(writeKey(KEY_VISIBLE, patch.visible ? "yes" : "no"));
  await Promise.all(ops);
}

// Default presets used by the host panel to one-click common
// announcements.
export const BANNER_PRESETS: Array<{
  label: string;
  banner: SiteBanner;
}> = [
  {
    label: "🎙️ LIVE NOW",
    banner: {
      visible: true,
      style: "live",
      text: "🎙️ LIVE NOW — the Grand Final broadcast is on. Join us.",
      href: "/live",
    },
  },
  {
    label: "🎟️ Registration open",
    banner: {
      visible: true,
      style: "celebrate",
      text: "🎟️ Registration is OPEN for the Grand Final · Saturday May 16 · 12pm ET",
      href: "/finals",
    },
  },
  {
    label: "⏰ Predictions close soon",
    banner: {
      visible: true,
      style: "warn",
      text: "⏰ Predictions close in 1 hour — lock in your bracket.",
      href: "/predictions",
    },
  },
  {
    label: "🌞 Hide banner",
    banner: { visible: false, text: "", style: "info", href: "" },
  },
];
