"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import {
  deleteFile,
  listFiles,
  updateFile,
  type AccessMode,
  type FileRow,
} from "@/lib/files";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") redirect("/play");
  return u;
}

export async function fetchAllFiles(): Promise<FileRow[]> {
  await requireHost();
  return listFiles();
}

export async function deleteFileAction(id: string) {
  await requireHost();
  await deleteFile(id);
  revalidatePath("/host/files");
}

const UpdateInput = z.object({
  id: z.string(),
  accessMode: z.enum(["public", "login", "users", "password"]).optional(),
  newPassword: z.string().max(200).nullable().optional(),
  allowedEmails: z.string().max(4000).nullable().optional(),
  allowDownload: z.boolean().optional(),
  note: z.string().max(500).nullable().optional(),
});

export async function updateFileAction(
  patch: z.infer<typeof UpdateInput>
): Promise<FileRow | null> {
  await requireHost();
  const parsed = UpdateInput.parse(patch);
  return updateFile({
    id: parsed.id,
    accessMode: parsed.accessMode as AccessMode | undefined,
    newPassword: parsed.newPassword,
    allowedEmails: parsed.allowedEmails,
    allowDownload: parsed.allowDownload,
    note: parsed.note,
  });
}
