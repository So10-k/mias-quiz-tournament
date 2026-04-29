import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const { appSettings } = schema;

// Comma-separated list of public-page keys the host has hidden. Author
// always sees the real page; everyone else gets a friendly "coming back
// soon" placeholder.
const KEY = "locked_public_pages";

export type LockablePage = "bracket" | "players" | "standings";
export const ALL_LOCKABLE: LockablePage[] = ["bracket", "players", "standings"];

const LABELS: Record<LockablePage, string> = {
  bracket: "Bracket",
  players: "Players",
  standings: "Standings",
};
export function pageLabel(p: LockablePage): string {
  return LABELS[p];
}

type Cache = { locked: Set<LockablePage>; expiresAt: number };
let cache: Cache | null = null;
const CACHE_TTL_MS = 30_000;

function parse(raw: string | null | undefined): Set<LockablePage> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is LockablePage =>
        (ALL_LOCKABLE as string[]).includes(s)
      )
  );
}

async function load(): Promise<Cache> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, KEY))
    .limit(1);
  cache = {
    locked: parse(row?.value),
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  return cache;
}

export async function getLockedPages(): Promise<Set<LockablePage>> {
  if (cache && cache.expiresAt > Date.now()) return cache.locked;
  return (await load()).locked;
}

export async function isPageLocked(p: LockablePage): Promise<boolean> {
  const set = await getLockedPages();
  return set.has(p);
}

export async function setPageLocked(
  p: LockablePage,
  locked: boolean
): Promise<void> {
  const set = await getLockedPages();
  if (locked) set.add(p);
  else set.delete(p);
  const value = [...set].join(",");
  await db
    .insert(appSettings)
    .values({ key: KEY, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
  cache = null;
}
