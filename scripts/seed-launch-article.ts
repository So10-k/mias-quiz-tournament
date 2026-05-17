// Seeds (or upserts by slug) the launch article that introduces the
// blog system. Safe to re-run — uses `welcome-to-the-quiz-book-blog`
// as the slug; on subsequent runs the row is updated in place.
//
// Run:
//   npm run blog:seed-intro

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as schema from "../db/schema";

function loadDotenv() {
  for (const file of [".env.local", ".env.production.local"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] == null) process.env[key] = val;
    }
  }
}
loadDotenv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(url);
const db = drizzle(sql, { schema });

const SLUG = "welcome-to-the-quiz-book-blog";

function id(): string {
  // 16-char base36 — matches the rest of the app's id shape.
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

const blocks = [
  {
    id: id(),
    type: "heading",
    data: { text: "What is this place?", level: 2 },
  },
  {
    id: id(),
    type: "paragraph",
    data: {
      text: "A small new corner of Mia's Quiz Tournament. Up until now the site has been quizzes, brackets, predictions, and the occasional [Question of the Day](/qotd). Now there's a blog, too — a place for stories, recaps, and the kind of writing that doesn't fit on a leaderboard.",
    },
  },
  {
    id: id(),
    type: "callout",
    data: {
      tone: "sun",
      emoji: "💡",
      text: "**Mia (age 7)** is the in-app author. She'll be publishing here too — whenever she has something to say.",
    },
  },
  {
    id: id(),
    type: "heading",
    data: { text: "What you'll find here", level: 2 },
  },
  {
    id: id(),
    type: "list",
    data: {
      ordered: false,
      items: [
        "**Tournament recaps** — the stories behind each round, who pulled an upset, who barely scraped through.",
        "**Behind the scenes** — how features get built, what Mia's been working on, what's coming next.",
        "**Mia's stories** — whatever she wants to write about. Animals, snacks, jokes, complaints. The full range.",
        "**Player spotlights** — short profiles of the people in this tournament, because half the fun is getting to know who you're up against.",
      ],
    },
  },
  { id: id(), type: "divider", data: { variant: "stars" } },
  {
    id: id(),
    type: "heading",
    data: { text: "How to keep up", level: 2 },
  },
  {
    id: id(),
    type: "paragraph",
    data: {
      text: "You can bookmark [the blog](/blog), but the easier way is to subscribe to a digest. We'll send a roundup of new posts on whatever cadence you pick — daily for the people who want everything, weekly on Sunday for most folks, monthly for the lightest possible touch.",
    },
  },
  {
    id: id(),
    type: "button",
    data: {
      text: "Subscribe to the digest",
      href: "/blog/subscribe",
      tone: "coral",
    },
  },
  { id: id(), type: "divider", data: { variant: "sun" } },
  {
    id: id(),
    type: "heading",
    data: { text: "A note on writing", level: 2 },
  },
  {
    id: id(),
    type: "paragraph",
    data: {
      text: "Posts here are first-person from whoever wrote them — Mia, me, or anyone we add later. We don't run ads. We don't track you across the web. We just write things and put them up, the same way you'd hand a friend a postcard.",
    },
  },
  {
    id: id(),
    type: "quote",
    data: {
      text: "Write the post. Send the postcard. Move on.",
      attribution: "the only editorial rule",
    },
  },
  {
    id: id(),
    type: "paragraph",
    data: {
      text: "If you want to hear from us, [opt in](/blog/subscribe). If you don't, the blog page works just fine without.",
    },
  },
  {
    id: id(),
    type: "heading",
    data: { text: "Coming up next", level: 3 },
  },
  {
    id: id(),
    type: "paragraph",
    data: {
      text: "**This week:** the recap of the most recent round and a behind-the-scenes on the live finals system we just shipped. **Soon:** Mia's first post — she's currently negotiating the topic.",
    },
  },
  {
    id: id(),
    type: "callout",
    data: {
      tone: "coral",
      emoji: "✉️",
      text: "Want to suggest a topic? Reply to any newsletter, or reach out directly. We read everything.",
    },
  },
  { id: id(), type: "divider", data: { variant: "wave" } },
  {
    id: id(),
    type: "paragraph",
    data: { text: "See you in the next one." },
  },
  { id: id(), type: "paragraph", data: { text: "— Sam" } },
];

function plainText(arr: typeof blocks): string {
  const lines: string[] = [];
  for (const b of arr) {
    if (b.type === "heading") lines.push((b.data as any).text);
    else if (b.type === "paragraph")
      lines.push(stripMd((b.data as any).text));
    else if (b.type === "callout")
      lines.push(stripMd((b.data as any).text));
    else if (b.type === "quote")
      lines.push(`"${(b.data as any).text}"`);
    else if (b.type === "list")
      for (const it of (b.data as any).items) lines.push(`• ${stripMd(it)}`);
    else if (b.type === "button")
      lines.push(
        `${(b.data as any).text}: ${(b.data as any).href}`
      );
  }
  return lines.filter(Boolean).join("\n\n");
}
function stripMd(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1");
}

async function run() {
  const text = plainText(blocks);
  const minutes = Math.max(1, Math.round(text.split(/\s+/).length / 200));

  const [existing] = await db
    .select()
    .from(schema.articles)
    .where(eq(schema.articles.slug, SLUG))
    .limit(1);

  if (existing) {
    console.log(`Article already exists at slug=${SLUG} — updating in place.`);
    await db
      .update(schema.articles)
      .set({
        title: "Welcome to the Quiz Book blog",
        subtitle:
          "Where Mia and I will tell you what's happening — and you can hear about it first.",
        dek: "A new section of the site for stories, behind-the-scenes notes, and tiny essays from the in-app author herself. Subscribe to get a digest in your inbox.",
        bodyJson: blocks,
        bodyText: text,
        readMinutes: minutes,
        updatedAt: new Date(),
      })
      .where(eq(schema.articles.id, existing.id));
    console.log(`✓ Updated. https://quiz.miaswebsites.art/blog/${SLUG}`);
    return;
  }

  await db.insert(schema.articles).values({
    id: id(),
    slug: SLUG,
    title: "Welcome to the Quiz Book blog",
    subtitle:
      "Where Mia and I will tell you what's happening — and you can hear about it first.",
    dek: "A new section of the site for stories, behind-the-scenes notes, and tiny essays from the in-app author herself. Subscribe to get a digest in your inbox.",
    bodyJson: blocks,
    bodyText: text,
    readMinutes: minutes,
    status: "published",
    visibility: "public",
    digestEligible: true,
    authorName: "Sam",
    publishedAt: new Date(),
  });
  console.log(`✓ Created launch article. https://quiz.miaswebsites.art/blog/${SLUG}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
