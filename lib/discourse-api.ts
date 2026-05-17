// Server-side helper for hitting Discourse's admin REST API. Used
// for one-off pushes from the quiz site into the forum (match-result
// auto-posts, future: post round-open announcements, etc.).
//
// Auth: Discourse API key + API username via headers. The key is a
// system-account key generated at Admin → API; only used server-side
// from the host's actions, never reaches the browser.
//
// Required env:
//   DISCOURSE_BASE_URL    — https://discuss.miaswebsites.art
//   DISCOURSE_API_KEY     — admin API key
//   DISCOURSE_API_USER    — username to post-as (default "system")

const DEFAULT_BASE = "https://discuss.miaswebsites.art";
const DEFAULT_USER = "system";

function baseUrl(): string {
  return process.env.DISCOURSE_BASE_URL ?? DEFAULT_BASE;
}
function apiKey(): string | null {
  return process.env.DISCOURSE_API_KEY ?? null;
}
function apiUser(): string {
  return process.env.DISCOURSE_API_USER ?? DEFAULT_USER;
}

// Common headers for admin API calls. Returns null if no key is
// configured — callers should silently no-op rather than crash.
function authHeaders(): Record<string, string> | null {
  const key = apiKey();
  if (!key) return null;
  return {
    "Api-Key": key,
    "Api-Username": apiUser(),
    "Content-Type": "application/json",
    accept: "application/json",
  };
}

// Resolve a category slug (e.g. "round-recaps") to its numeric id.
// Cached in-process for the lifetime of the Lambda — slugs change
// rarely.
const categoryIdCache = new Map<string, number>();
export async function resolveCategoryId(
  slug: string
): Promise<number | null> {
  if (categoryIdCache.has(slug)) return categoryIdCache.get(slug) ?? null;
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(`${baseUrl()}/c/${slug}.json`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      category?: { id: number };
    };
    const id = json?.category?.id ?? null;
    if (id) categoryIdCache.set(slug, id);
    return id;
  } catch {
    return null;
  }
}

export type CreateTopicArgs = {
  title: string;
  raw: string; // markdown body
  categorySlug: string;
  tags?: string[];
  // Idempotency hint — if we've already posted for this id, skip.
  // We mark it via `external_id` (a Discourse field) so re-runs are
  // safe.
  externalId?: string;
};

export type CreateTopicResult =
  | { ok: true; topicId: number; postId: number; url: string }
  | { ok: false; error: string };

// Resolve a Discourse user by external_id (the quiz-site users.id we
// set on SSO). Returns the Discourse username, which the group-add
// endpoint requires. Null if the user has never SSO'd into the forum.
export async function resolveDiscourseUsernameByExternalId(
  externalId: string
): Promise<string | null> {
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(
      `${baseUrl()}/u/by-external/${encodeURIComponent(externalId)}.json`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { user?: { username?: string } };
    return j?.user?.username ?? null;
  } catch {
    return null;
  }
}

// Resolve a Discourse group by name → numeric id. Cached.
const groupIdCache = new Map<string, number>();
export async function resolveGroupId(
  name: string
): Promise<number | null> {
  if (groupIdCache.has(name)) return groupIdCache.get(name) ?? null;
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(
      `${baseUrl()}/groups/${encodeURIComponent(name)}.json`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { group?: { id?: number } };
    const id = j?.group?.id ?? null;
    if (id) groupIdCache.set(name, id);
    return id;
  } catch {
    return null;
  }
}

// Add one or more usernames to a Discourse group. Idempotent on
// Discourse's side (already-member errors are non-fatal here).
export async function addUsernamesToGroup(args: {
  groupName: string;
  usernames: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = authHeaders();
  if (!headers) return { ok: false, error: "DISCOURSE_API_KEY not configured" };
  const id = await resolveGroupId(args.groupName);
  if (!id) return { ok: false, error: `group not found: ${args.groupName}` };
  try {
    const res = await fetch(`${baseUrl()}/groups/${id}/members.json`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ usernames: args.usernames.join(",") }),
    });
    if (!res.ok) {
      const text = await res.text();
      // Already-a-member responses come back 422 with a specific message
      // — treat as success for idempotency.
      if (res.status === 422 && /already/.test(text)) return { ok: true };
      return {
        ok: false,
        error: `discourse ${res.status}: ${text.slice(0, 300)}`,
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

export async function createTopic(
  args: CreateTopicArgs
): Promise<CreateTopicResult> {
  const headers = authHeaders();
  if (!headers) {
    return { ok: false, error: "DISCOURSE_API_KEY not configured" };
  }

  // Idempotency: if external_id was already used for a topic, skip.
  if (args.externalId) {
    try {
      const probe = await fetch(
        `${baseUrl()}/t/external_id/${encodeURIComponent(args.externalId)}.json`,
        { headers, cache: "no-store" }
      );
      if (probe.ok) {
        const j = (await probe.json()) as {
          id?: number;
          slug?: string;
        };
        if (j?.id) {
          return {
            ok: true,
            topicId: j.id,
            postId: 0,
            url: `${baseUrl()}/t/${j.slug ?? "topic"}/${j.id}`,
          };
        }
      }
    } catch {
      // Falls through to create.
    }
  }

  const categoryId = await resolveCategoryId(args.categorySlug);
  if (!categoryId) {
    return {
      ok: false,
      error: `category not found: ${args.categorySlug}`,
    };
  }

  const body: Record<string, unknown> = {
    title: args.title,
    raw: args.raw,
    category: categoryId,
  };
  if (args.tags && args.tags.length) body.tags = args.tags;
  if (args.externalId) body.external_id = args.externalId;

  try {
    const res = await fetch(`${baseUrl()}/posts.json`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `discourse ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as {
      id: number;
      topic_id: number;
      topic_slug: string;
    };
    return {
      ok: true,
      topicId: json.topic_id,
      postId: json.id,
      url: `${baseUrl()}/t/${json.topic_slug}/${json.topic_id}`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fetch failed",
    };
  }
}
