// Tiny helper that lists /public/videos/ and /public/images/ at request
// time so the Scene Director can offer a dropdown of "which video?".
// Server-only — uses node fs.

import fs from "node:fs/promises";
import path from "node:path";

const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"]);

export type PublicAsset = {
  /** Public URL path, e.g. "/videos/finals-intro.mp4". */
  url: string;
  /** Basename for display. */
  name: string;
  /** File size in bytes, 0 on stat failure. */
  size: number;
};

async function listFolder(
  relFolder: string,
  exts: Set<string>
): Promise<PublicAsset[]> {
  const abs = path.join(process.cwd(), "public", relFolder);
  let entries: string[] = [];
  try {
    entries = await fs.readdir(abs);
  } catch {
    return [];
  }
  const out: PublicAsset[] = [];
  for (const name of entries) {
    const ext = path.extname(name).toLowerCase();
    if (!exts.has(ext)) continue;
    const filePath = path.join(abs, name);
    let size = 0;
    try {
      const s = await fs.stat(filePath);
      if (!s.isFile()) continue;
      size = s.size;
    } catch {
      continue;
    }
    out.push({
      url: `/${relFolder}/${name}`,
      name,
      size,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function listPublicVideos(): Promise<PublicAsset[]> {
  return listFolder("videos", VIDEO_EXTS);
}

export function listPublicImages(): Promise<PublicAsset[]> {
  return listFolder("images", IMAGE_EXTS);
}
