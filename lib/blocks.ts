import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";
import { id as makeId } from "./ids";

const { blockedIps, appSettings } = schema;

// "page" — show the styled /blocked page with the reason (default).
// "bare" — return a bare 403 with no body so the browser shows its own
//          default "this page isn't working" treatment.
export type BlockMode = "page" | "bare";
const BLOCK_MODE_KEY = "block_mode";
const DEFAULT_BLOCK_MODE: BlockMode = "page";

// In-memory cache of the blocklist + mode. Refreshed every CACHE_TTL_MS so
// middleware doesn't hit the DB on every request.
type Cache = { ips: Set<string>; mode: BlockMode; expiresAt: number };
let cache: Cache | null = null;
const CACHE_TTL_MS = 60_000;

function clearCache() {
  cache = null;
}

async function loadIntoCache(): Promise<Cache> {
  const [ipRows, settingRow] = await Promise.all([
    db.select({ ip: blockedIps.ip }).from(blockedIps),
    db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, BLOCK_MODE_KEY))
      .limit(1),
  ]);
  const mode: BlockMode =
    (settingRow[0]?.value as BlockMode | undefined) === "bare"
      ? "bare"
      : DEFAULT_BLOCK_MODE;
  cache = {
    ips: new Set(ipRows.map((r) => normaliseIp(r.ip))),
    mode,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  return cache;
}

async function getCache(): Promise<Cache> {
  if (cache && cache.expiresAt > Date.now()) return cache;
  return loadIntoCache();
}

function normaliseIp(ip: string): string {
  return ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
}

export async function isIpBlocked(ip: string | null | undefined): Promise<boolean> {
  if (!ip) return false;
  const norm = normaliseIp(ip);
  if (!norm) return false;
  const c = await getCache();
  return c.ips.has(norm);
}

export async function getBlockMode(): Promise<BlockMode> {
  const c = await getCache();
  return c.mode;
}

export async function setBlockMode(mode: BlockMode): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: BLOCK_MODE_KEY, value: mode })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: mode, updatedAt: new Date() },
    });
  clearCache();
}

export async function listBlockedIps() {
  return db.select().from(blockedIps).orderBy(desc(blockedIps.createdAt));
}

export async function blockIp(opts: {
  ip: string;
  reason?: string | null;
  createdByUserId?: string | null;
}) {
  const ip = normaliseIp(opts.ip);
  if (!ip) throw new Error("IP cannot be empty");
  await db
    .insert(blockedIps)
    .values({
      id: makeId(),
      ip,
      reason: opts.reason ?? null,
      createdByUserId: opts.createdByUserId ?? null,
    })
    .onConflictDoNothing();
  clearCache();
}

export async function unblockIp(idOrIp: string) {
  const isLikelyId = idOrIp.length === 12 && /^[a-z0-9]+$/.test(idOrIp);
  if (isLikelyId) {
    await db.delete(blockedIps).where(eq(blockedIps.id, idOrIp));
  } else {
    await db.delete(blockedIps).where(eq(blockedIps.ip, normaliseIp(idOrIp)));
  }
  clearCache();
}

// Pull the real client IP off whichever proxy/CDN we're behind.
export function getRealIpFromHeaders(h: Headers): string | null {
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf;
  const real = h.get("x-real-ip");
  if (real) return real;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return null;
}
