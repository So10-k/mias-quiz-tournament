// Teleprompter + recorder. Mia reads the script while looking
// (almost) straight at the camera, hits Record, and downloads the
// resulting .webm. We then drop it into remotion/public/ and let
// Remotion turn it into the cinematic finals intro.
//
// Features:
//   • Big readable text, auto-scrolls at adjustable speed
//   • Mirror toggle (for actual teleprompter rigs that reflect via
//     a half-silvered glass)
//   • 3-2-1 countdown, then scroll + record start together
//   • MediaRecorder captures webcam + mic to .webm
//   • Download button when recording stops
//   • Fully self-contained — no server roundtrip during recording

import type { Metadata } from "next";
import { Stage } from "@/components/Stage";
import { TeleprompterStudio } from "./TeleprompterStudio";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Teleprompter",
  description: "Record the finals intro with a built-in teleprompter.",
  alternates: { canonical: `${SITE_URL}/teleprompter` },
  robots: { index: false, follow: false },
};

// Each phrase is one continuous breath — Mia reads it without
// pausing mid-line. `time` is when the phrase's FIRST word should
// land in the spotlight; the next phrase's time is when Mia should
// be done.
//
// Synced to remotion/FinalsIntro.tsx music drops (composition time):
//   5.50s  KAREN+MARC graphic drop
//   8.50s  GRANDPA+SAM graphic drop
//  15.75s  "Coming soon" graphic drop
//
// Recording starts at comp 1.5s (1.5s title hold), so rec_time =
// comp_time − 1.5. The phrase times below are rec-times.
//
//   rec-time   composition          phrase
//   ----------------------------------------------------------------
//    0.00s      1.5s                 After WEEKS of bracket battles…
//    2.00s      3.5s                 Only FOUR players are still standing.
//    4.00s      5.5s KAREN drops     Karen versus Marc — winners' bracket final.
//    7.00s      8.5s GRANDPA drops   Grandpa versus Sam — losers' last stand.
//   11.00s     12.5s                 Fifteen questions. One topic. Two finals.
//   14.25s    15.75s SOON drops      The Quiz Book Finals. Coming soon.
//   17.50s                           (END — Mia stops, music tail plays)

const SCRIPT = [
  { text: "After WEEKS of bracket battles…", emphasis: false, time: 0.0 },
  { text: "Only FOUR players are still standing.", emphasis: false, time: 2.0 },
  { text: "Karen versus Marc — winners' bracket final.", emphasis: true, time: 4.0 },
  { text: "Grandpa versus Sam — losers' last stand.", emphasis: true, time: 7.0 },
  { text: "Fifteen questions. One topic. Two finals.", emphasis: false, time: 11.0 },
  { text: "The Quiz Book Finals. Coming soon.", emphasis: true, time: 14.25 },
];

// Total scroll duration — slightly past the last phrase so the
// final words clear the spotlight before the music ends.
const SCRIPT_DURATION_SECONDS = 18.0;

export default function TeleprompterPage() {
  return (
    <Stage>
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4">
        <header className="text-center">
          <p className="font-display text-sm uppercase tracking-[0.2em] text-coral-deep">
            🎬 Finals intro studio
          </p>
          <h1 className="font-display text-3xl md:text-5xl text-navy mt-1 drop-shadow-[3px_3px_0_var(--navy)]">
            Teleprompter
          </h1>
          <p className="font-body text-sm md:text-base text-navy-soft mt-3 max-w-2xl mx-auto">
            Hit Record. Read what shows up below. The text scrolls
            automatically. When it&rsquo;s done, click <strong>Stop</strong> →{" "}
            <strong>Download</strong> → drop the file into{" "}
            <code className="bg-cloud border border-navy/30 rounded px-1">
              remotion/public/recording.webm
            </code>
            .
          </p>
        </header>
        <TeleprompterStudio script={SCRIPT} totalDurationSeconds={SCRIPT_DURATION_SECONDS} />
      </div>
    </Stage>
  );
}
