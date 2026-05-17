// Manual forum-group grants — stored in the `forum_group_grants`
// table, managed from /host/forum-roles, applied to Discourse on
// every SSO login (combined with bracket-derived auto-groups in
// lib/discourse-groups.ts).
//
// Scope: only the staff-flavoured groups + `authors`. The bracket
// groups (players / spectators / semi_finalists / finalists) are
// purely auto-derived and intentionally NOT in this list — adding
// them here would let an admin override the bracket, which fights
// the auto-sync.

import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { id as makeId } from "@/lib/ids";

// Groups Sam can grant from /host/forum-roles. Every group must
// also exist on the Discourse side (created in seed-permissions.rb
// or seed-mod-groups.rb).
export const MANUAL_FORUM_GROUPS = [
  "authors",
  "trial_moderators",
  "honorary_mods",
  "regulars",
] as const;
export type ManualForumGroup = (typeof MANUAL_FORUM_GROUPS)[number];

// Display metadata for the host UI. Mirrors the flair colours from
// seed-flairs.rb / seed-mod-groups.rb so the host page reads the
// same as the forum.
export const FORUM_GROUP_META: Record<
  ManualForumGroup,
  { label: string; description: string; color: string; icon: string }
> = {
  authors: {
    label: "Author",
    description:
      "Site author. Admin + moderator on the forum. Sam + Mia.",
    color: "#E94B7E",
    icon: "🌞",
  },
  trial_moderators: {
    label: "Trial Mod",
    description:
      "Trust Level 4 + category moderator on public categories (pin / edit / lock / dismiss flags within Welcome, Tournament Talk, Round Recaps, Off Topic, Help & Suggestions). No admin powers.",
    color: "#E94B7E",
    icon: "🛡️",
  },
  honorary_mods: {
    label: "Honorary Mod",
    description:
      "Trust Level 4 site-wide (edit any post, recategorize, lock topics). No category-mod tools. A recognition tier.",
    color: "#FFD93D",
    icon: "🥇",
  },
  regulars: {
    label: "Regular",
    description:
      "Trust Level 3 (handles flags by quorum, can lock topics, edit own old posts). The trusted-longtime-member tier.",
    color: "#B7E5FF",
    icon: "👍",
  },
};

export type Grant = {
  userId: string;
  groupName: ManualForumGroup;
  grantedAt: Date;
  grantedByUserId: string | null;
};

// All grants for one user — used by the SSO flow.
export async function listGrantsForUser(
  userId: string
): Promise<ManualForumGroup[]> {
  const rows = await db
    .select({ groupName: schema.forumGroupGrants.groupName })
    .from(schema.forumGroupGrants)
    .where(eq(schema.forumGroupGrants.userId, userId));
  return rows
    .map((r) => r.groupName)
    .filter((g): g is ManualForumGroup =>
      (MANUAL_FORUM_GROUPS as readonly string[]).includes(g)
    );
}

// All grants across all users — used by the host UI.
export async function listAllGrants(): Promise<
  Map<string, Set<ManualForumGroup>>
> {
  const rows = await db
    .select()
    .from(schema.forumGroupGrants);
  const out = new Map<string, Set<ManualForumGroup>>();
  for (const r of rows) {
    if (!(MANUAL_FORUM_GROUPS as readonly string[]).includes(r.groupName))
      continue;
    if (!out.has(r.userId)) out.set(r.userId, new Set());
    out.get(r.userId)!.add(r.groupName as ManualForumGroup);
  }
  return out;
}

// Add a grant. Idempotent — re-granting a group does nothing.
export async function grantForumGroup(args: {
  userId: string;
  groupName: ManualForumGroup;
  grantedByUserId: string | null;
}): Promise<void> {
  if (
    !(MANUAL_FORUM_GROUPS as readonly string[]).includes(args.groupName)
  ) {
    throw new Error(`unknown group: ${args.groupName}`);
  }
  await db
    .insert(schema.forumGroupGrants)
    .values({
      id: makeId(),
      userId: args.userId,
      groupName: args.groupName,
      grantedByUserId: args.grantedByUserId,
    })
    .onConflictDoNothing();
}

export async function revokeForumGroup(args: {
  userId: string;
  groupName: ManualForumGroup;
}): Promise<void> {
  await db
    .delete(schema.forumGroupGrants)
    .where(
      and(
        eq(schema.forumGroupGrants.userId, args.userId),
        eq(schema.forumGroupGrants.groupName, args.groupName)
      )
    );
}

// Bulk replace a user's grants — what the host UI submits.
// Intersects with MANUAL_FORUM_GROUPS so unknown values are rejected
// rather than smuggled in.
export async function setForumGroupsForUser(args: {
  userId: string;
  groupNames: string[];
  grantedByUserId: string | null;
}): Promise<void> {
  const valid = args.groupNames.filter((g): g is ManualForumGroup =>
    (MANUAL_FORUM_GROUPS as readonly string[]).includes(g)
  );
  const existing = await listGrantsForUser(args.userId);
  const toAdd = valid.filter((g) => !existing.includes(g));
  const toRemove = existing.filter((g) => !valid.includes(g));
  for (const g of toAdd) {
    await grantForumGroup({
      userId: args.userId,
      groupName: g,
      grantedByUserId: args.grantedByUserId,
    });
  }
  for (const g of toRemove) {
    await revokeForumGroup({ userId: args.userId, groupName: g });
  }
}
