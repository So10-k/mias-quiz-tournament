"use server";

// Host actions for /host/workflows. Author-only. Run = side-effects.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import {
  executeWorkflow,
  executeWorkflowDeferred,
  findWorkflow,
} from "@/lib/workflows";

async function requireAuthor() {
  const u = await requireUser();
  if (u.role !== "author") throw new Error("forbidden — author only");
  return u;
}

// Dashboard launcher — fires the workflow AFTER the HTTP response so
// the browser sees the running row instantly. Used by the popup
// launcher on /host/workflows.
export async function initiateWorkflowAction(formData: FormData) {
  const me = await requireAuthor();
  const id = String(formData.get("workflowId") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const def = findWorkflow(id);
  if (!def) throw new Error("unknown workflow");
  if (confirm !== "RUN") {
    throw new Error(`Type RUN to confirm — ${def.sideEffects}`);
  }
  const fromPopup = formData.get("popupOrigin") === "1";
  await executeWorkflowDeferred({
    workflowId: id,
    triggeredByUserId: me.id,
  });
  revalidatePath("/host/workflows");
  revalidatePath(`/host/workflows/${id}`);
  // From the OS popup window, land on /launch/done which closes the
  // popup + reloads the parent. From the inline dashboard, redirect
  // back to /host/workflows.
  redirect(
    fromPopup ? "/host/workflows/launch/done" : "/host/workflows"
  );
}

// Detail-page launcher — blocking. Redirects to the run detail when
// the workflow finishes. Kept for direct deep-link runs.
export async function runWorkflowAction(formData: FormData) {
  const me = await requireAuthor();
  const id = String(formData.get("workflowId") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const def = findWorkflow(id);
  if (!def) throw new Error("unknown workflow");
  if (confirm !== "RUN") {
    throw new Error(
      `Type RUN to confirm — this workflow has side effects (${def.sideEffects}).`
    );
  }
  const { runId } = await executeWorkflow({
    workflowId: id,
    triggeredByUserId: me.id,
  });
  revalidatePath("/host/workflows");
  revalidatePath(`/host/workflows/${id}`);
  redirect(`/host/workflows/${id}/runs/${runId}`);
}
