// Finals Intro — 20-second cinematic tease built around Mia's
// teleprompter recording.
//
// Pipeline:
//   1. Mia records on /teleprompter, downloads finals-intro-*.webm
//   2. She drops it at public/videos/finals-intro-recording.webm
//   3. `npm run video:preview` to scrub in Remotion Studio
//   4. `npm run video:render-intro` to bake to mp4
//
// The composition layers (back to front):
//   • Animated picture-book gradient background (sun, sky, hill)
//   • Mia's recording, color-graded + ken-burns slow zoom
//   • Vignette + bloom overlay
//   • Beat-synced text overlays (Karen vs Marc, Grandpa vs Sam, etc.)
//   • Particle sparkles in the corners
//   • Title + tail cards
//
// All beats are indexed by frame so they stay in lock-step with the
// 20-second narration regardless of small drift in Mia's pacing.
//
// IF Mia's recording is shorter/longer than 20s: edit RECORDING_*
// constants below — Remotion will time-shift everything else
// automatically.

import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import wordsData from "../public/data/finals-intro-words.json";

export const FINALS_INTRO_FPS = 30;
// Tuned to the slowed piano panic.wav (21.48s, pitch-preserved
// atempo=0.75) plus a small tail. Mia gets ~17s of recording =
// roughly 3s per phrase, which feels natural and unrushed.
export const FINALS_INTRO_DURATION_SECONDS = 22;
export const FINALS_INTRO_DURATION_FRAMES =
  FINALS_INTRO_FPS * FINALS_INTRO_DURATION_SECONDS;

// Flip to `false` once Mia's recording has been dropped at
// public/videos/finals-intro-recording.webm.
export const PLACEHOLDER_MODE = false;

const RECORDING_PATH = "videos/finalsrec.mp4";
const RECORDING_START_FRAME = Math.round(FINALS_INTRO_FPS * 1.5); // 1.5s title hold
// Mia's actual recording is 15.25s. Slot ends right there so the
// end card can take over immediately — no last-frame freeze.
const RECORDING_DURATION_FRAMES = Math.round(FINALS_INTRO_FPS * 15.25);

// Beats. Recording fills 1.5–16.75s. End card kicks in the instant
// Mia stops, no gap.
const f = (s: number) => Math.round(FINALS_INTRO_FPS * s);
const BEAT = {
  TITLE_IN: 0,
  TITLE_OUT: f(1.5),
  KAREN_VS_MARC: f(5.5),
  KAREN_VS_MARC_OUT: f(8.5),
  GRANDPA_VS_SAM: f(8.5),
  GRANDPA_VS_SAM_OUT: f(12.5),
  COMING_SOON: f(15.75),
  END_CARD_IN: f(16.75),
};

export const FinalsIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#1B2A4E" }}>
      {/* Sky gradient + animated sun */}
      <SkyBackground />

      {/* Mia's recording (or placeholder card while she hasn't shot it) */}
      <Sequence
        from={RECORDING_START_FRAME}
        durationInFrames={RECORDING_DURATION_FRAMES}
        name="Mia's recording"
      >
        {PLACEHOLDER_MODE ? <RecordingPlaceholder /> : <MiaRecording />}
      </Sequence>

      {/* Vignette + bloom on top */}
      <Vignette />

      {/* Karaoke captions — words light up + a sun bounces above
          the one Mia is saying right now. Lives over the recording
          slot only; hides for the title + end cards. */}
      <Sequence
        from={RECORDING_START_FRAME}
        durationInFrames={RECORDING_DURATION_FRAMES}
        name="Karaoke captions"
      >
        <Captions />
      </Sequence>

      {/* Title card (0–1s) */}
      <Sequence
        from={BEAT.TITLE_IN}
        durationInFrames={BEAT.TITLE_OUT - BEAT.TITLE_IN}
        name="Title card"
      >
        <TitleCard />
      </Sequence>

      {/* Karen vs Marc (8–11s) */}
      <Sequence
        from={BEAT.KAREN_VS_MARC}
        durationInFrames={BEAT.KAREN_VS_MARC_OUT - BEAT.KAREN_VS_MARC}
        name="Winners' final"
      >
        <MatchupCard
          bracket="WINNERS' BRACKET FINAL"
          a="KAREN"
          b="MARC"
          accent="#FFD93D"
        />
      </Sequence>

      {/* Grandpa vs Sam (12–15s) */}
      <Sequence
        from={BEAT.GRANDPA_VS_SAM}
        durationInFrames={BEAT.GRANDPA_VS_SAM_OUT - BEAT.GRANDPA_VS_SAM}
        name="Losers' final"
      >
        <MatchupCard
          bracket="LOSERS' BRACKET FINAL"
          a="GRANDPA"
          b="SAM"
          accent="#E94B7E"
        />
      </Sequence>

      {/* "COMING SOON" lower-third (18–20s) */}
      <Sequence
        from={BEAT.COMING_SOON}
        durationInFrames={BEAT.END_CARD_IN - BEAT.COMING_SOON}
        name="Coming soon"
      >
        <ComingSoonLowerThird />
      </Sequence>

      {/* End card (20–22s) */}
      <Sequence
        from={BEAT.END_CARD_IN}
        durationInFrames={FINALS_INTRO_DURATION_FRAMES - BEAT.END_CARD_IN}
        name="End card"
      >
        <EndCard />
      </Sequence>

      {/* Sparkle particles in corners — always on */}
      <Particles />

      {/* Background music — piano panic, building tension. Ducks
          during Mia's recording so her voice cuts through, then
          swells back into the title card hit. */}
      <Audio
        src={staticFile("audio/finals-intro-sting.wav")}
        volume={(fr) =>
          interpolate(
            fr,
            [
              0,
              RECORDING_START_FRAME,
              RECORDING_START_FRAME + RECORDING_DURATION_FRAMES,
              FINALS_INTRO_DURATION_FRAMES,
            ],
            // Full volume at start, duck during narration, swell
            // back for the end card.
            [0.85, 0.4, 0.8, 0.95],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          )
        }
      />
    </AbsoluteFill>
  );
};

// ── Layers ────────────────────────────────────────────────────────

// Animated card that lives in the recording slot until Mia drops
// her .webm in. Shows a clapperboard, a "RECORDING WILL GO HERE"
// stamp, and a faint scanline so the timing of the text overlays
// is still visible against a moving backdrop.
const RecordingPlaceholder: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 1 + 0.04 * Math.sin(frame * 0.12);
  return (
    <AbsoluteFill
      style={{
        background:
          "repeating-linear-gradient(45deg, #1B2A4E 0 22px, #2C3D6B 22px 44px)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "rgba(255,217,61,0.95)",
          border: "8px solid #1B2A4E",
          borderRadius: 24,
          boxShadow: "12px 12px 0 #C9296A",
          padding: "44px 64px",
          textAlign: "center",
          transform: `scale(${pulse}) rotate(-2deg)`,
        }}
      >
        <div style={{ fontSize: 96, lineHeight: 1, marginBottom: 12 }}>🎬</div>
        <div
          style={{
            fontFamily: "Fredoka, sans-serif",
            fontWeight: 700,
            fontSize: 56,
            color: "#1B2A4E",
            letterSpacing: "0.04em",
          }}
        >
          MIA RECORDS HERE
        </div>
        <div
          style={{
            fontFamily: "Quicksand, sans-serif",
            fontSize: 22,
            color: "#3B4A7E",
            marginTop: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          drop the .webm and flip{" "}
          <span style={{ background: "#1B2A4E", color: "#FFD93D", padding: "2px 8px", borderRadius: 6 }}>
            PLACEHOLDER_MODE = false
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Karaoke captions, YouTube auto-caption style: white text with
// heavy black outline (Open Sans Black 800), active word in
// yellow, only the current phrase visible. A custom cartoon sun
// (SVG, matches the brand) bounces above the active word.
//
// Caption position auto-dodges other overlays: when the
// KAREN/MARC or GRANDPA/SAM matchup cards are on screen (they
// live in the bottom-left corner), captions move to the TOP.
// When the COMING_SOON lower-third is showing, captions hide.
type WhisperWord = { word: string; start: number; end: number };

function groupIntoPhrases(words: WhisperWord[]): WhisperWord[][] {
  const groups: WhisperWord[][] = [];
  let current: WhisperWord[] = [];
  const cleanWord = (w: WhisperWord) => ({
    ...w,
    word: w.word.trim().replace(/^[\s.,!?]+|[\s.,!?]+$/g, ""),
  });
  for (let i = 0; i < words.length; i++) {
    const w = cleanWord(words[i]);
    const prev = words[i - 1];
    const gap = prev ? w.start - prev.end : 0;
    if ((gap > 0.45 || current.length >= 7) && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(w);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

// Custom cartoon sun — same picture-book sun used elsewhere on the
// brand. 12 long rays + 12 short between, smiling face, blush.
const CartoonSun: React.FC<{ size?: number; spin?: number }> = ({
  size = 140,
  spin = 0,
}) => (
  <svg
    viewBox="0 0 200 200"
    width={size}
    height={size}
    style={{ transform: `rotate(${spin}deg)`, transition: "transform 80ms ease-out" }}
  >
    <g
      stroke="#1B2A4E"
      strokeWidth={5}
      strokeLinecap="round"
      fill="none"
    >
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => {
        const r = (a * Math.PI) / 180;
        const x1 = 100 + Math.cos(r) * 80;
        const y1 = 100 + Math.sin(r) * 80;
        const x2 = 100 + Math.cos(r) * 96;
        const y2 = 100 + Math.sin(r) * 96;
        return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
    </g>
    <g
      stroke="#1B2A4E"
      strokeWidth={4}
      strokeLinecap="round"
      fill="none"
    >
      {[15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345].map((a) => {
        const r = (a * Math.PI) / 180;
        const x1 = 100 + Math.cos(r) * 78;
        const y1 = 100 + Math.sin(r) * 78;
        const x2 = 100 + Math.cos(r) * 90;
        const y2 = 100 + Math.sin(r) * 90;
        return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
    </g>
    <circle
      cx={100}
      cy={100}
      r={64}
      fill="#FFD93D"
      stroke="#1B2A4E"
      strokeWidth={5}
    />
    {/* eyes */}
    <circle cx={80} cy={92} r={7} fill="#1B2A4E" />
    <circle cx={120} cy={92} r={7} fill="#1B2A4E" />
    {/* smile */}
    <path
      d="M 78 116 Q 100 138 122 116"
      fill="none"
      stroke="#1B2A4E"
      strokeWidth={5}
      strokeLinecap="round"
    />
    {/* blush */}
    <circle cx={74} cy={112} r={6} fill="#E94B7E" opacity={0.65} />
    <circle cx={126} cy={112} r={6} fill="#E94B7E" opacity={0.65} />
  </svg>
);

const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const recTime = frame / fps;
  // Composition time for collision-detection with overlays.
  const compTime = recTime + 1.5;

  // Dodge: matchup cards live bottom-left from 5.5–12.5s comp.
  // Coming-soon lower-third covers bottom-center 15.75s onward.
  const matchupOnScreen = compTime >= 5.4 && compTime < 12.6;
  const comingSoonOnScreen = compTime >= 15.6;
  // Hide entirely during coming-soon so it doesn't fight the
  // "coming soon" type, otherwise move top vs bottom.
  if (comingSoonOnScreen) return <AbsoluteFill />;
  const captionAtTop = matchupOnScreen;

  const allWords = wordsData.words as WhisperWord[];
  const phrases = groupIntoPhrases(allWords);

  let phraseIdx = -1;
  for (let i = 0; i < phrases.length; i++) {
    if (recTime >= phrases[i][0].start - 0.1) phraseIdx = i;
  }
  if (phraseIdx < 0) return <AbsoluteFill />;
  const phrase = phrases[phraseIdx];
  const nextPhrase = phrases[phraseIdx + 1];

  const phraseStart = phrase[0].start;
  const phraseEnd = nextPhrase
    ? Math.min(nextPhrase[0].start - 0.05, phrase[phrase.length - 1].end + 0.8)
    : phrase[phrase.length - 1].end + 0.8;
  const enterFrames = Math.round((recTime - phraseStart) * fps);
  const enter = spring({
    frame: enterFrames,
    fps,
    config: { damping: 16, stiffness: 130 },
  });
  const remaining = phraseEnd - recTime;
  const exitFade = interpolate(remaining, [0, 0.2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.max(0, Math.min(1, enter)) * exitFade;

  let activeWordIdx = -1;
  for (let i = 0; i < phrase.length; i++) {
    if (recTime >= phrase[i].start - 0.05) activeWordIdx = i;
  }
  const activeWord = activeWordIdx >= 0 ? phrase[activeWordIdx] : null;

  const sunBounce = activeWord
    ? Math.abs(
        Math.sin(
          ((recTime - activeWord.start) /
            Math.max(0.16, activeWord.end - activeWord.start)) *
            Math.PI
        )
      )
    : 0.5;
  const sunDy = -28 - sunBounce * 22;
  const sunSpin = sunBounce * 14 - 7;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: captionAtTop ? "flex-start" : "flex-end",
        paddingTop: captionAtTop ? 100 : 0,
        paddingBottom: captionAtTop ? 0 : 130,
        pointerEvents: "none",
        opacity,
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "baseline",
          rowGap: 14,
          columnGap: 22,
          fontFamily:
            '"Open Sans", "Inter", "Helvetica Neue", system-ui, sans-serif',
          fontWeight: 800,
          fontSize: 76,
          lineHeight: 1.08,
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: "0.005em",
        }}
      >
        {phrase.map((w, i) => {
          const isActive = i === activeWordIdx;
          const isPast = i < activeWordIdx;
          // YouTube-auto-caption palette:
          //   active   = bright yellow
          //   past     = white
          //   upcoming = white (subtle dim)
          const color = isActive
            ? "#FFD93D"
            : isPast
              ? "#FFFFFF"
              : "rgba(255,255,255,0.85)";
          // Heavy black outline via multi-direction text-shadow.
          // 4px in 8 directions ≈ a clean knockout outline.
          const stroke = [
            "-3px -3px 0 #000",
            "3px -3px 0 #000",
            "-3px 3px 0 #000",
            "3px 3px 0 #000",
            "0 -3px 0 #000",
            "0 3px 0 #000",
            "-3px 0 0 #000",
            "3px 0 0 #000",
            "0 0 12px rgba(0,0,0,0.85)",
          ].join(", ");
          return (
            <span
              key={i}
              style={{
                position: "relative",
                color,
                textShadow: stroke,
                display: "inline-block",
                transform: isActive ? "translateY(-2px)" : "translateY(0)",
                transition: "color 60ms ease-out, transform 60ms ease-out",
              }}
            >
              {isActive ? (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: 0,
                    transform: `translateX(-50%) translateY(${sunDy - 90}px)`,
                    pointerEvents: "none",
                    filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.5))",
                  }}
                >
                  <CartoonSun size={110} spin={sunSpin} />
                </span>
              ) : null}
              {w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const MiaRecording: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // Slow ken-burns: scale 1.0 → 1.08 over the recording's life
  const localFrame = frame; // sequence-local
  const scale = interpolate(
    localFrame,
    [0, durationInFrames],
    [1, 1.08],
    { extrapolateRight: "clamp" }
  );
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(RECORDING_PATH)}
        muted={false}
        volume={0.92}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          // Cinematic color grade: warmer, slightly contrasty
          filter:
            "saturate(1.15) contrast(1.08) brightness(1.04) hue-rotate(-3deg)",
        }}
      />
    </AbsoluteFill>
  );
};

const SkyBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const sunY = interpolate(frame, [0, 600], [120, 80], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, #B7E5FF 0%, #87CEEB 55%, #FFE7B7 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: sunY,
          right: 80,
          width: 220,
          height: 220,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, #FFE36A 0%, #FFD93D 60%, rgba(255,217,61,0) 80%)",
          filter: "blur(2px)",
        }}
      />
    </AbsoluteFill>
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background:
        "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.45) 100%)",
    }}
  />
);

const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sIn = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const sOut = spring({
    frame: frame - fps * 0.6,
    fps,
    config: { damping: 12, stiffness: 120 },
  });
  const opacity = interpolate(sOut, [0, 1], [1, 0]);
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      <div
        style={{
          transform: `scale(${0.7 + 0.3 * sIn})`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "Fredoka, sans-serif",
            fontWeight: 700,
            color: "#1B2A4E",
            fontSize: 130,
            letterSpacing: "-0.02em",
            textShadow: "8px 8px 0 rgba(255,217,61,1)",
          }}
        >
          🌞 The Quiz Book
        </div>
        <div
          style={{
            fontFamily: "Fredoka, sans-serif",
            color: "#C9296A",
            fontSize: 42,
            letterSpacing: "0.4em",
            marginTop: 6,
          }}
        >
          F · I · N · A · L · S
        </div>
      </div>
    </AbsoluteFill>
  );
};

const MatchupCard: React.FC<{
  bracket: string;
  a: string;
  b: string;
  accent: string;
}> = ({ bracket, a, b, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 130 },
  });
  const x = interpolate(slide, [0, 1], [-200, 0]);
  const opacity = interpolate(slide, [0, 1], [0, 1]);
  // Pulse effect on the VS
  const vsPulse = 1 + 0.06 * Math.sin(frame * 0.4);

  return (
    <AbsoluteFill
      style={{
        alignItems: "flex-start",
        justifyContent: "flex-end",
        padding: 80,
        opacity,
      }}
    >
      <div style={{ transform: `translateX(${x}px)` }}>
        <div
          style={{
            fontFamily: "Fredoka, sans-serif",
            fontSize: 28,
            color: "#FFFFFF",
            background: accent,
            padding: "10px 22px",
            borderRadius: 999,
            border: "4px solid #1B2A4E",
            boxShadow: "6px 6px 0 #1B2A4E",
            letterSpacing: "0.18em",
            fontWeight: 700,
            display: "inline-block",
            marginBottom: 18,
          }}
        >
          {bracket}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
            fontFamily: "Fredoka, sans-serif",
            fontWeight: 700,
          }}
        >
          <div
            style={{
              fontSize: 110,
              color: "#FFFFFF",
              textShadow: "8px 8px 0 #1B2A4E, 0 0 40px rgba(0,0,0,0.5)",
            }}
          >
            {a}
          </div>
          <div
            style={{
              fontSize: 70,
              color: accent,
              transform: `scale(${vsPulse})`,
              fontStyle: "italic",
              textShadow: "4px 4px 0 #1B2A4E",
            }}
          >
            vs
          </div>
          <div
            style={{
              fontSize: 110,
              color: "#FFFFFF",
              textShadow: "8px 8px 0 #1B2A4E, 0 0 40px rgba(0,0,0,0.5)",
            }}
          >
            {b}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ComingSoonLowerThird: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 11, stiffness: 110 } });
  const y = interpolate(s, [0, 1], [200, 0]);
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 80,
      }}
    >
      <div
        style={{
          transform: `translateY(${y}px)`,
          fontFamily: "Fredoka, sans-serif",
          fontSize: 86,
          fontWeight: 700,
          color: "#FFFFFF",
          textShadow: "6px 6px 0 #C9296A, 0 0 30px rgba(0,0,0,0.6)",
          letterSpacing: "0.04em",
        }}
      >
        coming soon
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame, [0, fps * 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: "#1B2A4E",
        alignItems: "center",
        justifyContent: "center",
        opacity: fade,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "Fredoka, sans-serif",
            fontSize: 80,
            fontWeight: 700,
            color: "#FFD93D",
            textShadow: "6px 6px 0 #C9296A",
            letterSpacing: "0.02em",
          }}
        >
          🌞 mia&apos;s quiz
        </div>
        <div
          style={{
            fontFamily: "Quicksand, sans-serif",
            fontSize: 28,
            color: "#FFFFFF",
            marginTop: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          quiz.miaswebsites.art
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Particles: React.FC = () => {
  const frame = useCurrentFrame();
  // 20 deterministic sparkle positions
  const particles = Array.from({ length: 18 }).map((_, i) => {
    const seed = i * 137.508;
    const x = ((Math.sin(seed) + 1) / 2) * 100;
    const y = ((Math.cos(seed * 1.3) + 1) / 2) * 100;
    const offset = i * 7;
    const opacity = 0.4 + 0.6 * Math.abs(Math.sin((frame + offset) * 0.06));
    const size = 6 + (i % 3) * 4;
    return { x, y, opacity, size, key: i };
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {particles.map((p) => (
        <div
          key={p.key}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "#FFFFFF",
            boxShadow: "0 0 16px 4px rgba(255,255,255,0.85)",
            opacity: p.opacity,
            transform: `translate(-50%, -50%)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
