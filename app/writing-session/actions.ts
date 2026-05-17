"use server";

// PIN-authorized actions for the public writing-session pages. Every
// mutation re-resolves the PIN so a leaked or revoked PIN can't write.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assignLine,
  editLine,
  resolvePin,
  type Helper,
  type WritingScriptLine,
} from "@/lib/writing-session";

async function requirePin(pin: string) {
  const ok = await resolvePin(pin);
  if (!ok) throw new Error("invalid or expired PIN");
  return ok;
}

export async function submitPinAction(formData: FormData) {
  const pin = String(formData.get("pin") ?? "").trim();
  const ok = await resolvePin(pin);
  if (!ok) {
    redirect("/writing-session?bad=1");
  }
  redirect(`/writing-session/${pin}`);
}

export async function assignLineAction(formData: FormData) {
  const pin = String(formData.get("pin") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  const to = String(formData.get("assignedTo") ?? "");
  const auth = await requirePin(pin);
  if (auth.script.status !== "delegating") {
    throw new Error("can only assign lines during the delegation phase");
  }
  if (auth.pin.forPerson !== "mia") {
    throw new Error("only Mia's PIN can assign lines");
  }
  const assigned: Helper | null =
    to === "mia" || to === "juliette" ? (to as Helper) : null;
  await assignLine({
    lineId,
    assignedTo: assigned,
    editedBy: auth.pin.forPerson,
  });
  revalidatePath(`/writing-session/${pin}`);
}

export async function editLineAction(formData: FormData) {
  const pin = String(formData.get("pin") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  const text = String(formData.get("text") ?? "");
  const auth = await requirePin(pin);
  if (auth.script.status !== "editing") {
    throw new Error("can only edit during the editing phase");
  }
  // Mia + Juliette may only edit their assigned lines. Look up the
  // line first to enforce that.
  const { db, schema } = await import("@/db");
  const { eq } = await import("drizzle-orm");
  const [line] = await db
    .select()
    .from(schema.writingScriptLines)
    .where(eq(schema.writingScriptLines.id, lineId))
    .limit(1);
  if (!line) throw new Error("line not found");
  if (line.assignedTo !== auth.pin.forPerson) {
    throw new Error(
      `${auth.pin.forPerson} is not assigned this line — Mia can reassign it during delegation`
    );
  }
  await editLine({
    lineId,
    text,
    editedBy: auth.pin.forPerson,
  });
  revalidatePath(`/writing-session/${pin}`);
}
