import { NextRequest, NextResponse } from "next/server";
import { Resvg } from "@resvg/resvg-js";
import { createRequire } from "node:module";

// gifenc ships as a CommonJS module without proper ESM shims; loading via
// createRequire avoids webpack's interop drama at build time.
const require = createRequire(import.meta.url);
const gifenc = require("gifenc") as {
  GIFEncoder: () => {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      opts: { palette: number[][]; delay?: number; dispose?: number }
    ) => void;
    finish: () => void;
    bytes: () => Uint8Array;
  };
  quantize: (
    data: Uint8Array,
    n: number,
    opts?: { format?: string }
  ) => number[][];
  applyPalette: (
    data: Uint8Array,
    palette: number[][],
    format?: string
  ) => Uint8Array;
};
const { GIFEncoder, quantize, applyPalette } = gifenc;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Live-updating countdown GIF. Email clients fetch the URL on every open
// (modulo proxy caches); we render a 60-frame animated GIF starting from
// the current moment and counting down second-by-second. Inside a single
// open the digits actually tick. On the next open the email client (or
// proxy) re-fetches → fresh 60-second window starting from the new "now".
//
// Query params:
//   to     ISO timestamp of the deadline (required)
//   label  Heading above the digits (default "Round closes in")
//   theme  "urgent" (cream + coral, default) or "sunny" (sky blue)

const W = 720;
const H = 220;
const FRAMES = 60;
const FRAME_MS = 1000;

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function partsFromMs(ms: number) {
  if (ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds };
}

function buildSvg(
  parts: ReturnType<typeof partsFromMs>,
  label: string,
  theme: "urgent" | "sunny"
) {
  const palette =
    theme === "urgent"
      ? {
          bgFrom: "#FFE9B0",
          bgTo: "#FFB766",
          card: "#FFF7E6",
          stroke: "#1B2A4E",
          accent: "#E94B7E",
          digit: "#1B2A4E",
          shadow: "#1B2A4E",
        }
      : {
          bgFrom: "#B7E5FF",
          bgTo: "#87CEEB",
          card: "#FFFFFF",
          stroke: "#1B2A4E",
          accent: "#E94B7E",
          digit: "#1B2A4E",
          shadow: "#1B2A4E",
        };

  if (!parts) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${palette.bgFrom}"/><stop offset="100%" stop-color="${palette.bgTo}"/>
      </linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <text x="${W / 2}" y="${H / 2 - 16}" text-anchor="middle" font-family="Fredoka,Quicksand,sans-serif" font-weight="700" font-size="42" fill="${palette.accent}">⌛ Time's up!</text>
      <text x="${W / 2}" y="${H / 2 + 30}" text-anchor="middle" font-family="Quicksand,sans-serif" font-size="22" fill="${palette.digit}">The deadline has passed.</text>
    </svg>`;
  }

  const cells = [
    { value: pad(parts.days), label: parts.days === 1 ? "DAY" : "DAYS" },
    { value: pad(parts.hours), label: "HOURS" },
    { value: pad(parts.minutes), label: "MIN" },
    { value: pad(parts.seconds), label: "SEC" },
  ];
  const cellW = 130;
  const cellH = 110;
  const gap = 16;
  const total = cells.length * cellW + (cells.length - 1) * gap;
  const startX = (W - total) / 2;
  const startY = (H - cellH) / 2 + 18;
  const body = cells
    .map(
      (c, i) => `
      <g transform="translate(${startX + i * (cellW + gap)} ${startY})">
        <rect x="3" y="4" width="${cellW}" height="${cellH}" fill="${palette.shadow}" rx="14"/>
        <rect x="0" y="0" width="${cellW}" height="${cellH}" fill="${palette.card}" stroke="${palette.stroke}" stroke-width="3" rx="14"/>
        <line x1="0" y1="${cellH / 2}" x2="${cellW}" y2="${cellH / 2}" stroke="${palette.stroke}" stroke-width="1" opacity="0.18"/>
        <text x="${cellW / 2}" y="${cellH / 2 - 8}" text-anchor="middle" font-family="Fredoka,Quicksand,sans-serif" font-weight="700" font-size="56" fill="${palette.digit}">${c.value}</text>
        <text x="${cellW / 2}" y="${cellH - 16}" text-anchor="middle" font-family="Fredoka,Quicksand,sans-serif" font-weight="700" font-size="13" fill="${palette.accent}" letter-spacing="2">${c.label}</text>
      </g>`
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.bgFrom}"/><stop offset="100%" stop-color="${palette.bgTo}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <circle cx="40" cy="40" r="9" fill="${palette.accent}" stroke="${palette.stroke}" stroke-width="2"/>
    <text x="74" y="46" font-family="Fredoka,Quicksand,sans-serif" font-weight="700" font-size="14" fill="${palette.accent}" letter-spacing="2.5">${esc(label.toUpperCase())}</text>
    ${body}
  </svg>`;
}

function svgToRgba(svg: string): Uint8Array {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    background: "white",
    font: { loadSystemFonts: false },
  });
  const rendered = resvg.render();
  return new Uint8Array(rendered.pixels);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const toRaw = sp.get("to") ?? "";
  const label = sp.get("label") ?? "Round closes in";
  const theme = sp.get("theme") === "sunny" ? "sunny" : "urgent";

  const target = toRaw ? new Date(toRaw) : null;
  const targetMs =
    target && !isNaN(target.getTime()) ? target.getTime() : null;

  const enc = GIFEncoder();
  const baseNow = Date.now();

  for (let i = 0; i < FRAMES; i++) {
    const frameTime = baseNow + i * FRAME_MS;
    const parts =
      targetMs !== null ? partsFromMs(targetMs - frameTime) : null;
    const svg = buildSvg(parts, label, theme);
    const rgba = svgToRgba(svg);
    const palette = quantize(rgba, 32, { format: "rgba4444" });
    const index = applyPalette(rgba, palette, "rgba4444");
    enc.writeFrame(index, W, H, {
      palette,
      delay: FRAME_MS,
      dispose: 2,
    });
  }
  enc.finish();

  const bytes = Buffer.from(enc.bytes());
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "content-type": "image/gif",
      "content-length": String(bytes.length),
      "cache-control":
        "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0",
      pragma: "no-cache",
      expires: "0",
    },
  });
}
