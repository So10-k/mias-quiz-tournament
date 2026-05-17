"use server";

// Host-only Server Actions for /host/writing-session.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import {
  addLine,
  advanceScriptStatus,
  assignLine,
  createScriptFromAI,
  createScriptFromFinalsTemplate,
  deleteLine,
  editLine,
  generatePin,
  revokePin,
  updateScriptMeta,
  type Phase,
  type Helper,
} from "@/lib/writing-session";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") throw new Error("forbidden — host only");
  return u;
}

const PHASES = new Set<Phase>(["draft", "delegating", "editing", "finalized"]);

export async function createScriptAction(formData: FormData) {
  const me = await requireHost();
  const title = String(formData.get("title") ?? "").trim() || "Finals Script";
  const brief = String(formData.get("brief") ?? "").trim();
  const id = await createScriptFromAI({
    title,
    brief,
    createdByUserId: me.id,
  });
  revalidatePath("/host/writing-session");
  redirect(`/host/writing-session/${id}`);
}

export async function createFromFinalsTemplateAction() {
  const me = await requireHost();
  const id = await createScriptFromFinalsTemplate({ createdByUserId: me.id });
  revalidatePath("/host/writing-session");
  redirect(`/host/writing-session/${id}`);
}

export async function updateMetaAction(formData: FormData) {
  await requireHost();
  const scriptId = String(formData.get("scriptId") ?? "");
  const title = String(formData.get("title") ?? "");
  const brief = String(formData.get("brief") ?? "");
  await updateScriptMeta({ scriptId, title, brief });
  revalidatePath(`/host/writing-session/${scriptId}`);
}

export async function advancePhaseAction(formData: FormData) {
  await requireHost();
  const scriptId = String(formData.get("scriptId") ?? "");
  const to = String(formData.get("to") ?? "");
  if (!PHASES.has(to as Phase)) throw new Error("bad phase");
  await advanceScriptStatus({ scriptId, to: to as Phase });
  revalidatePath(`/host/writing-session/${scriptId}`);
  revalidatePath("/host/writing-session");
}

export async function editLineHostAction(formData: FormData) {
  await requireHost();
  const scriptId = String(formData.get("scriptId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  const text = String(formData.get("text") ?? "");
  const cueRaw = String(formData.get("cue") ?? "");
  await editLine({
    lineId,
    text,
    cue: cueRaw.trim() ? cueRaw : null,
    editedBy: "sam",
  });
  revalidatePath(`/host/writing-session/${scriptId}`);
}

export async function assignLineHostAction(formData: FormData) {
  await requireHost();
  const scriptId = String(formData.get("scriptId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  const to = String(formData.get("assignedTo") ?? "");
  const assigned: Helper | null =
    to === "mia" || to === "juliette" ? (to as Helper) : null;
  await assignLine({ lineId, assignedTo: assigned, editedBy: "sam" });
  revalidatePath(`/host/writing-session/${scriptId}`);
}

export async function addLineHostAction(formData: FormData) {
  await requireHost();
  const scriptId = String(formData.get("scriptId") ?? "");
  const partId = String(formData.get("partId") ?? "");
  const afterOrder = Number(formData.get("afterOrder") ?? "0");
  const character = String(formData.get("character") ?? "host") as
    | "host"
    | "cohost"
    | "sam"
    | "mia"
    | "juliette"
    | "narrator"
    | "both";
  const text = String(formData.get("text") ?? "").trim() || "(new line)";
  await addLine({
    partId,
    afterOrder: Math.max(0, afterOrder),
    character,
    text,
    editedBy: "sam",
  });
  revalidatePath(`/host/writing-session/${scriptId}`);
}

export async function deleteLineHostAction(formData: FormData) {
  await requireHost();
  const scriptId = String(formData.get("scriptId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  await deleteLine(lineId);
  revalidatePath(`/host/writing-session/${scriptId}`);
}

export async function generatePinAction(formData: FormData) {
  await requireHost();
  const scriptId = String(formData.get("scriptId") ?? "");
  const forPersonRaw = String(formData.get("forPerson") ?? "");
  if (forPersonRaw !== "mia" && forPersonRaw !== "juliette") {
    throw new Error("forPerson must be mia or juliette");
  }
  await generatePin({
    scriptId,
    forPerson: forPersonRaw,
    ttlHours: 72,
  });
  revalidatePath(`/host/writing-session/${scriptId}`);
}

export async function revokePinAction(formData: FormData) {
  await requireHost();
  const scriptId = String(formData.get("scriptId") ?? "");
  const pinId = String(formData.get("pinId") ?? "");
  await revokePin(pinId);
  revalidatePath(`/host/writing-session/${scriptId}`);
}
