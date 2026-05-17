// Block-document model for articles.
//
// Articles are stored as an ordered array of blocks in `articles.bodyJson`.
// Each block has a stable `id` (so we can drag/drop without React key
// thrash), a `type`, and a `data` payload typed per block type.
//
// Adding a new block type:
//   1) add to BlockType union
//   2) add the data shape to BlockData
//   3) handle it in lib/article-render.tsx (web) AND
//      lib/article-render-email.ts (email)
//   4) add an editor in components/articles/BlockEditors.tsx

import { z } from "zod";

export const BLOCK_TYPES = [
  "heading",
  "paragraph",
  "image",
  "callout",
  "quote",
  "divider",
  "button",
  "list",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

// Per-type data shapes. All optional fields default to safe empties at
// render time so legacy/in-progress blocks never crash.

export type HeadingData = {
  text: string;
  level: 2 | 3; // h2 or h3 — title is rendered separately
};
export type ParagraphData = {
  // Supports inline markdown: **bold**, _italic_, [link](url), `code`
  text: string;
};
export type ImageData = {
  src: string;
  alt: string;
  caption?: string;
};
export type CalloutData = {
  // One of the picture-book themes — coral / sun / sky / grass.
  tone: "coral" | "sun" | "sky" | "grass";
  emoji?: string;
  text: string;
};
export type QuoteData = {
  text: string;
  attribution?: string;
};
export type DividerData = {
  variant: "stars" | "wave" | "sun";
};
export type ButtonData = {
  text: string;
  href: string;
  tone: "coral" | "sun" | "sky" | "grass" | "white";
};
export type ListData = {
  ordered: boolean;
  items: string[];
};

export type BlockData =
  | { type: "heading"; data: HeadingData }
  | { type: "paragraph"; data: ParagraphData }
  | { type: "image"; data: ImageData }
  | { type: "callout"; data: CalloutData }
  | { type: "quote"; data: QuoteData }
  | { type: "divider"; data: DividerData }
  | { type: "button"; data: ButtonData }
  | { type: "list"; data: ListData };

export type ArticleBlock = { id: string } & BlockData;

// Zod schemas for each block type's `data`. We validate at the lib
// layer (lib/articles.ts saveArticle) before persisting JSON.

const headingSchema = z.object({
  text: z.string().max(160),
  level: z.union([z.literal(2), z.literal(3)]),
});
const paragraphSchema = z.object({
  text: z.string().max(4000),
});
const imageSchema = z.object({
  src: z.string().max(800),
  alt: z.string().max(200),
  caption: z.string().max(200).optional(),
});
const calloutSchema = z.object({
  tone: z.enum(["coral", "sun", "sky", "grass"]),
  emoji: z.string().max(8).optional(),
  text: z.string().max(2000),
});
const quoteSchema = z.object({
  text: z.string().max(1000),
  attribution: z.string().max(200).optional(),
});
const dividerSchema = z.object({
  variant: z.enum(["stars", "wave", "sun"]),
});
const buttonSchema = z.object({
  text: z.string().max(80),
  href: z.string().max(800),
  tone: z.enum(["coral", "sun", "sky", "grass", "white"]),
});
const listSchema = z.object({
  ordered: z.boolean(),
  items: z.array(z.string().max(400)).max(40),
});

const blockSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1).max(64), type: z.literal("heading"), data: headingSchema }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("paragraph"), data: paragraphSchema }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("image"), data: imageSchema }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("callout"), data: calloutSchema }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("quote"), data: quoteSchema }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("divider"), data: dividerSchema }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("button"), data: buttonSchema }),
  z.object({ id: z.string().min(1).max(64), type: z.literal("list"), data: listSchema }),
]);

export function validateBlocks(input: unknown): ArticleBlock[] {
  const parsed = z.array(blockSchema).max(200).parse(input);
  return parsed as ArticleBlock[];
}

// Default starting blocks for a fresh article.
export function defaultBlocks(): ArticleBlock[] {
  return [
    {
      id: cryptoRandomId(),
      type: "heading",
      data: { text: "Once upon a time…", level: 2 },
    },
    {
      id: cryptoRandomId(),
      type: "paragraph",
      data: { text: "Tell the story. Add as many blocks as you like." },
    },
  ];
}

export function newBlock(type: BlockType): ArticleBlock {
  const id = cryptoRandomId();
  switch (type) {
    case "heading":
      return { id, type, data: { text: "", level: 2 } };
    case "paragraph":
      return { id, type, data: { text: "" } };
    case "image":
      return { id, type, data: { src: "", alt: "" } };
    case "callout":
      return { id, type, data: { tone: "sun", emoji: "💡", text: "" } };
    case "quote":
      return { id, type, data: { text: "" } };
    case "divider":
      return { id, type, data: { variant: "stars" } };
    case "button":
      return { id, type, data: { text: "Read more", href: "/", tone: "coral" } };
    case "list":
      return { id, type, data: { ordered: false, items: [""] } };
  }
}

function cryptoRandomId(): string {
  // Stable across SSR/CSR — works in both Node and the browser. Used as
  // React key + drag handle id. Not a security concern.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return Math.random().toString(36).slice(2, 18);
}

// Plaintext flatten — used to populate articles.bodyText for search +
// email plain-text fallback. Strips inline markdown.
export function blocksToPlainText(blocks: ArticleBlock[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        lines.push(b.data.text);
        break;
      case "paragraph":
        lines.push(stripInlineMarkdown(b.data.text));
        break;
      case "image":
        if (b.data.caption) lines.push(b.data.caption);
        break;
      case "callout":
        lines.push(`${b.data.emoji ?? ""} ${b.data.text}`.trim());
        break;
      case "quote":
        lines.push(`"${b.data.text}"${b.data.attribution ? ` — ${b.data.attribution}` : ""}`);
        break;
      case "divider":
        lines.push("");
        break;
      case "button":
        lines.push(`${b.data.text}: ${b.data.href}`);
        break;
      case "list":
        for (const item of b.data.items) {
          lines.push(`• ${stripInlineMarkdown(item)}`);
        }
        break;
    }
  }
  return lines.filter((l) => l.length > 0).join("\n\n");
}

function stripInlineMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1");
}

// Reading-time estimate: 200 words/min, minimum 1 minute.
export function estimateReadMinutes(plainText: string): number {
  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
