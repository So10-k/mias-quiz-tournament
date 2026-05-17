// Composition registry. We use Remotion's `calculateMetadata` to read
// the actual length of the theme song at render time and stretch the
// video to match — that way you never have to retune the timeline if
// the song gets re-mastered.

import { Composition, Still, staticFile } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { FinalsHype, FINALS_HYPE_FPS } from "./FinalsHype";
import {
  FinalsIntro,
  FINALS_INTRO_FPS,
  FINALS_INTRO_DURATION_FRAMES,
} from "./FinalsIntro";
import {
  Invitation,
  INVITATION_WIDTH,
  INVITATION_HEIGHT,
} from "./Invitation";
import { EventSlide } from "./EventSlide";
import { ParodyAd } from "./ParodyAd";
import { EVENT_VIDEOS } from "./eventVideos";
import {
  EnvelopeReveal,
  ENVELOPE_REVEAL_FPS,
  ENVELOPE_REVEAL_DURATION_FRAMES,
} from "./EnvelopeReveal";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="FinalsHype"
        component={FinalsHype}
        fps={FINALS_HYPE_FPS}
        width={1920}
        height={1080}
        // Fallback if the audio file isn't readable; calculateMetadata
        // overrides this when render starts.
        durationInFrames={900}
        calculateMetadata={async () => {
          try {
            const seconds = await getAudioDurationInSeconds(
              staticFile("audio/theme.mp3")
            );
            return {
              durationInFrames: Math.max(
                FINALS_HYPE_FPS, // at least 1 second
                Math.round(seconds * FINALS_HYPE_FPS)
              ),
            };
          } catch {
            // No audio yet — keep the default duration so preview still works.
            return {};
          }
        }}
      />
      <Composition
        id="FinalsIntro"
        component={FinalsIntro}
        fps={FINALS_INTRO_FPS}
        width={1920}
        height={1080}
        durationInFrames={FINALS_INTRO_DURATION_FRAMES}
      />
      <Still
        id="Invitation"
        component={Invitation}
        width={INVITATION_WIDTH}
        height={INVITATION_HEIGHT}
      />
      <Composition
        id="EnvelopeReveal"
        component={EnvelopeReveal}
        fps={ENVELOPE_REVEAL_FPS}
        width={1600}
        height={1200}
        durationInFrames={ENVELOPE_REVEAL_DURATION_FRAMES}
      />

      {/* ── 8 round/transition slides + 12 parody ads (20 total).
            Each entry is a separate Composition so it can be rendered
            independently with `npx remotion render <id>`. */}
      {EVENT_VIDEOS.map((v) =>
        v.kind === "slide" ? (
          <Composition
            key={v.id}
            id={v.id}
            component={EventSlide}
            fps={v.fps}
            width={1920}
            height={1080}
            durationInFrames={v.durationInFrames}
            defaultProps={v.props}
          />
        ) : (
          <Composition
            key={v.id}
            id={v.id}
            component={ParodyAd}
            fps={v.fps}
            width={1920}
            height={1080}
            durationInFrames={v.durationInFrames}
            defaultProps={v.props}
          />
        )
      )}
    </>
  );
};
