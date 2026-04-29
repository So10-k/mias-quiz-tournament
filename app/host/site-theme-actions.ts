"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { setSiteTheme, type SiteTheme } from "@/lib/site-theme";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") redirect("/play");
}

export async function setSiteThemeAction(formData: FormData) {
  await requireHost();
  const raw = String(formData.get("theme") ?? "");
  const theme: SiteTheme = raw === "arcade" ? "arcade" : "default";
  await setSiteTheme(theme);
  revalidatePath("/host");
  revalidatePath("/bracket");
  revalidatePath("/players");
  revalidatePath("/standings");
}
