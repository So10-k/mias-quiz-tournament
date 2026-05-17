"use server";

// Host actions for /host/intercom. Author-only.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import {
  setSiteBanner,
  BANNER_PRESETS,
  type BannerStyle,
} from "@/lib/site-banner";

async function requireAuthor() {
  const u = await requireUser();
  if (u.role !== "author") throw new Error("forbidden — author only");
  return u;
}

const VALID_STYLES = new Set<BannerStyle>([
  "info",
  "live",
  "warn",
  "celebrate",
]);

export async function saveBannerAction(formData: FormData) {
  await requireAuthor();
  const text = String(formData.get("text") ?? "").trim();
  const href = String(formData.get("href") ?? "").trim();
  const styleRaw = String(formData.get("style") ?? "info");
  const style = VALID_STYLES.has(styleRaw as BannerStyle)
    ? (styleRaw as BannerStyle)
    : "info";
  const visible = formData.get("visible") === "on";
  await setSiteBanner({ text, href, style, visible });
  // Every page reads the banner on its own request, but we revalidate
  // the homepage + the host panel for the immediate next click.
  revalidatePath("/");
  revalidatePath("/host/intercom");
}

export async function applyPresetAction(formData: FormData) {
  await requireAuthor();
  const idx = parseInt(String(formData.get("idx") ?? "0"), 10);
  if (!Number.isFinite(idx) || idx < 0 || idx >= BANNER_PRESETS.length) {
    throw new Error("invalid preset");
  }
  await setSiteBanner(BANNER_PRESETS[idx].banner);
  revalidatePath("/");
  revalidatePath("/host/intercom");
}
