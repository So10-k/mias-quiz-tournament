// "Scene" state for /watch — the broadcast page Sam screen-shares into
// Zoho. The host picks a scene from /host/finals-control; /watch polls
// for changes and re-renders without a reload.
//
// State lives as one JSON blob in app_settings under the single key
// `watch_scene`. We keep the schema small + flat so it's safe to evolve
// (unknown fields are tolerated by the renderer).

import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const SCENE_KEY = "watch_scene";

export type WatchSceneKind =
  | "question"
  | "players"
  | "bracket-main"
  | "bracket-losers"
  | "both-brackets"
  | "video"
  | "image"
  | "text"
  | "slide" // ← live-rendered Remotion composition
  | "intermission";

export type WatchScene = {
  /** Which widget fills the canvas. */
  primary: WatchSceneKind;
  /** Big custom text — used for the "text" scene + as a banner overlay
      on every scene when non-empty. Also overrides the title/brand of
      the active live slide when primary === "slide". */
  bannerText: string;
  /** Body text shown under bannerText in the "text" scene. Also
      overrides the slide's subtitle/tagline when primary === "slide". */
  bodyText: string;
  /** Public path to a /videos/* asset for the "video" scene. */
  videoUrl: string;
  /** Public path to an /images/* asset for the "image" scene. */
  imageUrl: string;
  /** Composition id from remotion/eventVideos.ts — used by primary === "slide". */
  slideId: string;
  /** Show the finalist lower-third strip across the bottom on all scenes. */
  showLowerThird: boolean;
  /** Show the live-question card as a small overlay (lower-left)
      regardless of primary. Useful while you cut to bracket or video
      mid-question. */
  showQuestionOverlay: boolean;
};

export const DEFAULT_SCENE: WatchScene = {
  primary: "intermission",
  bannerText: "",
  bodyText: "",
  videoUrl: "",
  imageUrl: "",
  slideId: "",
  showLowerThird: true,
  showQuestionOverlay: false,
};

export async function getWatchScene(): Promise<WatchScene> {
  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, SCENE_KEY))
    .limit(1);
  if (!row?.value) return DEFAULT_SCENE;
  try {
    const parsed = JSON.parse(row.value);
    return { ...DEFAULT_SCENE, ...parsed };
  } catch {
    return DEFAULT_SCENE;
  }
}

export async function setWatchScene(
  next: Partial<WatchScene>
): Promise<WatchScene> {
  const current = await getWatchScene();
  const merged: WatchScene = { ...current, ...next };
  await db
    .insert(schema.appSettings)
    .values({ key: SCENE_KEY, value: JSON.stringify(merged) })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: JSON.stringify(merged), updatedAt: new Date() },
    });
  return merged;
}
