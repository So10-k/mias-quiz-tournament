// DiscourseConnect entry point. Discourse 302s the user here when
// they click "Sign in" or "Sign up". We re-use the existing player
// Auth0 session (no new OIDC callback needed) and bounce them back
// to Discourse with a signed payload.
//
// Auth flow:
//   • If currentUser() resolves: build + sign response, 302 to
//     return_sso_url.
//   • If not signed in: 302 to /signin?next=<this URL preserved> so
//     after sign-in the user lands back here and the SSO completes.
//
// Required env: DISCOURSE_SSO_SECRET (matches the value set in
// Discourse admin → "discourse_connect_secret"). Recommend 64 hex
// chars from `openssl rand -hex 32`.

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import {
  verifyAndParseInbound,
  buildReturnRedirect,
  deriveUsername,
} from "@/lib/discourse-sso";
import { getBracketGroupsForUser } from "@/lib/discourse-groups";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sso = url.searchParams.get("sso");
  const sig = url.searchParams.get("sig");
  if (!sso || !sig) {
    return NextResponse.json(
      { error: "missing sso/sig" },
      { status: 400 }
    );
  }

  // Verify HMAC + decode the inbound nonce + return URL. Reject any
  // tampered payload up-front.
  let inbound;
  try {
    inbound = verifyAndParseInbound(sso, sig);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "invalid sso" },
      { status: 400 }
    );
  }

  const me = await currentUser();
  if (!me || !me.email) {
    // Bounce through sign-in. Preserve the full inbound URL so we end
    // up back here with the same nonce + return target after auth.
    const next = `/api/discourse/sso?sso=${encodeURIComponent(
      sso
    )}&sig=${encodeURIComponent(sig)}`;
    return NextResponse.redirect(
      new URL(`/signin?next=${encodeURIComponent(next)}`, req.url),
      302
    );
  }

  // Build the response payload. We deliberately do NOT push admin/
  // moderator from the quiz-site role into Discourse — those flags
  // are managed manually in Discourse's admin panel. Tying them to
  // `role === 'author'` previously caused every SSO login to re-
  // promote authors back to admin, which made testing as a regular
  // user impossible. The forum's `authors` group (granted via
  // /host/forum-roles + add_groups in the SSO payload) handles
  // category-level perms; Discourse-level admin/mod stays manual.
  const username = deriveUsername({ name: me.name, email: me.email });

  // Pull the avatar URL from the users table — SessionUser doesn't
  // carry it, but we want Discourse to refresh the avatar on every
  // login (so a profile pic change on the quiz site flows through).
  let avatarUrl: string | undefined;
  try {
    const [row] = await db
      .select({ image: schema.users.image })
      .from(schema.users)
      .where(eq(schema.users.id, me.id))
      .limit(1);
    avatarUrl = row?.image ?? undefined;
  } catch {
    // Avatar is non-essential — let the SSO continue without it.
  }

  // Compute everything bracket-derived in one pass: groups (auto +
  // manual), title, primary group, and custom_fields stats. Failures
  // never block sign-in — they just degrade to a vanilla SSO payload.
  let addGroups: string | undefined;
  let removeGroups: string | undefined;
  let title: string | undefined;
  let primaryGroupName: string | undefined;
  let customFields: Record<string, string | number | boolean> | undefined;
  try {
    const result = await getBracketGroupsForUser(me.id);
    if (result.include.length) addGroups = result.include.join(",");
    if (result.exclude.length) removeGroups = result.exclude.join(",");
    title = result.title;
    primaryGroupName = result.primaryGroup ?? undefined;
    // custom_fields keys must match what the bridge plugin reads in
    // discourse/plugin/plugin.rb (DiscourseQuizbook::USER_FIELD_KEYS).
    customFields = {
      qb_total_wins: result.stats.totalWins,
      qb_total_matches: result.stats.totalMatches,
      qb_championships: result.stats.championships,
      qb_current_status: result.stats.currentStatus,
      qb_eliminated_in_round:
        result.stats.eliminatedInRound ?? "",
      qb_furthest_round: result.stats.furthestRound ?? "",
      qb_prediction_count: result.stats.predictionCount,
      qb_qotd_answers: result.stats.qotdAnswers,
      qb_rank_title: result.stats.rankTitle,
      qb_rank_group: result.stats.rankGroup,
      qb_synced_at: new Date().toISOString(),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("discourse-sso: identity computation failed:", err);
  }

  const target = buildReturnRedirect(inbound.return_sso_url, {
    nonce: inbound.nonce,
    email: me.email,
    external_id: me.id,
    username,
    name: me.name ?? undefined,
    avatar_url: avatarUrl,
    suppress_welcome_message: true,
    require_activation: false,
    add_groups: addGroups,
    remove_groups: removeGroups,
    // Send `groups` too — used by Discourse when
    // discourse_connect_overrides_groups is true (sync mode).
    // In incremental mode (override=false), Discourse ignores it.
    groups: addGroups,
    title,
    primary_group_name: primaryGroupName,
    custom_fields: customFields,
  });

  return NextResponse.redirect(target, 302);
}
