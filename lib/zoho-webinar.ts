// Zoho Webinars integration. We're not using the API — just the URLs.
//
// Two settings live in app_settings:
//   zoho_webinar_join_url   — where finalists click to enter the call
//                             (registered attendees get this from Zoho's
//                             confirmation email; for simplicity we let
//                             the host paste ONE URL here and gate it
//                             with our own /live finalist check)
//   zoho_webinar_embed_url  — optional. When set, /live renders the
//                             webinar inside an iframe so finalists don't
//                             need to switch tabs. When empty we fall
//                             back to a big "Open Zoho Webinar" button.

import { db, schema } from "@/db";
import { eq, inArray } from "drizzle-orm";

const KEY_JOIN = "zoho_webinar_join_url";
const KEY_EMBED = "zoho_webinar_embed_url";

export type ZohoWebinarSettings = {
  joinUrl: string;
  embedUrl: string;
};

export async function getZohoWebinar(): Promise<ZohoWebinarSettings> {
  const rows = await db
    .select()
    .from(schema.appSettings)
    .where(inArray(schema.appSettings.key, [KEY_JOIN, KEY_EMBED]));
  const m = new Map(rows.map((r) => [r.key, r.value ?? ""]));
  return {
    joinUrl: m.get(KEY_JOIN) ?? "",
    embedUrl: m.get(KEY_EMBED) ?? "",
  };
}

export async function setZohoWebinar(
  next: Partial<ZohoWebinarSettings>
): Promise<void> {
  const writeKey = (key: string, value: string) =>
    db
      .insert(schema.appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: schema.appSettings.key,
        set: { value, updatedAt: new Date() },
      });
  const ops: Promise<unknown>[] = [];
  if (next.joinUrl !== undefined) ops.push(writeKey(KEY_JOIN, next.joinUrl));
  if (next.embedUrl !== undefined) ops.push(writeKey(KEY_EMBED, next.embedUrl));
  await Promise.all(ops);
}
