// PDF renderer for a stored workflow run. Pure consumer of
// result_json — never touches the DB, so PDFs stay consistent even
// if the source data changes after the run.

import PDFDocument from "pdfkit";
import type {
  WorkflowDef,
  WorkflowResult,
  WorkflowTargetResult,
} from "@/lib/workflows/types";

const NAVY = "#1B2A4E";
const CORAL = "#C9296A";
const SUN = "#FFD93D";
const GRASS = "#5BCE7A";
const ORANGE = "#FF8C42";

const SEV_COLOR = {
  ok: GRASS,
  warn: ORANGE,
  fail: CORAL,
} as const;

const SEV_GLYPH = { ok: "✓", warn: "!", fail: "✗" } as const;

export async function renderWorkflowRunPdf(args: {
  def: WorkflowDef;
  startedAt: Date;
  completedAt: Date | null;
  triggeredByName: string | null;
  result: WorkflowResult;
}): Promise<Buffer> {
  const { def, result } = args;
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 64, bottom: 64, left: 64, right: 64 },
    info: {
      Title: `${def.name} — workflow report`,
      Author: "Mia's Quiz Tournament",
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const finished = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  drawCover(doc, args);
  doc.addPage();
  drawSummary(doc, result);
  for (const target of result.targets) {
    doc.addPage();
    drawTarget(doc, target);
  }

  doc.end();
  return finished;
}

function drawCover(
  doc: PDFKit.PDFDocument,
  args: {
    def: WorkflowDef;
    startedAt: Date;
    completedAt: Date | null;
    triggeredByName: string | null;
    result: WorkflowResult;
  }
) {
  doc.rect(0, 0, doc.page.width, 220).fill(NAVY);
  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("MIA'S QUIZ TOURNAMENT · WORKFLOW REPORT", 64, 50, {
      characterSpacing: 4,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(34)
    .fillColor(SUN)
    .text(`${args.def.emoji}  ${args.def.name}`, 64, 78, {
      width: doc.page.width - 128,
    });
  doc
    .font("Helvetica")
    .fontSize(13)
    .fillColor("#FFFFFF")
    .text(args.def.description, 64, 156, { width: doc.page.width - 128 });

  // Headline summary card.
  doc.fillColor(NAVY);
  doc
    .roundedRect(64, 260, doc.page.width - 128, 130, 16)
    .fillAndStroke(args.result.ok ? "#E8F8EC" : "#FFE8EE", NAVY);
  doc
    .fillColor(args.result.ok ? "#2E7D32" : CORAL)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(args.result.ok ? "STATUS · OK" : "STATUS · ACTION NEEDED", 84, 280, {
      characterSpacing: 4,
    });
  doc
    .fillColor(NAVY)
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(args.result.summary, 84, 304, { width: doc.page.width - 168 });
  doc
    .fillColor("#3B4A7E")
    .font("Helvetica")
    .fontSize(11)
    .text(
      [
        `Run started: ${args.startedAt.toISOString().replace("T", " ").slice(0, 19)} UTC`,
        args.completedAt
          ? `Completed:   ${args.completedAt.toISOString().replace("T", " ").slice(0, 19)} UTC`
          : "Completed:   (still running)",
        args.triggeredByName ? `Triggered by: ${args.triggeredByName}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      84,
      346
    );

  // Effects log.
  doc
    .fillColor(NAVY)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("Side effects", 64, 420);
  doc.font("Helvetica").fontSize(11).fillColor(NAVY);
  let y = 444;
  for (const e of args.result.effects.length
    ? args.result.effects
    : ["(none)"]) {
    doc.text(`• ${e}`, 64, y, { width: doc.page.width - 128 });
    y += 18;
  }
}

function drawSummary(doc: PDFKit.PDFDocument, result: WorkflowResult) {
  doc
    .fillColor(NAVY)
    .font("Helvetica-Bold")
    .fontSize(22)
    .text("At-a-glance", 64, 64);
  doc
    .fillColor("#666666")
    .font("Helvetica")
    .fontSize(11)
    .text("One row per target. Severity is the worst-of across that target's checks.", 64, 92);

  // Table header.
  let y = 130;
  doc
    .fillColor(NAVY)
    .font("Helvetica-Bold")
    .fontSize(10);
  doc.text("STATUS", 64, y, { characterSpacing: 2 });
  doc.text("TARGET", 160, y, { characterSpacing: 2 });
  doc.text("CONTACT", 340, y, { characterSpacing: 2 });
  doc.text("TASKS LEFT", 500, y, { characterSpacing: 2 });
  y += 20;
  doc
    .moveTo(64, y - 6)
    .lineTo(doc.page.width - 64, y - 6)
    .strokeColor(NAVY)
    .lineWidth(1)
    .stroke();

  doc.font("Helvetica").fontSize(11);
  for (const t of result.targets) {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 64;
    }
    const color = SEV_COLOR[t.status];
    doc
      .roundedRect(64, y - 2, 80, 22, 11)
      .fillAndStroke(color, NAVY);
    doc
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(t.status.toUpperCase(), 64, y + 4, { width: 80, align: "center" });
    doc.fillColor(NAVY).font("Helvetica").fontSize(11);
    doc.text(t.name, 160, y + 4, { width: 175, ellipsis: true });
    doc.text(t.contact ?? "—", 340, y + 4, { width: 155, ellipsis: true });
    doc
      .fillColor(t.tasksRemaining > 0 ? CORAL : "#3B4A7E")
      .font("Helvetica-Bold")
      .text(`${t.tasksRemaining}`, 500, y + 4);
    doc.fillColor(NAVY).font("Helvetica");
    y += 32;
  }
}

function drawTarget(doc: PDFKit.PDFDocument, t: WorkflowTargetResult) {
  // Header strip per target.
  const color = SEV_COLOR[t.status];
  doc.rect(0, 0, doc.page.width, 96).fill(color);
  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(t.status.toUpperCase(), 64, 28, { characterSpacing: 4 });
  doc
    .font("Helvetica-Bold")
    .fontSize(26)
    .fillColor("#FFFFFF")
    .text(t.name, 64, 46, { width: doc.page.width - 128 });

  doc.fillColor(NAVY);

  // Contact + emails.
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#3B4A7E")
    .text(
      [
        t.contact ? `Contact: ${t.contact}` : "",
        t.emailSent
          ? "✉️ Personalized reminder email sent during this run."
          : t.tasksRemaining === 0
            ? "No email sent — checklist is fully green."
            : "Email not sent (no reachable address or send error).",
      ]
        .filter(Boolean)
        .join("\n"),
      64,
      120
    );

  // Per-check list.
  let y = 180;
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(14).text("Checklist", 64, y);
  y += 24;
  for (const c of t.checks) {
    if (y > doc.page.height - 110) {
      doc.addPage();
      y = 64;
    }
    const c1 = SEV_COLOR[c.severity];
    // Status pill.
    doc.roundedRect(64, y, 22, 22, 11).fillAndStroke(c1, NAVY);
    doc
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(SEV_GLYPH[c.severity], 64, y + 4, { width: 22, align: "center" });
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(13).text(c.label, 96, y + 3);
    y += 24;
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#444444")
      .text(c.detail, 96, y, { width: doc.page.width - 160 });
    y += 18;
    if (c.remedy) {
      doc
        .font("Helvetica-Oblique")
        .fontSize(11)
        .fillColor(CORAL)
        .text(`→ ${c.remedy}`, 96, y, { width: doc.page.width - 160 });
      y += 22;
    } else {
      y += 4;
    }
  }
}
