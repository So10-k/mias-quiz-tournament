"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  lockAllMatchups,
  lockMatchup,
  setPredictionsSettings,
} from "@/lib/predictions";
import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") redirect("/play");
}

export async function setPredictionsSettingsAction(formData: FormData) {
  await requireHost();
  const enabled = String(formData.get("enabled") ?? "") === "yes";
  const prize = String(formData.get("prize") ?? "").trim();
  await setPredictionsSettings({ enabled, prize });
  revalidatePath("/host/predictions");
  revalidatePath("/predict");
  revalidatePath("/predict/leaderboard");
  revalidatePath("/");
  revalidatePath("/play");
}

export async function lockMatchupAction(formData: FormData) {
  await requireHost();
  const matchupId = String(formData.get("matchupId") ?? "");
  const locked = String(formData.get("locked") ?? "") === "yes";
  if (!matchupId) return;
  await lockMatchup(matchupId, locked);
  revalidatePath("/host/predictions");
  revalidatePath("/predict");
}

export async function lockAllAction(formData: FormData) {
  await requireHost();
  const locked = String(formData.get("locked") ?? "") === "yes";
  const [t] = await db
    .select()
    .from(schema.tournaments)
    .orderBy(desc(schema.tournaments.createdAt))
    .limit(1);
  if (!t) return;
  await lockAllMatchups(t.id, locked);
  revalidatePath("/host/predictions");
  revalidatePath("/predict");
}
