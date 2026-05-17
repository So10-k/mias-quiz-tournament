// PDF export for finalized writing-session scripts. Four variants:
//
//   • personal-mia        — only Mia's lines, each preceded by the
//                           line that comes immediately before it
//                           (so she has cue context).
//   • personal-juliette   — same shape for Juliette.
//   • lines-only          — every line, no cues. Used by hosts during
//                           dress rehearsal.
//   • master              — every line + cues + part descriptions.
//                           Sam's director copy.
//
// Built with pdfkit (already in deps). Returns a Buffer that the
// route handler streams back to the browser.

import PDFDocument from "pdfkit";
import type {
  ScriptWithBody,
  WritingScriptLine,
} from "@/lib/writing-session";

export type PdfVariant =
  | "personal-mia"
  | "personal-juliette"
  | "lines-only"
  | "master";

const NAVY = "#1B2A4E";
const CORAL = "#C9296A";
const SUN = "#FFD93D";
const PAPER = "#FFFCF1";

function characterLabel(c: WritingScriptLine["character"]): string {
  switch (c) {
    case "mia":
      return "MIA";
    case "juliette":
      return "JULIETTE";
    case "sam":
      return "SAM";
    case "host":
      return "HOST";
    case "cohost":
      return "COHOST";
    case "narrator":
      return "VO";
    case "both":
      return "BOTH";
  }
}

function speakerOf(line: WritingScriptLine): "mia" | "juliette" | "other" {
  if (line.assignedTo === "mia") return "mia";
  if (line.assignedTo === "juliette") return "juliette";
  if (line.character === "mia") return "mia";
  if (line.character === "juliette") return "juliette";
  return "other";
}

export async function renderScriptPdf(args: {
  body: ScriptWithBody;
  variant: PdfVariant;
}): Promise<Buffer> {
  const { body, variant } = args;
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 64, bottom: 64, left: 64, right: 64 },
    info: {
      Title: titleForVariant(body.script.title, variant),
      Author: "Mia's Quiz Tournament",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const finished = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  drawCover(doc, body, variant);
  doc.addPage();

  if (variant === "master" || variant === "lines-only") {
    drawFullScript(doc, body, variant);
  } else {
    const focus: "mia" | "juliette" =
      variant === "personal-mia" ? "mia" : "juliette";
    drawPersonalScript(doc, body, focus);
  }

  doc.end();
  return finished;
}

// ─── cover ────────────────────────────────────────────────────────────

function drawCover(
  doc: PDFKit.PDFDocument,
  body: ScriptWithBody,
  variant: PdfVariant
) {
  // Solid coral block at top.
  doc.rect(0, 0, doc.page.width, 200).fill(NAVY);
  doc.fillColor("#FFFFFF");
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("MIA'S QUIZ TOURNAMENT · LIVE FINALS", 64, 50, {
      characterSpacing: 4,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(34)
    .fillColor(SUN)
    .text(body.script.title, 64, 78, { width: doc.page.width - 128 });
  doc
    .font("Helvetica")
    .fontSize(13)
    .fillColor("#FFFFFF")
    .text(subtitleForVariant(variant), 64, 152);

  // Body.
  doc.fillColor(NAVY);
  doc.moveDown(8);

  doc.font("Helvetica-Bold").fontSize(15).fillColor(CORAL);
  doc.text("Contents", 64, 240);

  doc.font("Helvetica").fontSize(12).fillColor(NAVY);
  let y = 268;
  body.parts.forEach(({ part }, i) => {
    if (y > doc.page.height - 100) return;
    doc.text(`${i + 1}.  ${part.title}`, 64, y, {
      width: doc.page.width - 128,
    });
    y += 22;
  });

  doc
    .font("Helvetica-Oblique")
    .fontSize(9)
    .fillColor("#666666")
    .text(
      `Status: ${body.script.status}   ·   Generated for ${variantHumanLabel(variant)}   ·   ${new Date().toISOString().slice(0, 10)}`,
      64,
      doc.page.height - 80
    );
}

function titleForVariant(scriptTitle: string, v: PdfVariant): string {
  return `${scriptTitle} — ${variantHumanLabel(v)}`;
}
function subtitleForVariant(v: PdfVariant): string {
  switch (v) {
    case "personal-mia":
      return "Mia's lines · with the line before each for cue context";
    case "personal-juliette":
      return "Juliette's lines · with the line before each for cue context";
    case "lines-only":
      return "Comprehensive lines — no cues. Dress-rehearsal copy.";
    case "master":
      return "Director's master script — lines + cues + part descriptions.";
  }
}
function variantHumanLabel(v: PdfVariant): string {
  switch (v) {
    case "personal-mia":
      return "Mia";
    case "personal-juliette":
      return "Juliette";
    case "lines-only":
      return "lines-only";
    case "master":
      return "master";
  }
}

// ─── full script (lines-only / master) ────────────────────────────────

function drawFullScript(
  doc: PDFKit.PDFDocument,
  body: ScriptWithBody,
  variant: "master" | "lines-only"
) {
  body.parts.forEach(({ part, lines }, partIndex) => {
    if (partIndex > 0) doc.moveDown(1);
    drawPartHeading(doc, partIndex + 1, part.title);
    if (variant === "master" && part.description) {
      doc
        .font("Helvetica-Oblique")
        .fontSize(10)
        .fillColor("#666666")
        .text(part.description, { paragraphGap: 6 });
      doc.fillColor(NAVY);
    }
    doc.moveDown(0.4);
    for (const line of lines) {
      drawLine(doc, line, variant);
    }
  });
}

// ─── personal scripts ─────────────────────────────────────────────────

function drawPersonalScript(
  doc: PDFKit.PDFDocument,
  body: ScriptWithBody,
  focus: "mia" | "juliette"
) {
  body.parts.forEach(({ part, lines }, partIndex) => {
    // Find this part's focused lines.
    const matches: Array<{ index: number; line: WritingScriptLine }> = [];
    lines.forEach((line, i) => {
      if (speakerOf(line) === focus) matches.push({ index: i, line });
    });
    if (matches.length === 0) return;

    if (partIndex > 0) doc.moveDown(1);
    drawPartHeading(doc, partIndex + 1, part.title);
    doc.moveDown(0.4);

    for (const { index, line } of matches) {
      // Cue line: render the previous line (if any) as a dim
      // "previous-line" pre-roll so the speaker knows what to listen
      // for.
      const prev = index > 0 ? lines[index - 1] : null;
      if (prev) {
        doc
          .font("Helvetica-Oblique")
          .fontSize(10)
          .fillColor("#888888")
          .text(`(${characterLabel(prev.character)} just said)`, {
            paragraphGap: 1,
          });
        doc
          .font("Helvetica-Oblique")
          .fontSize(11)
          .fillColor("#666666")
          .text(prev.text, { indent: 14, paragraphGap: 6 });
      }
      // The focused line — highlighted.
      drawLine(doc, line, "master", true);
      doc.moveDown(0.4);
    }
  });
}

// ─── primitives ───────────────────────────────────────────────────────

function drawPartHeading(
  doc: PDFKit.PDFDocument,
  number: number,
  title: string
) {
  if (doc.y > doc.page.height - 140) doc.addPage();
  const top = doc.y;
  doc.fillColor(SUN).rect(64, top - 4, 36, 28).fill();
  doc
    .fillColor(NAVY)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(String(number), 64, top, { width: 36, align: "center" });
  doc
    .fillColor(NAVY)
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(title.toUpperCase(), 110, top - 2, {
      width: doc.page.width - 174,
    });
  doc.moveDown(0.4);
}

function drawLine(
  doc: PDFKit.PDFDocument,
  line: WritingScriptLine,
  variant: "master" | "lines-only",
  highlight = false
) {
  // Speaker tag.
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(highlight ? CORAL : NAVY)
    .text(characterLabel(line.character), { continued: false });
  // Spoken line.
  doc
    .font("Helvetica")
    .fontSize(13)
    .fillColor(NAVY)
    .text(line.text, { indent: 14, paragraphGap: 6 });
  // Cue (only on master).
  if (variant === "master" && line.cue) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(10)
      .fillColor("#888888")
      .text(`cue: ${line.cue}`, { indent: 14, paragraphGap: 8 });
    doc.fillColor(NAVY);
  }
}
