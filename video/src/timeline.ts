// Frame-locked timeline. Every scene boundary lands on a 5-second chord
// change so visual cuts and the music breathe together.
import { VIDEO } from "./theme";

export const FPS = VIDEO.fps;
export const sec = (s: number) => Math.round(s * FPS);

// Music structure: 4 chords × 5s = 20s loop, repeating 6× = 120s.
export const CHORD_FRAMES = sec(5); // 150
export const LOOP_FRAMES = CHORD_FRAMES * 4; // 600

// Scene start frames (always multiples of CHORD_FRAMES so they hit a chord).
export const SCENES = {
  title: { from: sec(0), duration: sec(5) },
  signup: { from: sec(5), duration: sec(10) },
  email: { from: sec(15), duration: sec(15) },
  playTour: { from: sec(30), duration: sec(15) },
  emailUpdate: { from: sec(45), duration: sec(10) },
  roundIntro: { from: sec(55), duration: sec(5) },
  question: { from: sec(60), duration: sec(10) },
  strike1: { from: sec(70), duration: sec(5) },
  strike2: { from: sec(75), duration: sec(5) },
  strike3: { from: sec(80), duration: sec(10) },
  replay: { from: sec(90), duration: sec(15) },
  review: { from: sec(105), duration: sec(10) },
  outro: { from: sec(115), duration: sec(5) },
} as const;

// Per-cue audio markers (frame, sfx file). The sfx are dropped at these
// exact frames via <Audio startFrom> trimming.
export const SFX_CUES: Array<{ frame: number; sfx: string }> = [
  { frame: sec(2.5), sfx: "ding" }, // title pop
  { frame: sec(6), sfx: "tick" }, // form: name typing
  { frame: sec(7), sfx: "tick" },
  { frame: sec(8), sfx: "tick" },
  { frame: sec(9), sfx: "tick" },
  { frame: sec(13), sfx: "pop" }, // submit button
  { frame: sec(14), sfx: "swoosh" }, // form sends
  { frame: sec(17), sfx: "ding" }, // email lands in inbox
  { frame: sec(23), sfx: "pop" }, // open email
  { frame: sec(28), sfx: "pop" }, // click magic link
  { frame: sec(29), sfx: "swoosh" }, // transition into app
  { frame: sec(31), sfx: "pop" }, // home loads
  { frame: sec(34), sfx: "swoosh" }, // tour: bracket
  { frame: sec(38), sfx: "swoosh" }, // tour: players
  { frame: sec(42), sfx: "swoosh" }, // tour: standings
  { frame: sec(46), sfx: "ding" }, // mid-tour email arrives
  { frame: sec(51), sfx: "pop" }, // open update email
  { frame: sec(56), sfx: "ding" }, // round intro
  { frame: sec(62), sfx: "pop" }, // pick option A
  { frame: sec(64), sfx: "pop" }, // next
  { frame: sec(66), sfx: "pop" }, // pick option
  { frame: sec(70), sfx: "alarm" }, // strike 1
  { frame: sec(75), sfx: "alarm" }, // strike 2
  { frame: sec(80), sfx: "thud" }, // strike 3 / restart
  { frame: sec(86), sfx: "pop" }, // click "Start over"
  { frame: sec(91), sfx: "pop" }, // replay pick
  { frame: sec(94), sfx: "pop" },
  { frame: sec(97), sfx: "pop" },
  { frame: sec(101), sfx: "swoosh" }, // submit
  { frame: sec(105), sfx: "success" }, // review reveal
  { frame: sec(108), sfx: "tick" }, // sparkles
  { frame: sec(110), sfx: "tick" },
  { frame: sec(112), sfx: "tick" },
  { frame: sec(116), sfx: "ding" }, // outro CTA pop-in
];
