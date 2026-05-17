// Mirror staff actions on the quiz site into the Discourse
// /admin/logs/staff_action_logs panel. The Discourse plugin exposes
// /quizbook/staff-log.json which accepts an HMAC-signed POST and
// inserts a UserHistory row.
//
// Why this exists: every meaningful host action (set winner, generate
// bracket, end tournament, swap seed, change role, etc.) should be
// auditable in one place. We already use Discourse as the
// admin/staff hub for the forum; piping main-site actions there
// keeps the audit trail unified instead of split across two systems.
//
// Auth model: the same DISCOURSE_SSO_SECRET that signs SSO payloads.
// One secret means one rotation. We sign the raw JSON body with
// HMAC-SHA256 and put the hex digest in `X-Quizbook-Signature`.
//
// Failure mode: fire-and-forget. If Discourse is down or the request
// fails, we log to console and move on — never throw, never block
// the host action that triggered the call.

import { createHmac } from "node:crypto";
import { deriveUsername } from "@/lib/discourse-sso";

export type StaffLogEntry = {
  // What the actor did, in stable verb_object snake_case:
  // "set_match_winner", "generate_bracket", "close_round", etc.
  // Surfaces as the row's primary label in /admin/logs/...
  actionLabel: string;
  // Quiz-site user id of the person who took the action. We resolve
  // it to a Discourse username server-side via deriveUsername(); if
  // the user has never logged into the forum, the row is attributed
  // to the system account and `acting_username` is preserved in
  // details for traceability.
  actorUserId: string;
  actorEmail: string;
  actorName?: string | null;
  // Optional target user (the recipient of the action — e.g. winner
  // of the matchup, user being granted a role).
  targetUserId?: string | null;
  targetEmail?: string | null;
  targetName?: string | null;
  // Short freeform identifier — matchup id, tournament slug, etc.
  // Discourse renders this in the "Subject" column.
  subject?: string;
  // Multi-line context. Renders in the row's expanded view.
  details?: string;
  previousValue?: string;
  newValue?: string;
  // De-dupe key. If two calls arrive with the same key, the second
  // returns the first row's id without creating a duplicate.
  idempotencyKey?: string;
};

function discourseBase(): string {
  return process.env.DISCOURSE_BASE_URL ?? "https://discuss.miaswebsites.art";
}

function ssoSecret(): string | null {
  return process.env.DISCOURSE_SSO_SECRET ?? null;
}

// Fire-and-forget: returns void, swallows + logs errors. Callers
// should `void logStaffAction({...})` to make the no-await explicit.
export async function logStaffAction(entry: StaffLogEntry): Promise<void> {
  const secret = ssoSecret();
  if (!secret) {
    // No secret configured = bridge disabled. Fine in local dev.
    return;
  }
  try {
    const actingUsername =
      entry.actorEmail
        ? deriveUsername({ name: entry.actorName, email: entry.actorEmail })
        : "system";
    const targetUsername =
      entry.targetEmail
        ? deriveUsername({ name: entry.targetName, email: entry.targetEmail })
        : undefined;

    const body = JSON.stringify({
      acting_username: actingUsername,
      action_label: entry.actionLabel,
      target_username: targetUsername,
      subject: entry.subject,
      details: entry.details,
      previous_value: entry.previousValue,
      new_value: entry.newValue,
      idempotency_key: entry.idempotencyKey,
    });

    const signature = createHmac("sha256", secret).update(body).digest("hex");

    const res = await fetch(`${discourseBase()}/quizbook/staff-log.json`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "X-Quizbook-Signature": signature,
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      // eslint-disable-next-line no-console
      console.error(
        "discourse staff-log non-200:",
        res.status,
        text.slice(0, 200)
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("discourse staff-log fetch failed:", err);
  }
}

// Convenience wrapper that grabs the actor from the current session.
// Most host actions already call `requireHost()` and have access to
// the SessionUser — pass it in directly.
export async function logHostAction(args: {
  actor: { id: string; email: string | null; name: string | null };
  actionLabel: string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  targetName?: string | null;
  subject?: string;
  details?: string;
  previousValue?: string;
  newValue?: string;
  idempotencyKey?: string;
}): Promise<void> {
  if (!args.actor.email) return;
  return logStaffAction({
    actionLabel: args.actionLabel,
    actorUserId: args.actor.id,
    actorEmail: args.actor.email,
    actorName: args.actor.name,
    targetUserId: args.targetUserId,
    targetEmail: args.targetEmail,
    targetName: args.targetName,
    subject: args.subject,
    details: args.details,
    previousValue: args.previousValue,
    newValue: args.newValue,
    idempotencyKey: args.idempotencyKey,
  });
}
