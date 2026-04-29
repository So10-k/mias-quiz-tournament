// Cloudflare R2 client — speaks the S3 API.
//
// All credentials live in env vars; the client only ever runs server-side.
// Public-facing flows (uploads, downloads) go through presigned URLs so the
// secret access key never leaves the server.

import { S3Client } from "@aws-sdk/client-s3";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
export const R2_BUCKET = process.env.R2_BUCKET ?? "miasthing";
const endpoint =
  process.env.R2_ENDPOINT ??
  (accountId
    ? `https://${accountId}.r2.cloudflarestorage.com`
    : undefined);

let _client: S3Client | null = null;

export function r2Client(): S3Client {
  if (_client) return _client;
  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error(
      "R2 not configured: set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT (or R2_ACCOUNT_ID) in env."
    );
  }
  _client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // R2 prefers virtual-host-style for some operations; force-path-style is
    // safe and works everywhere.
    forcePathStyle: true,
  });
  return _client;
}

// Generate a short-lived PUT URL for a direct browser → R2 upload.
export async function presignPut(opts: {
  key: string;
  contentType: string;
  expiresInSec?: number;
  contentLength?: number;
}) {
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: opts.key,
    ContentType: opts.contentType,
    ContentLength: opts.contentLength,
  });
  return getSignedUrl(r2Client(), cmd, {
    expiresIn: opts.expiresInSec ?? 600, // 10 minutes
  });
}

// Short-lived GET URL. We pass through Content-Disposition so the asset
// endpoint can choose inline-vs-attachment per file settings.
export async function presignGet(opts: {
  key: string;
  expiresInSec?: number;
  filename?: string;
  attachment?: boolean;
  contentType?: string;
}) {
  const cd = opts.filename
    ? `${opts.attachment ? "attachment" : "inline"}; filename="${
        opts.filename.replace(/"/g, "")
      }"`
    : undefined;
  const cmd = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: opts.key,
    ResponseContentDisposition: cd,
    ResponseContentType: opts.contentType,
  });
  return getSignedUrl(r2Client(), cmd, {
    expiresIn: opts.expiresInSec ?? 60 * 5, // 5 minutes is plenty for a viewer
  });
}

export async function deleteObject(key: string) {
  await r2Client().send(
    new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })
  );
}

export async function headObject(key: string) {
  return r2Client().send(
    new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })
  );
}

export function isR2Configured(): boolean {
  return !!(accessKeyId && secretAccessKey && endpoint);
}
