"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { setCountdown } from "@/lib/countdown-settings";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") redirect("/play");
}

// Update label + target + visibility together from a single host form.
export async function setCountdownAction(formData: FormData) {
  await requireHost();
  const label = String(formData.get("label") ?? "").trim();
  const targetLocal = String(formData.get("target") ?? "").trim();
  const visible = String(formData.get("visible") ?? "") === "yes";
  // datetime-local inputs come as "YYYY-MM-DDTHH:MM" in browser-local time.
  // Just pass the string straight through — the client component parses it
  // with new Date(...), which interprets local time correctly. ISO format
  // is fine too.
  await setCountdown({
    label,
    targetIso: targetLocal,
    visible,
  });
  revalidatePath("/host");
  revalidatePath("/");
  revalidatePath("/play");
}

// Quick visibility toggle (no form change).
export async function toggleCountdownVisibilityAction(formData: FormData) {
  await requireHost();
  const visible = String(formData.get("visible") ?? "") === "yes";
  await setCountdown({ visible });
  revalidatePath("/host");
  revalidatePath("/");
  revalidatePath("/play");
}
