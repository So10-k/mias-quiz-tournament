// Parody fake-commercial Remotion comp. ~20s with 7 punchy beats.
//
// Distinctive per-ad style comes from a TransitionPack — slam,
// glitch, drift, flash, bounce, pulse, spin, or wobble. Each pack
// retunes entry curves, timing emphasis, and ambient screen FX
// (camera shake, RGB split, scan lines, color flashes, sparkles)
// so back-to-back ads don't share the same kinetic language.

import {
  AbsoluteFill,
  Img,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import React from "react";
import { AD_ARTWORK } from "./AdArtwork";

export type AdLayout = "classic" | "split" | "infomercial";

export type TransitionPack =
  | "slam" // hard pops + heavy camera shake, snap cuts
  | "glitch" // RGB chromatic aberration + scan lines + jitter
  | "drift" // slow float, almost no FX, calm
  | "flash" // bright color flashes between beats
  | "bounce" // heavy spring overshoots, springy everything
  | "pulse" // rhythmic scale heartbeats
  | "spin" // 360° rotations on entry
  | "wobble"; // dreamy sine-wave rotation

export type ParodyAdProps = {
  preroll?: string;
  brand: string;
  trademark?: string;
  emoji?: string;
  tagline: string;
  testimonial: string;
  testimonialAuthor: string;
  finePrint: string;
  bg?: string;
  bg2?: string;
  accent?: string;
  fg?: string;
  layout?: AdLayout;
  /** Picks the kinetic style. Defaults to "slam". */
  transitionPack?: TransitionPack;
  artworkId?: string;
  imageUrl?: string;
  bullets?: string[];
};

export const PARODY_AD_FPS = 30;
export const PARODY_AD_DURATION_FRAMES = PARODY_AD_FPS * 20;

// ────────────────────────────────────────────────────────────────────
// 7-beat timeline (seconds, fast-paced):
//   0.0 – 0.8   preroll badge
//   0.8 – 3.5   brand reveal
//   3.5 – 7.0   tagline + image hero
//   7.0 – 10.0  punch-zoom on image / feature focus
//   10.0 – 13.5 testimonial slam-in
//   13.5 – 17.0 bullets / before-after
//   17.0 – 20.0 final brand stamp + fine-print crawl
// ────────────────────────────────────────────────────────────────────

const BEATS = {
  preroll: { in: 0.0, out: 0.8 },
  brand: { in: 0.8, out: 3.5 },
  tagline: { in: 3.5, out: 7.0 },
  punch: { in: 7.0, out: 10.0 },
  testimonial: { in: 10.0, out: 13.5 },
  bullets: { in: 13.5, out: 17.0 },
  stamp: { in: 17.0, out: 20.0 },
};

export const ParodyAd: React.FC<ParodyAdProps> = (props) => {
  const layout = props.layout ?? "classic";
  const pack = props.transitionPack ?? "slam";
  if (layout === "split") return <SplitAd {...props} pack={pack} />;
  if (layout === "infomercial") return <InfomercialAd {...props} pack={pack} />;
  return <ClassicAd {...props} pack={pack} />;
};

// ────────────────────────────────────────────────────────────────────
// Motion helpers
// ────────────────────────────────────────────────────────────────────

// Window opacity for a given beat — fades in 0.2s, holds, fades out 0.2s.
function beatOpacity(t: number, inSec: number, outSec: number, fade = 0.2) {
  return interpolate(
    t,
    [inSec, inSec + fade, outSec - fade, outSec],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
}

type EntryMotion = {
  /** CSS transform string to apply for the entry animation. */
  transform: string;
  /** Multiplied with the beat opacity. */
  opacity: number;
};

// Returns the entry transform/opacity for the given pack at progress
// p ∈ [0,1] (0 = pre-entry, 1 = settled).
function packEntry(pack: TransitionPack, p: number): EntryMotion {
  const clamped = Math.max(0, Math.min(1, p));
  const easeOut = 1 - Math.pow(1 - clamped, 3);
  const overshoot = (() => {
    if (clamped >= 1) return 1;
    const t = clamped;
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  })();

  switch (pack) {
    case "slam":
      // Drop from above with overshoot.
      return {
        transform: `translateY(${(1 - overshoot) * -120}px) scale(${0.7 + overshoot * 0.3})`,
        opacity: easeOut,
      };
    case "glitch": {
      // Choppy stepped entrance.
      const stepped = Math.floor(clamped * 6) / 6;
      const jitter = clamped < 0.9 ? Math.sin(clamped * 60) * 4 : 0;
      return {
        transform: `translate(${jitter}px, ${(1 - stepped) * 30}px) skewX(${(1 - stepped) * 4}deg)`,
        opacity: stepped,
      };
    }
    case "drift":
      // Soft float-in from below.
      return {
        transform: `translateY(${(1 - easeOut) * 40}px)`,
        opacity: easeOut,
      };
    case "flash":
      // Hard cut, no transform.
      return {
        transform: `scale(${clamped > 0.05 ? 1 : 0.8})`,
        opacity: clamped > 0.05 ? 1 : 0,
      };
    case "bounce":
      // Heavy overshoot spring.
      return {
        transform: `scale(${0.4 + overshoot * 0.7})`,
        opacity: easeOut,
      };
    case "pulse":
      // Scale heartbeat in.
      return {
        transform: `scale(${easeOut * (1 + Math.sin(clamped * Math.PI * 4) * 0.1)})`,
        opacity: easeOut,
      };
    case "spin":
      // Big rotation.
      return {
        transform: `rotate(${(1 - easeOut) * -540}deg) scale(${0.3 + easeOut * 0.7})`,
        opacity: easeOut,
      };
    case "wobble":
      // Float in with sine wobble.
      return {
        transform: `translateY(${(1 - easeOut) * 30}px) rotate(${Math.sin(clamped * 8) * 6 * (1 - easeOut * 0.5)}deg)`,
        opacity: easeOut,
      };
  }
}

// Long-duration ambient motion (hover wiggle etc.) applied while a
// settled element is on screen.
function packAmbient(pack: TransitionPack, frame: number, fps: number): string {
  const t = frame / fps;
  switch (pack) {
    case "slam":
      // Subtle micro-shake.
      return `translate(${Math.sin(t * 60) * 0.5}px, ${Math.cos(t * 55) * 0.5}px)`;
    case "glitch": {
      const skip = Math.floor(t * 3) % 7 === 0;
      const jx = skip ? (random(`gx-${Math.floor(t * 3)}`) - 0.5) * 6 : 0;
      const jy = skip ? (random(`gy-${Math.floor(t * 3)}`) - 0.5) * 4 : 0;
      return `translate(${jx}px, ${jy}px)`;
    }
    case "drift":
      return `translateY(${Math.sin(t * 1.2) * 6}px)`;
    case "flash":
      return ``;
    case "bounce":
      return `scale(${1 + Math.sin(t * 4) * 0.02})`;
    case "pulse":
      return `scale(${1 + Math.sin(t * 6) * 0.04})`;
    case "spin":
      return `rotate(${Math.sin(t * 2) * 2}deg)`;
    case "wobble":
      return `rotate(${Math.sin(t * 3) * 3}deg)`;
  }
}

// Ambient screen-wide effects layered on top of the content.
const ScreenFx: React.FC<{ pack: TransitionPack; accent: string }> = ({
  pack,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Camera shake — applies to a wrapper. Only used by slam + glitch.
  const shakeX =
    pack === "slam" && t % 3 < 0.2
      ? Math.sin(frame * 0.8) * 6
      : pack === "glitch" && Math.floor(t * 4) % 9 === 0
        ? (random(`sx-${Math.floor(t * 4)}`) - 0.5) * 12
        : 0;
  const shakeY =
    pack === "slam" && t % 3 < 0.2
      ? Math.cos(frame * 0.7) * 4
      : pack === "glitch" && Math.floor(t * 4) % 9 === 0
        ? (random(`sy-${Math.floor(t * 4)}`) - 0.5) * 8
        : 0;

  // Color flash — flash, pulse, bounce.
  const flashOn =
    (pack === "flash" && t % 2.5 < 0.08) ||
    (pack === "bounce" && [3.5, 7, 10, 13.5, 17].some((b) => Math.abs(t - b) < 0.05));
  const flashColor = pack === "flash" ? "#FFFFFF" : accent;

  // RGB split + scan lines for glitch.
  const isGlitch = pack === "glitch";

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${shakeX}px, ${shakeY}px)`,
        pointerEvents: "none",
      }}
    >
      {flashOn ? (
        <AbsoluteFill
          style={{
            background: flashColor,
            mixBlendMode: pack === "flash" ? "screen" : "overlay",
            opacity: 0.85,
          }}
        />
      ) : null}
      {isGlitch ? (
        <AbsoluteFill
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 2px, transparent 2px, transparent 6px)",
            mixBlendMode: "multiply",
          }}
        />
      ) : null}
      {pack === "pulse" ? (
        <AbsoluteFill
          style={{
            boxShadow: `inset 0 0 ${120 + Math.sin(t * 6) * 60}px ${accent}`,
            pointerEvents: "none",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

// Sparkle particles — used as ambient garnish on most packs.
const Sparkles: React.FC<{ pack: TransitionPack; count?: number }> = ({
  pack,
  count = 14,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  if (pack === "drift" || pack === "wobble" || pack === "glitch") return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => {
        const startFrame = Math.floor(random(`s-start-${i}`) * durationInFrames);
        const life = 30;
        const localFrame = frame - startFrame;
        if (localFrame < 0 || localFrame > life) return null;
        const p = localFrame / life;
        const x = random(`s-x-${i}`) * 1920;
        const y = random(`s-y-${i}`) * 1080;
        const scale = (1 - Math.abs(0.5 - p) * 2) * 1.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              fontSize: 28,
              opacity: scale,
              transform: `scale(${scale}) rotate(${p * 180}deg)`,
              filter: "drop-shadow(0 0 6px rgba(255,255,255,0.8))",
            }}
          >
            ✦
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ────────────────────────────────────────────────────────────────────
// Shared shell
// ────────────────────────────────────────────────────────────────────

const Shell: React.FC<{
  bg: string;
  bg2: string;
  accent: string;
  fg: string;
  preroll: string;
  finePrint: string;
  pack: TransitionPack;
  children: React.ReactNode;
}> = ({ bg, bg2, accent, fg, preroll, finePrint, pack, children }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const prerollOpacity = beatOpacity(t, BEATS.preroll.in, BEATS.preroll.out, 0.15);
  const prerollEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.preroll.in) / 0.4))
  );
  const fineCrawlX = interpolate(
    frame,
    [PARODY_AD_FPS * 17, durationInFrames],
    [1920, -3500]
  );
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${bg} 0%, ${bg2} 100%)`,
        fontFamily: "Fredoka, Quicksand, system-ui, sans-serif",
        color: fg,
        overflow: "hidden",
      }}
    >
      <ScreenFx pack={pack} accent={accent} />
      <Sparkles pack={pack} />
      <div
        style={{
          position: "absolute",
          top: 56,
          left: "50%",
          transform: `translateX(-50%) ${prerollEntry.transform}`,
          padding: "10px 28px",
          background: accent,
          color: "#1B2A4E",
          fontWeight: 700,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          fontSize: 26,
          borderRadius: 999,
          opacity: prerollOpacity * prerollEntry.opacity,
          border: "4px solid #1B2A4E",
          boxShadow: "6px 6px 0 #1B2A4E",
        }}
      >
        {preroll}
      </div>
      {children}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 24,
          height: 52,
          background: "rgba(0,0,0,0.6)",
          color: "#FFF",
          fontFamily: "monospace",
          fontSize: 21,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            whiteSpace: "nowrap",
            transform: `translateX(${fineCrawlX}px)`,
          }}
        >
          {finePrint}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Hero illustration (AI image or fallback artwork). Wraps it in a card.
const Hero: React.FC<{
  emoji?: string;
  artworkId?: string;
  imageUrl?: string;
  size?: number;
}> = ({ emoji, artworkId, imageUrl, size = 540 }) => {
  if (imageUrl) {
    return (
      <Img
        src={imageUrl}
        style={{
          width: size,
          height: size * 0.75,
          objectFit: "cover",
          borderRadius: 24,
          border: "4px solid #1B2A4E",
          boxShadow: "10px 10px 0 rgba(0,0,0,0.35)",
        }}
      />
    );
  }
  const Art = artworkId ? AD_ARTWORK[artworkId] : null;
  if (Art) {
    return (
      <div
        style={{
          width: size,
          height: size * 0.75,
          background: "#FFFBED",
          borderRadius: 24,
          border: "4px solid #1B2A4E",
          boxShadow: "10px 10px 0 rgba(0,0,0,0.35)",
          padding: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Art />
      </div>
    );
  }
  return (
    <div
      style={{
        fontSize: 220,
        lineHeight: 1,
        filter: "drop-shadow(10px 14px 0 rgba(0,0,0,0.55))",
      }}
    >
      {emoji ?? "🎬"}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────
// CLASSIC layout
// ────────────────────────────────────────────────────────────────────

const ClassicAd: React.FC<ParodyAdProps & { pack: TransitionPack }> = ({
  preroll = "A WORD FROM OUR SPONSOR",
  brand,
  trademark = "™",
  emoji,
  artworkId,
  imageUrl,
  tagline,
  testimonial,
  testimonialAuthor,
  finePrint,
  bg = "#1B2A4E",
  bg2 = "#3B4A7E",
  accent = "#FFD93D",
  fg = "#FFFFFF",
  pack,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const brandEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.brand.in) / 0.5))
  );
  const taglineEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.tagline.in) / 0.5))
  );
  const punchEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.punch.in) / 0.4))
  );
  const testimonialEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.testimonial.in) / 0.5))
  );
  const stampEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.stamp.in) / 0.5))
  );

  const brandOp = beatOpacity(t, BEATS.brand.in, BEATS.tagline.out, 0.25);
  const taglineOp = beatOpacity(t, BEATS.tagline.in, BEATS.tagline.out, 0.25);
  const punchOp = beatOpacity(t, BEATS.punch.in, BEATS.punch.out, 0.25);
  const testimonialOp = beatOpacity(
    t,
    BEATS.testimonial.in,
    BEATS.testimonial.out,
    0.25
  );
  const stampOp = beatOpacity(t, BEATS.stamp.in, BEATS.stamp.out, 0.25);

  const ambient = packAmbient(pack, frame, fps);

  return (
    <Shell
      bg={bg}
      bg2={bg2}
      accent={accent}
      fg={fg}
      preroll={preroll}
      finePrint={finePrint}
      pack={pack}
    >
      {/* Brand + Tagline beats */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 96,
          opacity: Math.max(brandOp, taglineOp),
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 1600 }}>
          <div
            style={{
              opacity: brandOp,
              transform: `${brandEntry.transform} ${ambient}`,
            }}
          >
            <Hero
              emoji={emoji}
              artworkId={artworkId}
              imageUrl={imageUrl}
              size={460}
            />
          </div>
          <div
            style={{
              marginTop: 22,
              fontSize: 138,
              fontWeight: 700,
              textShadow: `8px 8px 0 ${accent}`,
              transform: brandEntry.transform,
              opacity: brandOp,
            }}
          >
            {brand}
            <span
              style={{
                fontSize: 54,
                verticalAlign: "super",
                color: accent,
                marginLeft: 6,
              }}
            >
              {trademark}
            </span>
          </div>
          <div
            style={{
              marginTop: 22,
              fontSize: 50,
              fontWeight: 500,
              color: accent,
              maxWidth: 1400,
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.25,
              transform: taglineEntry.transform,
              opacity: taglineOp,
            }}
          >
            {tagline}
          </div>
        </div>
      </AbsoluteFill>

      {/* Punch zoom beat — image swells to fill */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 60,
          opacity: punchOp,
        }}
      >
        <div
          style={{
            transform: `${punchEntry.transform} scale(${0.9 + (1 - Math.abs(0.5 - (t - BEATS.punch.in) / 3)) * 0.3})`,
          }}
        >
          <Hero
            emoji={emoji}
            artworkId={artworkId}
            imageUrl={imageUrl}
            size={760}
          />
        </div>
      </AbsoluteFill>

      <Testimonial
        entry={testimonialEntry}
        opacity={testimonialOp}
        accent={accent}
        text={testimonial}
        author={testimonialAuthor}
      />

      {/* Brand stamp */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 60,
          opacity: stampOp,
        }}
      >
        <div
          style={{
            transform: stampEntry.transform,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 180,
              fontWeight: 700,
              color: fg,
              textShadow: `10px 10px 0 ${accent}`,
            }}
          >
            {brand}
            <span
              style={{
                fontSize: 70,
                verticalAlign: "super",
                color: accent,
                marginLeft: 8,
              }}
            >
              {trademark}
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </Shell>
  );
};

// ────────────────────────────────────────────────────────────────────
// SPLIT layout — image L, copy R
// ────────────────────────────────────────────────────────────────────

const SplitAd: React.FC<ParodyAdProps & { pack: TransitionPack }> = ({
  preroll = "INTERRUPTING THIS BROADCAST",
  brand,
  trademark = "™",
  emoji,
  artworkId,
  imageUrl,
  tagline,
  testimonial,
  testimonialAuthor,
  finePrint,
  bg = "#FFD93D",
  bg2 = "#FF8C42",
  accent = "#1B2A4E",
  fg = "#1B2A4E",
  pack,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const leftEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.brand.in) / 0.45))
  );
  const rightEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.brand.in - 0.25) / 0.45))
  );
  const punchEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.punch.in) / 0.4))
  );
  const testimonialEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.testimonial.in) / 0.5))
  );
  const stampEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.stamp.in) / 0.45))
  );

  const mainOp = beatOpacity(t, BEATS.brand.in, BEATS.tagline.out, 0.25);
  const punchOp = beatOpacity(t, BEATS.punch.in, BEATS.punch.out, 0.25);
  const testimonialOp = beatOpacity(
    t,
    BEATS.testimonial.in,
    BEATS.testimonial.out,
    0.25
  );
  const stampOp = beatOpacity(t, BEATS.stamp.in, BEATS.stamp.out, 0.25);

  const ambient = packAmbient(pack, frame, fps);

  return (
    <Shell
      bg={bg}
      bg2={bg2}
      accent={accent}
      fg={fg}
      preroll={preroll}
      finePrint={finePrint}
      pack={pack}
    >
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "140px 96px 100px",
          opacity: mainOp,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 80,
            width: "100%",
            maxWidth: 1700,
          }}
        >
          <div
            style={{
              transform: `${leftEntry.transform} translateX(${(1 - leftEntry.opacity) * -200}px) ${ambient}`,
              opacity: leftEntry.opacity,
            }}
          >
            <Hero
              emoji={emoji}
              artworkId={artworkId}
              imageUrl={imageUrl}
              size={620}
            />
          </div>
          <div
            style={{
              flex: 1,
              transform: `${rightEntry.transform} translateX(${(1 - rightEntry.opacity) * 200}px)`,
              opacity: rightEntry.opacity,
            }}
          >
            <div
              style={{
                fontSize: 32,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: accent,
              }}
            >
              now introducing
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 124,
                fontWeight: 700,
                lineHeight: 1,
                textShadow: `6px 6px 0 ${accent}`,
                color: fg,
              }}
            >
              {brand}
              <span
                style={{
                  fontSize: 52,
                  verticalAlign: "super",
                  marginLeft: 6,
                }}
              >
                {trademark}
              </span>
            </div>
            <div
              style={{
                marginTop: 26,
                fontSize: 44,
                fontWeight: 500,
                lineHeight: 1.3,
                color: fg,
              }}
            >
              {tagline}
            </div>
          </div>
        </div>
      </AbsoluteFill>

      {/* Punch beat — flip the sides */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "140px 96px 100px",
          opacity: punchOp,
        }}
      >
        <div style={{ transform: punchEntry.transform, textAlign: "center" }}>
          <Hero
            emoji={emoji}
            artworkId={artworkId}
            imageUrl={imageUrl}
            size={820}
          />
        </div>
      </AbsoluteFill>

      <Testimonial
        entry={testimonialEntry}
        opacity={testimonialOp}
        accent={accent}
        text={testimonial}
        author={testimonialAuthor}
      />

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 60,
          opacity: stampOp,
        }}
      >
        <div
          style={{
            transform: stampEntry.transform,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 180,
              fontWeight: 700,
              color: fg,
              textShadow: `10px 10px 0 ${accent}`,
            }}
          >
            {brand}
            <span
              style={{
                fontSize: 70,
                verticalAlign: "super",
                marginLeft: 8,
              }}
            >
              {trademark}
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </Shell>
  );
};

// ────────────────────────────────────────────────────────────────────
// INFOMERCIAL layout
// ────────────────────────────────────────────────────────────────────

const InfomercialAd: React.FC<ParodyAdProps & { pack: TransitionPack }> = ({
  preroll = "AS SEEN ON THE INTERNET",
  brand,
  trademark = "™",
  emoji,
  artworkId,
  imageUrl,
  tagline,
  testimonial,
  testimonialAuthor,
  finePrint,
  bg = "#C9296A",
  bg2 = "#8B1538",
  accent = "#FFD93D",
  fg = "#FFFFFF",
  bullets = ["Easy", "Fast", "Definitely real"],
  pack,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const brandEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.brand.in) / 0.5))
  );
  const taglineEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.tagline.in) / 0.5))
  );
  const testimonialEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.testimonial.in) / 0.5))
  );

  const brandOp = beatOpacity(t, BEATS.brand.in, BEATS.bullets.out, 0.25);
  const testimonialOp = beatOpacity(
    t,
    BEATS.testimonial.in,
    BEATS.testimonial.out,
    0.25
  );
  const stampOp = beatOpacity(t, BEATS.stamp.in, BEATS.stamp.out, 0.25);
  const stampEntry = packEntry(
    pack,
    Math.max(0, Math.min(1, (t - BEATS.stamp.in) / 0.5))
  );

  const ambient = packAmbient(pack, frame, fps);

  return (
    <Shell
      bg={bg}
      bg2={bg2}
      accent={accent}
      fg={fg}
      preroll={preroll}
      finePrint={finePrint}
      pack={pack}
    >
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "140px 96px 100px",
          opacity: brandOp,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 22,
            width: "100%",
            maxWidth: 1600,
          }}
        >
          <div
            style={{
              transform: `${brandEntry.transform} ${ambient}`,
              opacity: brandEntry.opacity,
            }}
          >
            <Hero
              emoji={emoji}
              artworkId={artworkId}
              imageUrl={imageUrl}
              size={420}
            />
          </div>
          <div
            style={{
              fontSize: 110,
              fontWeight: 700,
              lineHeight: 1,
              textShadow: `5px 5px 0 ${accent}`,
              transform: brandEntry.transform,
              opacity: brandEntry.opacity,
            }}
          >
            {brand}
            <span
              style={{
                fontSize: 46,
                verticalAlign: "super",
                marginLeft: 6,
              }}
            >
              {trademark}
            </span>
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 500,
              maxWidth: 1300,
              textAlign: "center",
              lineHeight: 1.3,
              color: accent,
              transform: taglineEntry.transform,
              opacity: taglineEntry.opacity,
            }}
          >
            {tagline}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 18,
              flexWrap: "wrap",
              justifyContent: "center",
              marginTop: 6,
            }}
          >
            {(bullets.length > 0
              ? bullets
              : ["✨ Yes", "🎉 Wow", "🏆 Sure"]).map((b, i) => (
              <BulletPill
                key={i}
                text={b}
                index={i}
                accent={accent}
                pack={pack}
              />
            ))}
          </div>
        </div>
      </AbsoluteFill>

      <Testimonial
        entry={testimonialEntry}
        opacity={testimonialOp}
        accent={accent}
        text={testimonial}
        author={testimonialAuthor}
      />

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 60,
          opacity: stampOp,
        }}
      >
        <div style={{ transform: stampEntry.transform, textAlign: "center" }}>
          <div
            style={{
              fontSize: 180,
              fontWeight: 700,
              color: fg,
              textShadow: `10px 10px 0 ${accent}`,
            }}
          >
            {brand}
            <span
              style={{
                fontSize: 70,
                verticalAlign: "super",
                marginLeft: 8,
              }}
            >
              {trademark}
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </Shell>
  );
};

// ────────────────────────────────────────────────────────────────────
// Shared partials
// ────────────────────────────────────────────────────────────────────

const BulletPill: React.FC<{
  text: string;
  index: number;
  accent: string;
  pack: TransitionPack;
}> = ({ text, index, accent, pack }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = packEntry(
    pack,
    Math.max(0, Math.min(1, (frame / fps - (BEATS.tagline.in + 1 + index * 0.25)) / 0.4))
  );
  return (
    <div
      style={{
        padding: "12px 26px",
        background: "rgba(255,255,255,0.96)",
        color: "#1B2A4E",
        border: "4px solid #1B2A4E",
        borderRadius: 18,
        fontSize: 34,
        fontWeight: 700,
        boxShadow: `6px 6px 0 ${accent}`,
        transform: enter.transform,
        opacity: enter.opacity,
      }}
    >
      {text}
    </div>
  );
};

const Testimonial: React.FC<{
  entry: EntryMotion;
  opacity: number;
  accent: string;
  text: string;
  author: string;
}> = ({ entry, opacity, accent, text, author }) => {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 120,
        opacity,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          background: "rgba(255,255,255,0.97)",
          color: "#1B2A4E",
          padding: "44px 56px",
          borderRadius: 28,
          border: `5px solid ${accent}`,
          boxShadow: `14px 14px 0 ${accent}`,
          transform: entry.transform,
        }}
      >
        <div
          style={{
            fontSize: 28,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: accent,
          }}
        >
          real testimonial · totally not paid
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 58,
            fontWeight: 600,
            fontStyle: "italic",
            lineHeight: 1.2,
          }}
        >
          “{text}”
        </div>
        <div
          style={{
            marginTop: 22,
            fontSize: 36,
            fontWeight: 700,
            color: "#1B2A4E",
          }}
        >
          — {author}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Silence the unused-import warning when ambient packs don't use spring.
void spring;
