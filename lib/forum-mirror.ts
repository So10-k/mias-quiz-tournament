// Mirror Discourse's Announcements category onto the main-site
// /blog page. Pull-only — we fetch the category JSON server-side
// at request time (cached ~5 min) and surface topics alongside
// native articles.
//
// Why pull, not webhook: simpler. No secrets to plumb between
// Discourse and the quiz site, no signing, no failure modes when
// a webhook gets dropped. Discourse's category JSON endpoint is
// public and idempotent.
//
// Cache strategy: rely on Discourse's HTTP response speed (~100ms)
// and re-fetch every request. We previously wrapped this in
// unstable_cache, but its JSON-style serialization mangled the
// Date objects in MirroredTopic, which crashed /blog in production.
// Direct fetch is simpler and fast enough at this scale.

const FORUM_BASE =
  process.env.DISCOURSE_BASE_URL ?? "https://discuss.miaswebsites.art";
const ANNOUNCEMENTS_SLUG = "announcements";

export type MirroredTopic = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  postedAt: Date;
  url: string;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  posts: number;
  // Non-empty arrays are sortable; trailing newline strip is fine
  // because we pull excerpt direct from Discourse already trimmed.
};

type DiscourseTopicListItem = {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  created_at: string;
  posts_count: number;
  posters?: { user_id: number; description: string }[];
};

type DiscourseUser = {
  id: number;
  username: string;
  avatar_template: string;
};

type DiscourseCategoryResponse = {
  topic_list?: {
    topics?: DiscourseTopicListItem[];
  };
  users?: DiscourseUser[];
};

export async function fetchAnnouncementTopics(): Promise<MirroredTopic[]> {
  const url = `${FORUM_BASE}/c/${ANNOUNCEMENTS_SLUG}.json`;
  let res: Response;
  try {
    // 6s budget — if Discourse is down, the blog page must still
    // render with native articles only.
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 6000);
    res = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: ctrl.signal,
    });
    clearTimeout(tid);
  } catch {
    return [];
  }
  if (!res.ok) return [];

  let json: DiscourseCategoryResponse;
  try {
    json = (await res.json()) as DiscourseCategoryResponse;
  } catch {
    return [];
  }
  const topics = json.topic_list?.topics ?? [];
  const usersByID = new Map<number, DiscourseUser>();
  for (const u of json.users ?? []) usersByID.set(u.id, u);

  return topics
    // Skip the "About the Announcements category" auto-topic that
    // Discourse generates per-category; it's noisy.
    .filter((t) => !t.title.toLowerCase().startsWith("about the "))
    .map<MirroredTopic>((t) => {
      const firstPosterId = t.posters?.[0]?.user_id;
      const author = firstPosterId ? usersByID.get(firstPosterId) : undefined;
      const avatarUrl = author?.avatar_template
        ? FORUM_BASE +
          author.avatar_template.replace("{size}", "48")
        : null;
      return {
        id: t.id,
        title: t.title,
        slug: t.slug,
        excerpt: (t.excerpt ?? "").replace(/&hellip;\s*$/, "…").trim() || null,
        postedAt: new Date(t.created_at),
        url: `${FORUM_BASE}/t/${t.slug}/${t.id}`,
        authorUsername: author?.username ?? null,
        authorAvatarUrl: avatarUrl,
        posts: t.posts_count,
      };
    });
}

