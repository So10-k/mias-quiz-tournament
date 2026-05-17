"use client";

// Browser-rendered Remotion composition. No MP4 file involved — the
// React components from remotion/EventSlide.tsx + remotion/ParodyAd.tsx
// animate live in the page via @remotion/player.
//
// Benefits over pre-rendered .mp4 files:
//   • Dynamic text — pass props from app state (e.g. the actual
//     champion's name from the DB) and the slide updates instantly.
//   • Zero render pipeline — no `npm run video:render-event` step.
//   • Tweak copy and see it instantly.
//
// The host can override two slide-prop fields from the Scene Director:
// `bannerText` becomes the title / brand override and `bodyText`
// becomes the subtitle / tagline override. Leave them blank to keep
// the defaults defined in remotion/eventVideos.ts.

import { Player } from "@remotion/player";
import { EventSlide } from "@/remotion/EventSlide";
import { ParodyAd } from "@/remotion/ParodyAd";
import {
  EVENT_VIDEOS,
  type EventVideoEntry,
} from "@/remotion/eventVideos";

const ENTRIES_BY_ID: Map<string, EventVideoEntry> = new Map(
  EVENT_VIDEOS.map((v) => [v.id, v])
);

export function LiveSlide({
  slideId,
  bannerOverride,
  bodyOverride,
}: {
  slideId: string;
  bannerOverride: string;
  bodyOverride: string;
}) {
  const entry = ENTRIES_BY_ID.get(slideId);
  if (!entry) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
        <div className="text-[8rem]">🎞️</div>
        <p
          style={{
            fontFamily: "Fredoka, sans-serif",
            fontWeight: 700,
            fontSize: 48,
            color: "#1B2A4E",
          }}
        >
          No slide picked
        </p>
        <p
          style={{
            fontFamily: "Quicksand, sans-serif",
            fontSize: 24,
            color: "#1B2A4E",
          }}
        >
          Choose a slide in <strong>/host/finals-control → Scene Director</strong>.
        </p>
      </div>
    );
  }

  // Apply the host's per-scene overrides. Slide entries get title /
  // subtitle overrides; ad entries get brand / tagline overrides. The
  // overrides are intentionally minimal — anything more elaborate
  // (testimonial, fineprint, etc.) should be edited in
  // remotion/eventVideos.ts to keep the host UI uncluttered.
  let inputProps: Record<string, unknown> = { ...entry.props };
  if (entry.kind === "slide") {
    if (bannerOverride) inputProps.title = bannerOverride;
    if (bodyOverride) inputProps.subtitle = bodyOverride;
  } else {
    if (bannerOverride) inputProps.brand = bannerOverride;
    if (bodyOverride) inputProps.tagline = bodyOverride;
  }

  return (
    <div
      className="flex-1 w-full flex items-center justify-center"
      style={{ minHeight: "80vh" }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1920,
          aspectRatio: "16 / 9",
          borderRadius: 24,
          overflow: "hidden",
          border: "4px solid #1B2A4E",
          boxShadow: "12px 12px 0 #1B2A4E",
          background: "#1B2A4E",
        }}
      >
        {entry.kind === "slide" ? (
          <Player
            component={EventSlide}
            inputProps={inputProps as any}
            durationInFrames={entry.durationInFrames}
            fps={entry.fps}
            compositionWidth={1920}
            compositionHeight={1080}
            autoPlay
            loop
            controls={false}
            acknowledgeRemotionLicense
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <Player
            component={ParodyAd}
            inputProps={inputProps as any}
            durationInFrames={entry.durationInFrames}
            fps={entry.fps}
            compositionWidth={1920}
            compositionHeight={1080}
            autoPlay
            loop
            controls={false}
            acknowledgeRemotionLicense
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </div>
    </div>
  );
}
