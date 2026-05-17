"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { blockIp, unblockIp, setBlockMode } from "@/lib/blocks";
import { logHostAction } from "@/lib/discourse-staff-log";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") redirect("/play");
  return u;
}

const BlockInput = z.object({
  ip: z.string().min(2).max(64),
  reason: z.string().max(200).optional(),
});

export async function blockIpAction(formData: FormData) {
  const me = await requireHost();
  const parsed = BlockInput.safeParse({
    ip: String(formData.get("ip") ?? "").trim(),
    reason: String(formData.get("reason") ?? "").trim() || undefined,
  });
  if (!parsed.success) {
    redirect("/host/blocks?error=Invalid+IP");
  }
  await blockIp({
    ip: parsed.data.ip,
    reason: parsed.data.reason ?? null,
    createdByUserId: me.id,
  });
  void logHostAction({
    actor: me,
    actionLabel: "block_ip",
    subject: parsed.data.ip,
    details: parsed.data.reason
      ? `Blocked IP ${parsed.data.ip} — reason: ${parsed.data.reason}`
      : `Blocked IP ${parsed.data.ip}`,
    newValue: parsed.data.ip,
  });
  revalidatePath("/host/blocks");
  revalidatePath("/host/visitors");
  redirect("/host/blocks?ok=Blocked");
}

export async function unblockIpAction(formData: FormData) {
  const me = await requireHost();
  const idOrIp = String(formData.get("idOrIp") ?? "").trim();
  if (!idOrIp) return;
  await unblockIp(idOrIp);
  void logHostAction({
    actor: me,
    actionLabel: "unblock_ip",
    subject: idOrIp,
    details: `Unblocked IP / id: ${idOrIp}`,
    previousValue: idOrIp,
  });
  revalidatePath("/host/blocks");
  revalidatePath("/host/visitors");
}

export async function setBlockModeAction(formData: FormData) {
  const me = await requireHost();
  const raw = String(formData.get("mode") ?? "").trim();
  const mode = raw === "bare" ? "bare" : "page";
  await setBlockMode(mode);
  void logHostAction({
    actor: me,
    actionLabel: "set_block_mode",
    subject: "block-page-mode",
    newValue: mode,
    details: `Block-page mode set to "${mode}"`,
  });
  revalidatePath("/host/blocks");
  redirect(
    `/host/blocks?ok=${encodeURIComponent(
      mode === "bare"
        ? "Switched to browser default"
        : "Switched to friendly page"
    )}`
  );
}
