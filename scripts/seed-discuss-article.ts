// Seeds (or upserts by slug) the launch article for the new
// discussion forum at discuss.miaswebsites.art. Idempotent —
// run via:
//   npm run blog:seed-discuss

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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
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

const SLUG = "we-have-a-forum-now";

function id(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

const blocks = [
  {
    id: id(),
    type: "paragraph",
    data: {
      text: "Big news: there's a new place to hang out between rounds. We just launched a discussion forum at **[discuss.miaswebsites.art](https://discuss.miaswebsites.art)** — a spot for predictions, post-round chatter, snack reviews, and anything else.",
    },
  },
  {
    id: id(),
    type: "callout",
    data: {
      tone: "sky",
      emoji: "🔑",
      text: "**You don't need a new password.** Click \"Sign In\" on the forum and it bounces through the main site — if you're already signed in here, you'll come right back to the forum signed in.",
    },
  },
  {
    id: id(),
    type: "heading",
    data: { text: "How to use it (quick tour)", level: 2 },
  },
  {
    id: id(),
    type: "list",
    data: {
      ordered: true,
      items: [
        "Open **[discuss.miaswebsites.art](https://discuss.miaswebsites.art)** in your browser.",
        "Click **Sign In** in the top right.",
        "If you've already signed in to the main quiz site today, you're done — you're now signed in to the forum too. If not, sign in once and the forum will let you right in.",
        "Click the big pink **+ New Topic** button to start a conversation. Pick a category on the right (Tournament Talk, Off Topic, Help & Suggestions, etc.). Give it a title. Write whatever you want. Click **+ Create Topic**.",
        "Tap the heart on any post to like it. Tap **Reply** to write back.",
      ],
    },
  },
  {
    id: id(),
    type: "heading",
    data: { text: "What's already there", level: 2 },
  },
  {
    id: id(),
    type: "list",
    data: {
      ordered: false,
      items: [
        "**Welcome — start here** — pinned at the top, walks you through the basics.",
        "**Who's making the final?** — drop your prediction in **Tournament Talk**.",
        "**What snacks are you bringing for the live finals?** — for **Off Topic** people who care about the truly important things.",
        "**Found a bug? Have an idea?** — under **Help & Suggestions**. Sam reads everything.",
      ],
    },
  },
  { id: id(), type: "divider", data: { variant: "stars" } },
  {
    id: id(),
    type: "heading",
    data: { text: "A neat trick: live widgets in posts", level: 2 },
  },
  {
    id: id(),
    type: "paragraph",
    data: {
      text: "If you're writing a post about the tournament, you can drop in a live widget that pulls from the main site. Just type `[quizbook-bracket]` (or `[quizbook-qotd]`, or `[quizbook-standings]`) on its own line and it shows up as a live widget in your post — updates whenever the data on the main site changes. Try it.",
    },
  },
  { id: id(), type: "divider", data: { variant: "wave" } },
  {
    id: id(),
    type: "heading",
    data: { text: "Some friendly notes", level: 3 },
  },
  {
    id: id(),
    type: "list",
    data: {
      ordered: false,
      items: [
        "**Everyone in the family can read every post.** Don't post anything you wouldn't want grandma to see — because she's probably already there.",
        "**No notifications by default.** You won't get spammed. If you want emails when someone replies to a topic, click the bell on that topic and pick **Watching**.",
        "**Quizzes are still on the main site** — the forum is just for talking, not for taking quizzes.",
        "**If something's broken or confusing**, please post in **Help & Suggestions**. The forum is brand new and there will be rough edges.",
      ],
    },
  },
  {
    id: id(),
    type: "button",
    data: {
      text: "Open the forum →",
      href: "https://discuss.miaswebsites.art",
      tone: "coral",
    },
  },
  {
    id: id(),
    type: "callout",
    data: {
      tone: "sun",
      emoji: "💡",
      text: "Quick test to make sure your sign-in works: click the link above, click **Sign In**, and confirm you land back on the forum with your name in the top right. If anything goes wrong, just reply to this newsletter and tell me what happened.",
    },
  },
  { id: id(), type: "divider", data: { variant: "sun" } },
  {
    id: id(),
    type: "paragraph",
    data: {
      text: "See you over there.",
    },
  },
  { id: id(), type: "paragraph", data: { text: "— Sam" } },
];

function plainText(arr: typeof blocks): string {
  const lines: string[] = [];
  for (const b of arr) {
    const d = b.data as Record<string, unknown>;
    if (b.type === "heading") lines.push(String(d.text));
    else if (b.type === "paragraph") lines.push(stripMd(String(d.text)));
    else if (b.type === "callout") lines.push(stripMd(String(d.text)));
    else if (b.type === "list")
      for (const it of (d.items as string[]) ?? []) lines.push(`• ${stripMd(it)}`);
    else if (b.type === "button") lines.push(`${d.text}: ${d.href}`);
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

  const meta = {
    title: "We have a forum now",
    subtitle: "discuss.miaswebsites.art is live — same sign-in, same vibe, different room.",
    dek: "A new place for predictions, recaps, and off-topic chat between rounds. No new password — your existing quiz-site login works automatically.",
  };

  if (existing) {
    await db
      .update(schema.articles)
      .set({
        ...meta,
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
    ...meta,
    bodyJson: blocks,
    bodyText: text,
    readMinutes: minutes,
    status: "published",
    visibility: "public",
    digestEligible: true,
    authorName: "Sam",
    publishedAt: new Date(),
  });
  console.log(`✓ Created. https://quiz.miaswebsites.art/blog/${SLUG}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
