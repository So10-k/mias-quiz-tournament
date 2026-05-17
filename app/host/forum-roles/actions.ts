"use server";

// Server actions for /host/forum-roles. POST-only (per the project's
// no-GET-state-mutations rule), gated to currentUser().role === 'author'.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import {
  setForumGroupsForUser,
  listGrantsForUser,
  MANUAL_FORUM_GROUPS,
} from "@/lib/forum-grants";
import { logHostAction } from "@/lib/discourse-staff-log";
import {
  addUsernamesToGroup,
  resolveDiscourseUsernameByExternalId,
} from "@/lib/discourse-api";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";

async function requireAuthor() {
  const u = await requireUser();
  if (u.role !== "author") throw new Error("forbidden — author only");
  return u;
}

export async function saveUserRolesAction(formData: FormData) {
  const me = await requireAuthor();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("missing userId");
  // Capture the previous state so the staff log can show the diff.
  const before = await listGrantsForUser(userId);
  // Each role is its own checkbox with name="role:<groupName>". Pull
  // out everything that's checked + intersect with the allowlist
  // server-side (so a tampered request can't grant arbitrary groups).
  const desired: string[] = [];
  for (const g of MANUAL_FORUM_GROUPS) {
    if (formData.get(`role:${g}`) === "1") desired.push(g);
  }
  await setForumGroupsForUser({
    userId,
    groupNames: desired,
    grantedByUserId: me.id,
  });

  const [target] = await db
    .select({
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  void logHostAction({
    actor: me,
    actionLabel: "set_forum_roles",
    subject: userId,
    targetUserId: userId,
    targetEmail: target?.email,
    targetName: target?.name,
    previousValue: before.join(", ") || "(none)",
    newValue: desired.join(", ") || "(none)",
    details: `Updated forum role grants for ${target?.name ?? target?.email ?? userId}`,
  });

  revalidatePath("/host/forum-roles");
}

// One-off override: add a user (by email) directly to the Discourse
// `finalists` group via the admin API, then stamp their NDA-agreed
// timestamp locally so the SSO sync doesn't fight us next login.
//
// Use this for demos / a finalist we couldn't add to the bracket. The
// `finalists` group is lifelong in lib/discourse-groups.ts so SSO
// will not strip it on subsequent logins.
export async function grantFinalistsForDemoAction(formData: FormData) {
  const me = await requireAuthor();
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailRaw) throw new Error("missing email");

  const [user] = await db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${emailRaw}`)
    .limit(1);
  if (!user) {
    throw new Error(`no quiz-site user with email ${emailRaw}`);
  }

  // Stamp the NDA so the SSO sync keeps `finalists` rather than
  // `pending_finals_nda` if/when the user does end up in a matchup.
  if (!user.finalsNdaAgreedAt) {
    await db
      .update(schema.users)
      .set({ finalsNdaAgreedAt: new Date() })
      .where(eq(schema.users.id, user.id));
  }

  // Resolve their Discourse username. They must have SSO'd in at
  // least once for this to succeed.
  const username = await resolveDiscourseUsernameByExternalId(user.id);
  if (!username) {
    throw new Error(
      `Discourse user not found for ${emailRaw}. Have them sign in to discuss.miaswebsites.art once, then try again.`
    );
  }

  const result = await addUsernamesToGroup({
    groupName: "finalists",
    usernames: [username],
  });
  if (!result.ok) {
    throw new Error(`Discourse grant failed: ${result.error}`);
  }

  void logHostAction({
    actor: me,
    actionLabel: "grant_finalists_demo",
    subject: user.id,
    targetUserId: user.id,
    targetEmail: user.email,
    targetName: user.name,
    previousValue: "(not in finalists group)",
    newValue: "finalists",
    details: `Demo override: added @${username} to Discourse finalists group via API.`,
  });

  revalidatePath("/host/forum-roles");
}
