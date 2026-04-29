import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Live-updating countdown image. Email clients fetch the URL each time
// the recipient opens the email; we render a fresh SVG with current
// time-remaining baked in. Best-effort "live" — Gmail/Yahoo proxies will
// cache briefly, but no-store/max-age=0 keeps the cache window short.
//
// Query params:
//   to    ISO timestamp of the deadline (required, e.g. 2026-05-02T21:00:00-04:00)
//   label small label above the digits (default "Round closes in")
//   theme "urgent" (coral on cream) or "sunny" (default — sun on sky)

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

function formatRemaining(ms: number) {
  if (ms <= 0)
    return { days: 0, hours: 0, minutes: 0, seconds: 0, finished: true };
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, finished: false };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const toRaw = sp.get("to") ?? "";
  const label = sp.get("label") ?? "Round closes in";
  const theme = sp.get("theme") === "urgent" ? "urgent" : "sunny";

  const target = toRaw ? new Date(toRaw) : null;
  const now = Date.now();
  const targetMs = target && !isNaN(target.getTime()) ? target.getTime() : null;
  const remaining =
    targetMs !== null ? formatRemaining(targetMs - now) : null;

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

  // Card geometry
  const W = 720;
  const H = 220;

  let body: string;
  if (!remaining) {
    body = `
      <text x="${W / 2}" y="${H / 2 + 4}" text-anchor="middle" font-family="Fredoka,Quicksand,sans-serif" font-weight="700" font-size="32" fill="${palette.digit}">⏰ Set a deadline to use the countdown</text>
    `;
  } else if (remaining.finished) {
    body = `
      <text x="${W / 2}" y="${H / 2 - 18}" text-anchor="middle" font-family="Fredoka,Quicksand,sans-serif" font-weight="700" font-size="40" fill="${palette.accent}">⌛ Time's up!</text>
      <text x="${W / 2}" y="${H / 2 + 30}" text-anchor="middle" font-family="Quicksand,sans-serif" font-size="20" fill="${palette.digit}">The deadline has passed.</text>
    `;
  } else {
    const cells = [
      { value: pad(remaining.days), label: remaining.days === 1 ? "DAY" : "DAYS" },
      { value: pad(remaining.hours), label: "HOURS" },
      { value: pad(remaining.minutes), label: "MIN" },
      { value: pad(remaining.seconds), label: "SEC" },
    ];
    const cellW = 130;
    const cellH = 110;
    const gap = 16;
    const total = cells.length * cellW + (cells.length - 1) * gap;
    const startX = (W - total) / 2;
    const startY = (H - cellH) / 2 + 18;
    body = cells
      .map((c, i) => {
        const x = startX + i * (cellW + gap);
        return `
          <g transform="translate(${x} ${startY})">
            <rect x="3" y="4" width="${cellW}" height="${cellH}" fill="${palette.shadow}" rx="14"/>
            <rect x="0" y="0" width="${cellW}" height="${cellH}" fill="${palette.card}" stroke="${palette.stroke}" stroke-width="3" rx="14"/>
            <line x1="0" y1="${cellH / 2}" x2="${cellW}" y2="${cellH / 2}" stroke="${palette.stroke}" stroke-width="1" opacity="0.18"/>
            <text x="${cellW / 2}" y="${cellH / 2 - 8}" text-anchor="middle" font-family="Fredoka,Quicksand,sans-serif" font-weight="700" font-size="56" fill="${palette.digit}">${c.value}</text>
            <text x="${cellW / 2}" y="${cellH - 16}" text-anchor="middle" font-family="Fredoka,Quicksand,sans-serif" font-weight="700" font-size="13" fill="${palette.accent}" letter-spacing="2">${c.label}</text>
          </g>
        `;
      })
      .join("");
  }

  // Pulse ring animation while running.
  const animatedAccents =
    !remaining || remaining.finished
      ? ""
      : `
    <circle cx="40" cy="40" r="14" fill="${palette.accent}" opacity="0.55">
      <animate attributeName="r" values="14;22;14" dur="1.4s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.55;0.05;0.55" dur="1.4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="40" cy="40" r="9" fill="${palette.accent}" stroke="${palette.stroke}" stroke-width="2"/>
  `;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${palette.bgFrom}"/>
        <stop offset="100%" stop-color="${palette.bgTo}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    ${animatedAccents}
    <text x="74" y="46" font-family="Fredoka,Quicksand,sans-serif" font-weight="700" font-size="14" fill="${palette.accent}" letter-spacing="2.5">${esc(label.toUpperCase())}</text>
    ${body}
  </svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // Aggressive no-cache so Gmail/Yahoo proxies refetch on each open.
      "cache-control":
        "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0",
      pragma: "no-cache",
      expires: "0",
    },
  });
}
