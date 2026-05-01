// Site-wide countdown card. Host sets: a label, a target timestamp, and
// a visibility toggle from /host. Stored as three keys in app_settings.

import { db, schema } from "@/db";
import { eq, inArray } from "drizzle-orm";

const { appSettings } = schema;

const KEY_LABEL = "countdown_label";
const KEY_TARGET = "countdown_target";
const KEY_VISIBLE = "countdown_visible";

export type CountdownSettings = {
  label: string;
  /** ISO string for the target moment, or "" if unset. */
  targetIso: string;
  visible: boolean;
};

type Cache = { v: CountdownSettings; expiresAt: number };
let cache: Cache | null = null;

export async function getCountdown(): Promise<CountdownSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.v;
  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, [KEY_LABEL, KEY_TARGET, KEY_VISIBLE]));
  const m = new Map(rows.map((r) => [r.key, r.value ?? ""]));
  const v: CountdownSettings = {
    label: m.get(KEY_LABEL) ?? "Round 2 starts in",
    targetIso: m.get(KEY_TARGET) ?? "",
    visible: (m.get(KEY_VISIBLE) ?? "no") === "yes",
  };
  cache = { v, expiresAt: Date.now() + 30_000 };
  return v;
}

export async function setCountdown(
  next: Partial<CountdownSettings>
): Promise<void> {
  const ops: Array<Promise<unknown>> = [];
  const writeKey = (key: string, value: string) =>
    db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
      });
  if (next.label !== undefined) ops.push(writeKey(KEY_LABEL, next.label));
  if (next.targetIso !== undefined)
    ops.push(writeKey(KEY_TARGET, next.targetIso));
  if (next.visible !== undefined)
    ops.push(writeKey(KEY_VISIBLE, next.visible ? "yes" : "no"));
  await Promise.all(ops);
  cache = null;
}
