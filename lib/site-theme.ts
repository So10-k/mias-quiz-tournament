import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const { appSettings } = schema;
const KEY = "site_theme";

export type SiteTheme = "default" | "arcade";

type Cache = { theme: SiteTheme; expiresAt: number };
let cache: Cache | null = null;
const CACHE_TTL_MS = 30_000;

export async function getSiteTheme(): Promise<SiteTheme> {
  if (cache && cache.expiresAt > Date.now()) return cache.theme;
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, KEY))
    .limit(1);
  const theme: SiteTheme = row?.value === "arcade" ? "arcade" : "default";
  cache = { theme, expiresAt: Date.now() + CACHE_TTL_MS };
  return theme;
}

export async function setSiteTheme(theme: SiteTheme): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: KEY, value: theme })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: theme, updatedAt: new Date() },
    });
  cache = null;
}
