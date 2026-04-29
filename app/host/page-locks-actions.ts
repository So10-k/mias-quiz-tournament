"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  ALL_LOCKABLE,
  setPageLocked,
  type LockablePage,
} from "@/lib/page-locks";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") redirect("/play");
}

export async function togglePageLockAction(formData: FormData) {
  await requireHost();
  const page = String(formData.get("page") ?? "") as LockablePage;
  const locked = String(formData.get("locked") ?? "") === "yes";
  if (!(ALL_LOCKABLE as string[]).includes(page)) {
    redirect("/host?error=Unknown+page");
  }
  await setPageLocked(page, locked);
  revalidatePath("/host");
  revalidatePath(`/${page}`);
}
