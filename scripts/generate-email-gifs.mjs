// Build animated GIFs for the email assets. Replaces the SVG SMIL versions
// (which Gmail web silently strips) with GIFs that animate everywhere —
// Apple Mail, Gmail, Yahoo, iCloud, Outlook desktop included.
//
//   npx node scripts/generate-email-gifs.mjs
//
// Outputs:
//   public/email-assets/sun.gif       — slow-rotating picture-book sun
//   public/email-assets/crown.gif     — bobbing gold crown
//   public/email-assets/hearts.gif    — two beating coral hearts
//   public/email-assets/sparkles.gif  — five drifting / pulsing sparkles
//   public/email-assets/banner.gif    — sky banner with three drifting clouds

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import gifencPkg from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifencPkg;

const __filename = fileURLToPath(import.meta.url);
const OUT = resolve(dirname(__filename), "..", "public", "email-assets");

function svgToRgba(svgString, width, height) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: "width", value: width },
    background: "white",
  });
  const rendered = resvg.render();
  // resvg gives us a Uint8Array of RGBA bytes at the rendered size.
  return new Uint8Array(rendered.pixels);
}

// ─── sun (rotates) ─────────────────────────────────────────────────────
function sunSvg(angle) {
  const rays1 = Array.from({ length: 12 }).map((_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    return `<line x1="${(Math.cos(a) * 86).toFixed(1)}" y1="${(Math.sin(a) * 86).toFixed(1)}" x2="${(Math.cos(a) * 104).toFixed(1)}" y2="${(Math.sin(a) * 104).toFixed(1)}"/>`;
  }).join("");
  const rays2 = Array.from({ length: 12 }).map((_, i) => {
    const a = ((i * 30 + 15) * Math.PI) / 180;
    return `<line x1="${(Math.cos(a) * 83.7).toFixed(1)}" y1="${(Math.sin(a) * 83.7).toFixed(1)}" x2="${(Math.cos(a) * 101).toFixed(1)}" y2="${(Math.sin(a) * 101).toFixed(1)}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="220" height="220">
    <rect width="220" height="220" fill="#FFFFFF"/>
    <g transform="translate(110 110) rotate(${angle})">
      <g stroke="#1B2A4E" stroke-width="3" stroke-linecap="round" fill="none">${rays1}</g>
      <g stroke="#1B2A4E" stroke-width="3" stroke-linecap="round" fill="none">${rays2}</g>
    </g>
    <g transform="translate(110 110)">
      <circle cx="0" cy="0" r="64" fill="#FFD93D" stroke="#1B2A4E" stroke-width="3"/>
      <circle cx="-20" cy="-8" r="6" fill="#1B2A4E"/>
      <circle cx="20" cy="-8" r="6" fill="#1B2A4E"/>
      <path d="M -22 16 Q 0 38 22 16" fill="none" stroke="#1B2A4E" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="-26" cy="12" r="6" fill="#FF6B9D" opacity="0.7"/>
      <circle cx="26" cy="12" r="6" fill="#FF6B9D" opacity="0.7"/>
    </g>
  </svg>`;
}

// ─── crown (bobs) ──────────────────────────────────────────────────────
function crownSvg(yOffset) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180" width="200" height="180">
    <rect width="200" height="180" fill="#FFFFFF"/>
    <g transform="translate(100 ${100 + yOffset})">
      <path d="M -70 30 L -80 -30 L -40 0 L -20 -40 L 0 -10 L 20 -40 L 40 0 L 80 -30 L 70 30 Z" fill="#FFD93D" stroke="#1B2A4E" stroke-width="4" stroke-linejoin="round"/>
      <rect x="-72" y="28" width="144" height="20" fill="#F4A93A" stroke="#1B2A4E" stroke-width="4" rx="6"/>
      <circle cx="-60" cy="-26" r="6" fill="#FF6B9D" stroke="#1B2A4E" stroke-width="3"/>
      <circle cx="0" cy="-34" r="7" fill="#7DD87D" stroke="#1B2A4E" stroke-width="3"/>
      <circle cx="60" cy="-26" r="6" fill="#FF6B9D" stroke="#1B2A4E" stroke-width="3"/>
      <circle cx="-30" cy="38" r="4" fill="#1B2A4E"/>
      <circle cx="0" cy="38" r="4" fill="#1B2A4E"/>
      <circle cx="30" cy="38" r="4" fill="#1B2A4E"/>
    </g>
  </svg>`;
}

// ─── hearts (beat — staggered) ─────────────────────────────────────────
function heartsSvg(scaleA, scaleB) {
  const heart = (cx, cy, scale) => `<g transform="translate(${cx} ${cy}) scale(${scale.toFixed(3)})">
    <path d="M0 -20 C -28 -50, -65 -28, 0 32 C 65 -28, 28 -50, 0 -20 Z" fill="#FF6B9D" stroke="#1B2A4E" stroke-width="4" stroke-linejoin="round"/>
    <path d="M -16 -22 Q -10 -32 -2 -28" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.85"/>
  </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160" width="240" height="160">
    <rect width="240" height="160" fill="#FFFFFF"/>
    ${heart(80, 80, scaleA)}
    ${heart(160, 80, scaleB)}
  </svg>`;
}

// ─── sparkles (drift up + pulse) ───────────────────────────────────────
function sparklesSvg(t /* 0..1 */) {
  const points = [
    { x: 60, color: "#FFD93D", phase: 0.0, size: 14 },
    { x: 160, color: "#FF6B9D", phase: 0.2, size: 11 },
    { x: 260, color: "#7DD87D", phase: 0.4, size: 16 },
    { x: 360, color: "#87CEEB", phase: 0.6, size: 12 },
    { x: 440, color: "#FFD93D", phase: 0.8, size: 14 },
  ];
  const stars = points.map((p) => {
    const local = ((t + p.phase) % 1);
    const y = 100 - local * 70; // drifts up
    const opacity = Math.sin(local * Math.PI); // 0 -> 1 -> 0
    const s = p.size;
    return `<g transform="translate(${p.x} ${y.toFixed(1)})" opacity="${opacity.toFixed(3)}">
      <path d="M0 -${s} L${s/3} -${s/3} L${s} 0 L${s/3} ${s/3} L0 ${s} L-${s/3} ${s/3} L-${s} 0 L-${s/3} -${s/3} Z" fill="${p.color}" stroke="#1B2A4E" stroke-width="2"/>
    </g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 120" width="480" height="120">
    <rect width="480" height="120" fill="#FFFFFF"/>
    ${stars}
  </svg>`;
}

// ─── banner (clouds drift) ─────────────────────────────────────────────
function bannerSvg(t) {
  const cloud = (x, y, scale) => `<g transform="translate(${x.toFixed(1)} ${y}) scale(${scale})">
    <ellipse cx="55" cy="50" rx="30" ry="22" fill="white"/>
    <ellipse cx="100" cy="40" rx="38" ry="30" fill="white"/>
    <ellipse cx="148" cy="48" rx="28" ry="22" fill="white"/>
    <path d="M30 60 Q22 35 60 30 Q66 12 100 12 Q140 8 152 30 Q186 32 178 62 L46 62 Q22 62 30 60 Z" fill="none" stroke="#1B2A4E" stroke-width="3" stroke-linejoin="round"/>
  </g>`;
  // Three clouds drifting across at different speeds.
  const c1x = -200 + ((t * 1100) % 1100);
  const c2x = -300 + (((t + 0.4) * 1100) % 1100);
  const c3x = -150 + (((t + 0.7) * 1100) % 1100);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 80" width="800" height="80" preserveAspectRatio="none">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#B7E5FF"/>
        <stop offset="100%" stop-color="#87CEEB"/>
      </linearGradient>
    </defs>
    <rect width="800" height="80" fill="url(#sky)"/>
    ${cloud(c1x, 18, 0.5)}
    ${cloud(c2x, 30, 0.4)}
    ${cloud(c3x, 8, 0.45)}
  </svg>`;
}

const ASSETS = [
  {
    file: "sun.gif",
    width: 220,
    height: 220,
    paletteSize: 32,
    frames: () =>
      Array.from({ length: 30 }, (_, i) => ({
        svg: sunSvg((i * 360) / 30),
        delay: 100, // 30 frames * 100ms = 3s rotation
      })),
  },
  {
    file: "crown.gif",
    width: 200,
    height: 180,
    paletteSize: 32,
    frames: () => {
      const N = 30;
      return Array.from({ length: N }, (_, i) => {
        // Smooth bob: -8px to +5px back to -8px
        const t = i / N;
        const y = -1.5 + Math.sin(t * 2 * Math.PI) * 6.5;
        return { svg: crownSvg(y), delay: 80 };
      });
    },
  },
  {
    file: "hearts.gif",
    width: 240,
    height: 160,
    paletteSize: 24,
    frames: () => {
      const N = 24;
      return Array.from({ length: N }, (_, i) => {
        const t = i / N;
        // Heart A: full beat
        const sA = 1 + 0.18 * Math.max(0, Math.sin(t * 2 * Math.PI));
        // Heart B: same beat, offset by ~0.18 cycles (staggered)
        const tB = (t + 0.82) % 1;
        const sB = 1 + 0.18 * Math.max(0, Math.sin(tB * 2 * Math.PI));
        return { svg: heartsSvg(sA, sB), delay: 70 };
      });
    },
  },
  {
    file: "sparkles.gif",
    width: 480,
    height: 120,
    paletteSize: 32,
    frames: () => {
      const N = 30;
      return Array.from({ length: N }, (_, i) => ({
        svg: sparklesSvg(i / N),
        delay: 100,
      }));
    },
  },
  {
    file: "banner.gif",
    width: 800,
    height: 80,
    paletteSize: 32,
    frames: () => {
      const N = 40;
      return Array.from({ length: N }, (_, i) => ({
        svg: bannerSvg(i / N),
        delay: 120, // 40 * 120 = 4.8s
      }));
    },
  },
];

async function generateOne(asset) {
  const enc = GIFEncoder();
  const frames = asset.frames();
  for (const f of frames) {
    const rgba = svgToRgba(f.svg, asset.width, asset.height);
    const palette = quantize(rgba, asset.paletteSize, { format: "rgba4444" });
    const index = applyPalette(rgba, palette, "rgba4444");
    enc.writeFrame(index, asset.width, asset.height, {
      palette,
      delay: f.delay ?? 100,
      dispose: 2,
    });
  }
  enc.finish();
  const bytes = Buffer.from(enc.bytes());
  const out = resolve(OUT, asset.file);
  writeFileSync(out, bytes);
  console.log(
    `  ✓ ${asset.file}  ${asset.width}×${asset.height}  ${frames.length}f  ${(bytes.length / 1024).toFixed(1)} KB`
  );
}

console.log("Generating animated GIFs for emails…");
for (const a of ASSETS) {
  await generateOne(a);
}
console.log(`Done — wrote to ${OUT}`);
