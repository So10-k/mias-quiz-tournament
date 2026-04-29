// File vault engine — orchestrates the `files` table + R2 storage.
//
// Access modes:
//   public   — anyone with the URL can view
//   login    — any signed-in user can view
//   users    — only users whose email is in `allowedEmails` (CSV) can view
//   password — viewer must enter a password (scrypt-hashed at rest)
//
// `allowDownload` controls whether viewers expose download buttons and
// whether the asset endpoint stamps Content-Disposition: attachment.

import { db, schema } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import { id as makeId } from "./ids";
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "node:crypto";
import { presignGet, presignPut, deleteObject } from "./r2";

const { files } = schema;

export type FileRow = typeof files.$inferSelect;
export type AccessMode = FileRow["accessMode"];

function scrypt(password: string, salt: Buffer, n = 32): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, n, (err, key) => {
      if (err) return reject(err);
      resolve(key as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null
): Promise<boolean> {
  if (!stored) return false;
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(keyHex, "hex");
  const got = await scrypt(password, salt, expected.length);
  // timingSafeEqual requires equal-length buffers; we sized got to expected.
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}

// Slug an original filename for use as part of the storage key.
function safeSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type CreatePresignedUploadInput = {
  filename: string;
  mimeType: string;
  size: number;
  ownerUserId: string;
};

// Reserves a storage key + returns a short-lived presigned PUT URL. The
// browser uploads directly to R2; we record the file row only after the
// finalize call confirms the upload.
export async function createPresignedUpload(input: CreatePresignedUploadInput) {
  const id = makeId();
  const slug = safeSlug(input.filename) || "file";
  const key = `files/${id}/${slug}`;
  const url = await presignPut({
    key,
    contentType: input.mimeType,
    contentLength: input.size,
  });
  return { id, key, url };
}

export type FinalizeUploadInput = {
  id: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  ownerUserId: string;
};

export async function finalizeUpload(input: FinalizeUploadInput) {
  const [row] = await db
    .insert(files)
    .values({
      id: input.id,
      storageKey: input.storageKey,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: input.size,
      accessMode: "login",
      passwordHash: null,
      allowedEmails: null,
      allowDownload: true,
      createdByUserId: input.ownerUserId,
    })
    .returning();
  return row;
}

export async function listFiles(): Promise<FileRow[]> {
  return db.select().from(files).orderBy(desc(files.createdAt));
}

export async function getFileById(id: string): Promise<FileRow | null> {
  const [r] = await db.select().from(files).where(eq(files.id, id)).limit(1);
  return r ?? null;
}

export async function deleteFile(id: string): Promise<void> {
  const f = await getFileById(id);
  if (!f) return;
  try {
    await deleteObject(f.storageKey);
  } catch (e) {
    // Even if R2 delete fails (already gone, network), drop the row so the
    // dashboard doesn't keep showing it.
    // eslint-disable-next-line no-console
    console.warn("R2 delete failed", e);
  }
  await db.delete(files).where(eq(files.id, id));
}

export type UpdateFileInput = {
  id: string;
  accessMode?: AccessMode;
  newPassword?: string | null; // pass null to clear
  allowedEmails?: string | null;
  allowDownload?: boolean;
  note?: string | null;
};

export async function updateFile(input: UpdateFileInput) {
  const f = await getFileById(input.id);
  if (!f) return null;
  const patch: Partial<typeof files.$inferInsert> = {};
  if (input.accessMode) patch.accessMode = input.accessMode;
  if (input.allowDownload !== undefined) patch.allowDownload = input.allowDownload;
  if (input.allowedEmails !== undefined) {
    patch.allowedEmails = input.allowedEmails
      ? input.allowedEmails
          .split(/[,\n]/)
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean)
          .join(",")
      : null;
  }
  if (input.note !== undefined) patch.note = input.note;
  if (input.newPassword !== undefined) {
    patch.passwordHash = input.newPassword
      ? await hashPassword(input.newPassword)
      : null;
  }
  const [row] = await db
    .update(files)
    .set(patch)
    .where(eq(files.id, input.id))
    .returning();
  return row;
}

export type AccessCheckResult =
  | { ok: true }
  | { ok: false; reason: "login" | "users" | "password" | "not_found" };

// Check whether the given (possibly anonymous) user can view a file.
//
// Password mode: pass `passwordCookieOk=true` if the caller has already
// validated the password via the cookie (see /api/files/[id]/unlock).
export async function checkAccess(
  file: FileRow,
  ctx: {
    userEmail?: string | null;
    userIsAuthor?: boolean;
    passwordCookieOk?: boolean;
  }
): Promise<AccessCheckResult> {
  if (ctx.userIsAuthor) return { ok: true };
  switch (file.accessMode) {
    case "public":
      return { ok: true };
    case "login":
      return ctx.userEmail ? { ok: true } : { ok: false, reason: "login" };
    case "users": {
      if (!ctx.userEmail) return { ok: false, reason: "login" };
      const allowed = (file.allowedEmails ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      return allowed.includes(ctx.userEmail.toLowerCase())
        ? { ok: true }
        : { ok: false, reason: "users" };
    }
    case "password":
      return ctx.passwordCookieOk
        ? { ok: true }
        : { ok: false, reason: "password" };
  }
}

// Build a short-lived asset URL the client can fetch (for video src,
// img src, pdf iframe, or download).
export async function presignAssetUrl(
  file: FileRow,
  opts: { attachment?: boolean } = {}
) {
  return presignGet({
    key: file.storageKey,
    filename: file.originalName,
    attachment: !!opts.attachment,
    contentType: file.mimeType,
  });
}

// Derive a viewer kind from MIME so the viewer page can pick the right
// component without N hardcoded special cases.
export function viewerKind(mime: string): "image" | "pdf" | "video" | "audio" | "text" | "other" {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("text/")) return "text";
  return "other";
}

// Cookie name used to remember a successful password unlock for a file.
// Short-lived; signed with AUTH_SECRET to prevent tampering.
export const PASSWORD_COOKIE = (id: string) => `mfile_${id}`;
