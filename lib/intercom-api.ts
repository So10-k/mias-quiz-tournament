// Server-side wrapper around the Intercom REST API. We use it for:
//   • finding an Intercom contact by external_id (= our user.id)
//   • posting an admin-only note on that contact (for sync events)
//   • tagging / untagging contacts (for outbound segmentation)
//   • sending outbound proactive messages (announcement banners)
//   • reading inbox stats for the host dashboard
//
// Env:
//   INTERCOM_ACCESS_TOKEN — personal access token from Intercom
//     dashboard → Settings → Developers → Access tokens. Has full
//     workspace scope; keep server-only.
//
// Methods return either { ok: true, … } or { ok: false, error: string }
// so callers can no-op gracefully when Intercom isn't reachable.

const BASE = "https://api.intercom.io";

function token(): string | null {
  return process.env.INTERCOM_ACCESS_TOKEN ?? null;
}

function authHeaders(): Record<string, string> | null {
  const t = token();
  if (!t) return null;
  return {
    Authorization: `Bearer ${t}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Intercom-Version": "2.11",
  };
}

export function intercomApiReady(): boolean {
  return !!token();
}

// ─── contact lookup ──────────────────────────────────────────────────

export type IntercomContact = {
  id: string;
  external_id: string | null;
  email: string | null;
  name: string | null;
};

export async function findContactByExternalId(
  externalId: string
): Promise<IntercomContact | null> {
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(`${BASE}/contacts/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: {
          field: "external_id",
          operator: "=",
          value: externalId,
        },
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      data?: Array<{ id: string; external_id?: string; email?: string; name?: string }>;
    };
    const row = j.data?.[0];
    if (!row) return null;
    return {
      id: row.id,
      external_id: row.external_id ?? null,
      email: row.email ?? null,
      name: row.name ?? null,
    };
  } catch {
    return null;
  }
}

// ─── notes on a contact (admin-only sidebar entries) ─────────────────

export async function postContactNote(args: {
  contactId: string;
  body: string;
  /** Intercom admin id who "wrote" the note. Defaults to system. */
  adminId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = authHeaders();
  if (!headers) return { ok: false, error: "no token" };
  try {
    const res = await fetch(
      `${BASE}/contacts/${args.contactId}/notes`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          body: args.body,
          ...(args.adminId ? { admin_id: args.adminId } : {}),
        }),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `intercom note ${res.status}: ${text.slice(0, 200)}`,
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

// ─── tags on a contact ──────────────────────────────────────────────

export async function tagContact(args: {
  contactId: string;
  tagName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers = authHeaders();
  if (!headers) return { ok: false, error: "no token" };
  try {
    // Intercom expects a tag id, not a name. Resolve (or create) the
    // tag first by name — POST /tags is idempotent: if a tag with the
    // same name exists, it returns it instead of erroring.
    const tagRes = await fetch(`${BASE}/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: args.tagName }),
    });
    if (!tagRes.ok) {
      const text = await tagRes.text();
      return {
        ok: false,
        error: `intercom tag-resolve ${tagRes.status}: ${text.slice(0, 200)}`,
      };
    }
    const tagJson = (await tagRes.json()) as { id?: string };
    const tagId = tagJson.id;
    if (!tagId) return { ok: false, error: "no tag id" };
    const attachRes = await fetch(
      `${BASE}/contacts/${args.contactId}/tags`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ id: tagId }),
      }
    );
    if (!attachRes.ok) {
      const text = await attachRes.text();
      return {
        ok: false,
        error: `intercom tag-attach ${attachRes.status}: ${text.slice(0, 200)}`,
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

// ─── outbound proactive message ─────────────────────────────────────

// Send an in-app or email message to one contact. Used by /host/intercom
// to push targeted nudges (e.g. "Predictions close in 1 hour") without
// leaving the host dashboard.
export async function sendInAppMessage(args: {
  contactId: string;
  /** Plaintext body. Intercom converts \n to <br>. */
  body: string;
  /** "inapp" (default) or "email". */
  channel?: "inapp" | "email";
  subject?: string;
  /** Intercom admin id sending the message. Required by Intercom. */
  adminId: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const headers = authHeaders();
  if (!headers) return { ok: false, error: "no token" };
  const channel = args.channel ?? "inapp";
  const body: Record<string, unknown> = {
    message_type: channel,
    from: { type: "admin", id: args.adminId },
    to: { type: "user", id: args.contactId },
    body: args.body,
  };
  if (channel === "email") {
    body.subject = args.subject ?? "A note from Mia's Quiz Tournament";
    body.template = "plain";
  }
  try {
    const res = await fetch(`${BASE}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `intercom message ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const j = (await res.json()) as { id?: string };
    return { ok: true, messageId: j.id ?? "" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

// ─── inbox stats ────────────────────────────────────────────────────

// Count open conversations. Used in /host/intercom as a glanceable
// "you have 3 unread" badge. Returns null on failure / no auth.
export async function countOpenConversations(): Promise<number | null> {
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(`${BASE}/conversations/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: {
          field: "open",
          operator: "=",
          value: true,
        },
        pagination: { per_page: 1 },
      }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { total_count?: number };
    return j.total_count ?? null;
  } catch {
    return null;
  }
}

// List the first Intercom admin id (used as the default sender for
// outbound messages). Cached for the Lambda lifetime.
let cachedAdminId: string | null = null;
export async function getDefaultAdminId(): Promise<string | null> {
  if (cachedAdminId) return cachedAdminId;
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(`${BASE}/admins`, { headers });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      admins?: Array<{ id: string }>;
    };
    const id = j.admins?.[0]?.id ?? null;
    if (id) cachedAdminId = id;
    return id;
  } catch {
    return null;
  }
}
