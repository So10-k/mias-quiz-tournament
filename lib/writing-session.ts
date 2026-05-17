// Server-side queries + mutations for "The Writing Session" feature.
// Everything that touches writing_scripts / writing_script_parts /
// writing_script_lines / writing_script_pins lives here so the host
// dashboard and the PIN-gated public page share one implementation.

import { db, schema } from "@/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { id as makeId } from "@/lib/ids";
import {
  generateScript,
  type GeneratedScript,
} from "@/lib/writing-script-generator";
import { FINALS_TEMPLATE } from "@/lib/writing-script-template";

export type WritingScript = typeof schema.writingScripts.$inferSelect;
export type WritingScriptPart = typeof schema.writingScriptParts.$inferSelect;
export type WritingScriptLine = typeof schema.writingScriptLines.$inferSelect;
export type WritingScriptPin = typeof schema.writingScriptPins.$inferSelect;

export type Helper = "mia" | "juliette";
export type Phase = WritingScript["status"];

export type ScriptWithBody = {
  script: WritingScript;
  parts: Array<{
    part: WritingScriptPart;
    lines: WritingScriptLine[];
  }>;
};

// ─── reads ────────────────────────────────────────────────────────────

export async function listScripts(): Promise<WritingScript[]> {
  return db
    .select()
    .from(schema.writingScripts)
    .orderBy(sql`${schema.writingScripts.updatedAt} DESC`);
}

export async function getScript(scriptId: string): Promise<ScriptWithBody | null> {
  const [script] = await db
    .select()
    .from(schema.writingScripts)
    .where(eq(schema.writingScripts.id, scriptId))
    .limit(1);
  if (!script) return null;
  const parts = await db
    .select()
    .from(schema.writingScriptParts)
    .where(eq(schema.writingScriptParts.scriptId, scriptId))
    .orderBy(asc(schema.writingScriptParts.order));
  const partIds = parts.map((p) => p.id);
  const allLines = partIds.length
    ? await db
        .select()
        .from(schema.writingScriptLines)
        .orderBy(asc(schema.writingScriptLines.order))
    : [];
  const linesByPart = new Map<string, WritingScriptLine[]>();
  for (const l of allLines) {
    const arr = linesByPart.get(l.partId) ?? [];
    arr.push(l);
    linesByPart.set(l.partId, arr);
  }
  return {
    script,
    parts: parts.map((part) => ({
      part,
      lines: (linesByPart.get(part.id) ?? []).sort(
        (a, b) => a.order - b.order
      ),
    })),
  };
}

export async function getScriptPins(
  scriptId: string
): Promise<WritingScriptPin[]> {
  return db
    .select()
    .from(schema.writingScriptPins)
    .where(eq(schema.writingScriptPins.scriptId, scriptId))
    .orderBy(asc(schema.writingScriptPins.createdAt));
}

export async function resolvePin(
  pin: string
): Promise<{ script: WritingScript; pin: WritingScriptPin } | null> {
  if (!/^\d{4}$/.test(pin)) return null;
  const [row] = await db
    .select()
    .from(schema.writingScriptPins)
    .where(eq(schema.writingScriptPins.pin, pin))
    .limit(1);
  if (!row || row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  const [script] = await db
    .select()
    .from(schema.writingScripts)
    .where(eq(schema.writingScripts.id, row.scriptId))
    .limit(1);
  if (!script) return null;
  return { script, pin: row };
}

// ─── writes ───────────────────────────────────────────────────────────

// Persist a fully-formed GeneratedScript into the DB. Shared by the
// AI generator and the curated finals template.
async function insertScript(args: {
  title: string;
  brief: string;
  createdByUserId: string | null;
  body: GeneratedScript;
}): Promise<string> {
  const scriptId = makeId();
  await db.insert(schema.writingScripts).values({
    id: scriptId,
    title: args.title || args.body.title,
    brief: args.brief,
    status: "draft",
    createdByUserId: args.createdByUserId,
  });
  for (let pi = 0; pi < args.body.parts.length; pi++) {
    const gp = args.body.parts[pi];
    const partId = makeId();
    await db.insert(schema.writingScriptParts).values({
      id: partId,
      scriptId,
      order: pi,
      title: gp.title,
      description: gp.description ?? null,
    });
    for (let li = 0; li < gp.lines.length; li++) {
      const gl = gp.lines[li];
      await db.insert(schema.writingScriptLines).values({
        id: makeId(),
        partId,
        order: li,
        character: gl.character,
        text: gl.text,
        cue: gl.cue ?? null,
      });
    }
  }
  return scriptId;
}

export async function createScriptFromAI(args: {
  title: string;
  brief: string;
  createdByUserId: string | null;
}): Promise<string> {
  const body: GeneratedScript = await generateScript({ brief: args.brief });
  return insertScript({ ...args, body });
}

// Drop in the curated finals template — instant, deterministic, and
// already aware of the actual finalists + the 12 pre-produced ads.
export async function createScriptFromFinalsTemplate(args: {
  createdByUserId: string | null;
}): Promise<string> {
  return insertScript({
    title: FINALS_TEMPLATE.title,
    brief:
      "Hand-written finals template — wired to the runbook ads + the real finalist lineup. Edit anything before passing to Mia for delegation.",
    createdByUserId: args.createdByUserId,
    body: FINALS_TEMPLATE,
  });
}

export async function updateScriptMeta(args: {
  scriptId: string;
  title?: string;
  brief?: string;
}): Promise<void> {
  const patch: Partial<typeof schema.writingScripts.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (args.title !== undefined) patch.title = args.title;
  if (args.brief !== undefined) patch.brief = args.brief;
  await db
    .update(schema.writingScripts)
    .set(patch)
    .where(eq(schema.writingScripts.id, args.scriptId));
}

export async function advanceScriptStatus(args: {
  scriptId: string;
  to: Phase;
}): Promise<void> {
  const patch: Partial<typeof schema.writingScripts.$inferInsert> = {
    status: args.to,
    updatedAt: new Date(),
  };
  if (args.to === "finalized") patch.finalizedAt = new Date();
  await db
    .update(schema.writingScripts)
    .set(patch)
    .where(eq(schema.writingScripts.id, args.scriptId));
}

export async function editLine(args: {
  lineId: string;
  text?: string;
  cue?: string | null;
  character?: WritingScriptLine["character"];
  editedBy: string; // 'sam' | 'mia' | 'juliette'
}): Promise<void> {
  const patch: Partial<typeof schema.writingScriptLines.$inferInsert> = {
    lastEditedBy: args.editedBy,
    lastEditedAt: new Date(),
  };
  if (args.text !== undefined) patch.text = args.text;
  if (args.cue !== undefined) patch.cue = args.cue;
  if (args.character !== undefined) patch.character = args.character;
  await db
    .update(schema.writingScriptLines)
    .set(patch)
    .where(eq(schema.writingScriptLines.id, args.lineId));
}

export async function assignLine(args: {
  lineId: string;
  assignedTo: Helper | null;
  editedBy: string;
}): Promise<void> {
  await db
    .update(schema.writingScriptLines)
    .set({
      assignedTo: args.assignedTo,
      lastEditedBy: args.editedBy,
      lastEditedAt: new Date(),
    })
    .where(eq(schema.writingScriptLines.id, args.lineId));
}

export async function addLine(args: {
  partId: string;
  afterOrder: number;
  character: WritingScriptLine["character"];
  text: string;
  editedBy: string;
}): Promise<string> {
  // Bump existing lines below the insertion point.
  await db
    .update(schema.writingScriptLines)
    .set({ order: sql`${schema.writingScriptLines.order} + 1` })
    .where(
      and(
        eq(schema.writingScriptLines.partId, args.partId),
        sql`${schema.writingScriptLines.order} > ${args.afterOrder}`
      )
    );
  const lineId = makeId();
  await db.insert(schema.writingScriptLines).values({
    id: lineId,
    partId: args.partId,
    order: args.afterOrder + 1,
    character: args.character,
    text: args.text,
    lastEditedBy: args.editedBy,
    lastEditedAt: new Date(),
  });
  return lineId;
}

export async function deleteLine(lineId: string): Promise<void> {
  await db
    .delete(schema.writingScriptLines)
    .where(eq(schema.writingScriptLines.id, lineId));
}

// ─── PINs ─────────────────────────────────────────────────────────────

// Pick a fresh 4-digit string that isn't already used as an active PIN.
async function pickPin(): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const [exists] = await db
      .select()
      .from(schema.writingScriptPins)
      .where(eq(schema.writingScriptPins.pin, pin))
      .limit(1);
    if (!exists) return pin;
  }
  throw new Error("could not allocate a unique 4-digit PIN");
}

export async function generatePin(args: {
  scriptId: string;
  forPerson: Helper;
  ttlHours?: number;
}): Promise<string> {
  const pin = await pickPin();
  const expiresAt = args.ttlHours
    ? new Date(Date.now() + args.ttlHours * 3_600_000)
    : null;
  await db.insert(schema.writingScriptPins).values({
    id: makeId(),
    scriptId: args.scriptId,
    pin,
    forPerson: args.forPerson,
    expiresAt,
  });
  return pin;
}

export async function revokePin(pinId: string): Promise<void> {
  await db
    .update(schema.writingScriptPins)
    .set({ revokedAt: new Date() })
    .where(eq(schema.writingScriptPins.id, pinId));
}
