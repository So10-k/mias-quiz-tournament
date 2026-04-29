// Server-side renderer that turns a bracket into an SVG diagram suitable
// for embedding in emails (and for previewing in the host UI). Uses inline
// SVG primitives only — no external assets, no fonts beyond what the email
// client provides.
//
// Layout: each round is a column. Within a column, matchups stack vertically
// with spacing scaled to the round depth so each round's cards line up
// roughly with the midpoint of the next round's card. Connector elbows are
// drawn between successive rounds.

import type { BracketRound, Matchup } from "./bracket";

type UserInfo = { name: string | null; email: string | null };

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function labelFor(id: string | null, users: Map<string, UserInfo>): string {
  if (!id) return "—";
  const u = users.get(id);
  return u?.name ?? u?.email ?? "—";
}

function roundLabel(roundIndex: number, total: number): string {
  if (roundIndex === total) return "Final";
  if (roundIndex === total - 1) return "Semi";
  if (roundIndex === total - 2) return "Quarter";
  return `Round ${roundIndex}`;
}

export function renderBracketSvg(
  rounds: BracketRound[],
  users: Map<string, UserInfo>,
  championId: string | null
): string {
  if (rounds.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="600" height="200"><rect width="100%" height="100%" fill="#B7E5FF"/><text x="300" y="100" text-anchor="middle" font-family="Fredoka,Quicksand,sans-serif" font-size="20" font-weight="700" fill="#1B2A4E">No bracket yet — generate one in /host first.</text></svg>`;
  }

  // Sort rounds by index just in case the caller didn't.
  const ordered = [...rounds].sort((a, b) => a.roundIndex - b.roundIndex);
  const numRounds = ordered.length;

  // Geometry. Sized to look good at email widths (~600px) but the SVG scales
  // freely thanks to viewBox.
  const PAD = 20;
  const HEADER_H = 36;
  const COL_W = 180;
  const COL_GAP = 32;
  const CARD_W = COL_W;
  const CARD_H = 64;
  const MAX_MATCHES = Math.max(...ordered.map((r) => r.matchups.length));
  const ROW_H = CARD_H + 18;
  const innerH = MAX_MATCHES * ROW_H;
  const totalW = PAD * 2 + numRounds * COL_W + (numRounds - 1) * COL_GAP;
  const totalH = PAD + HEADER_H + innerH + PAD;

  // Per-round vertical layout — each matchup centred so the column's
  // midpoint aligns across rounds (gives the bracket its spreading shape).
  const matchY = (roundIdx: number, matchIdx: number): number => {
    const matchesInRound = ordered[roundIdx].matchups.length;
    const usableH = innerH;
    const slotH = usableH / matchesInRound;
    return PAD + HEADER_H + matchIdx * slotH + (slotH - CARD_H) / 2;
  };

  const colX = (roundIdx: number): number => PAD + roundIdx * (COL_W + COL_GAP);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" style="display:block;max-width:100%;height:auto;">`
  );
  // Subtle sky background + a slow-rotating sun in the corner. SMIL
  // animations on standalone SVGs render in Apple Mail / Gmail / iCloud /
  // iOS — Outlook desktop falls back to the still frame, which still looks
  // fine.
  parts.push(
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#B7E5FF"/><stop offset="100%" stop-color="#87CEEB"/></linearGradient></defs>`
  );
  parts.push(`<rect width="100%" height="100%" fill="url(#sky)"/>`);
  // Decorative spinning sun in the top-right.
  const sunCx = totalW - 56;
  const sunCy = 50;
  parts.push(
    `<g opacity="0.85"><g transform="translate(${sunCx} ${sunCy})">` +
      `<animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="60s" repeatCount="indefinite" additive="sum"/>` +
      `<g stroke="#1B2A4E" stroke-width="2" stroke-linecap="round">` +
      Array.from({ length: 12 })
        .map((_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          return `<line x1="${(Math.cos(a) * 26).toFixed(1)}" y1="${(
            Math.sin(a) * 26
          ).toFixed(1)}" x2="${(Math.cos(a) * 36).toFixed(1)}" y2="${(
            Math.sin(a) * 36
          ).toFixed(1)}"/>`;
        })
        .join("") +
      `</g><circle cx="0" cy="0" r="22" fill="#FFD93D" stroke="#1B2A4E" stroke-width="2"/>` +
      `<circle cx="-7" cy="-3" r="2" fill="#1B2A4E"/><circle cx="7" cy="-3" r="2" fill="#1B2A4E"/>` +
      `<path d="M-7 6 Q0 12 7 6" fill="none" stroke="#1B2A4E" stroke-width="2" stroke-linecap="round"/>` +
      `</g></g>`
  );
  // Floating sparkles that pulse — pure SMIL.
  const sparkles = [
    { x: 60, y: 70, delay: 0 },
    { x: totalW - 140, y: totalH - 60, delay: 1.4 },
    { x: 120, y: totalH - 80, delay: 0.7 },
  ];
  for (const sp of sparkles) {
    parts.push(
      `<g transform="translate(${sp.x} ${sp.y})" opacity="0.7"><path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z" fill="#FFFFFF" stroke="#1B2A4E" stroke-width="1"><animate attributeName="opacity" values="0.2;1;0.2" dur="2.6s" begin="${sp.delay}s" repeatCount="indefinite"/></path></g>`
    );
  }

  // Connector elbows behind everything else.
  for (let r = 0; r < numRounds - 1; r++) {
    const round = ordered[r];
    const next = ordered[r + 1];
    for (let i = 0; i < round.matchups.length; i++) {
      const sourceX = colX(r) + CARD_W;
      const sourceY = matchY(r, i) + CARD_H / 2;
      const nextSlot = Math.floor(i / 2);
      if (nextSlot >= next.matchups.length) continue;
      const targetX = colX(r + 1);
      const targetY = matchY(r + 1, nextSlot) + CARD_H / 2;
      const midX = sourceX + COL_GAP / 2;
      parts.push(
        `<path d="M${sourceX} ${sourceY} H${midX} V${targetY} H${targetX}" fill="none" stroke="#1B2A4E" stroke-width="2" stroke-linecap="round" opacity="0.55"/>`
      );
    }
  }

  // Round headers (sun-yellow pills).
  for (let r = 0; r < numRounds; r++) {
    const x = colX(r);
    const y = PAD;
    parts.push(
      `<rect x="${x}" y="${y}" width="${CARD_W}" height="${HEADER_H - 8}" fill="#FFD93D" stroke="#1B2A4E" stroke-width="3" rx="14"/>`
    );
    parts.push(
      `<text x="${x + CARD_W / 2}" y="${
        y + HEADER_H / 2
      }" text-anchor="middle" font-family="Fredoka,Quicksand,sans-serif" font-weight="700" font-size="14" fill="#1B2A4E">${esc(
        roundLabel(ordered[r].roundIndex, numRounds)
      )}</text>`
    );
  }

  // Matchup cards.
  for (let r = 0; r < numRounds; r++) {
    const round = ordered[r];
    for (let i = 0; i < round.matchups.length; i++) {
      const m: Matchup = round.matchups[i];
      const x = colX(r);
      const y = matchY(r, i);
      const aLabel = labelFor(m.playerAUserId, users);
      const bLabel = labelFor(m.playerBUserId, users);
      const aWon = !!m.winnerUserId && m.winnerUserId === m.playerAUserId;
      const bWon = !!m.winnerUserId && m.winnerUserId === m.playerBUserId;
      const aLost = !!m.winnerUserId && !aWon;
      const bLost = !!m.winnerUserId && !bWon;

      // Card shadow + body
      parts.push(
        `<rect x="${x + 3}" y="${y + 3}" width="${CARD_W}" height="${CARD_H}" fill="#1B2A4E" rx="12"/>`
      );
      parts.push(
        `<rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" fill="white" stroke="#1B2A4E" stroke-width="2.5" rx="12"/>`
      );

      // Player A row
      const aFill = aWon ? "#7DD87D" : aLost ? "#F4F6FB" : "white";
      const aColor = aWon ? "white" : aLost ? "#9AA4BD" : "#1B2A4E";
      parts.push(
        `<rect x="${x + 3}" y="${y + 3}" width="${CARD_W - 6}" height="${
          CARD_H / 2 - 4
        }" fill="${aFill}" rx="9"/>`
      );
      parts.push(
        `<text x="${x + 12}" y="${
          y + CARD_H / 2 - 6
        }" font-family="Quicksand,sans-serif" font-weight="${
          aWon ? 700 : 600
        }" font-size="14" fill="${aColor}"${
          aLost ? ' text-decoration="line-through"' : ""
        }>${esc(truncate(aLabel, 22))}</text>`
      );

      // Divider
      parts.push(
        `<line x1="${x + 6}" y1="${y + CARD_H / 2}" x2="${
          x + CARD_W - 6
        }" y2="${y + CARD_H / 2}" stroke="#1B2A4E" stroke-width="1.2" stroke-dasharray="2 3" opacity="0.5"/>`
      );

      // Player B row
      const bFill = bWon ? "#7DD87D" : bLost ? "#F4F6FB" : "white";
      const bColor = bWon ? "white" : bLost ? "#9AA4BD" : "#1B2A4E";
      parts.push(
        `<rect x="${x + 3}" y="${y + CARD_H / 2 + 1}" width="${
          CARD_W - 6
        }" height="${CARD_H / 2 - 4}" fill="${bFill}" rx="9"/>`
      );
      parts.push(
        `<text x="${x + 12}" y="${
          y + CARD_H - 12
        }" font-family="Quicksand,sans-serif" font-weight="${
          bWon ? 700 : 600
        }" font-size="14" fill="${bColor}"${
          bLost ? ' text-decoration="line-through"' : ""
        }>${esc(truncate(bLabel, 22))}</text>`
      );

      // Final-round champion crown — bobs gently if the email client
      // supports SMIL.
      if (r === numRounds - 1 && championId && m.winnerUserId === championId) {
        parts.push(
          `<g><text x="${x + CARD_W / 2}" y="${
            y - 6
          }" text-anchor="middle" font-size="22">👑<animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="1.6s" repeatCount="indefinite"/></text></g>`
        );
      }
    }
  }

  parts.push(`</svg>`);
  return parts.join("");
}
