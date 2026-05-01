"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  setActiveProvider,
  type EmailProvider,
} from "@/lib/email-provider";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") redirect("/play");
}

export async function setEmailProviderAction(formData: FormData) {
  await requireHost();
  const raw = String(formData.get("provider") ?? "");
  const provider: EmailProvider = raw === "brevo" ? "brevo" : "resend";
  await setActiveProvider(provider);
  revalidatePath("/host");
}
