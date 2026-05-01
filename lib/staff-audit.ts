// Helper for writing staff_actions audit-log rows.
//
// Every protected staff action should call `logStaffAction` so we have a
// durable record of who did what. The dashboard reads from this table to
// show the live event feed.
//
// `actor` is optional — if omitted, the helper resolves the current staff
// session. Pass it explicitly when you've already resolved the user (e.g.
// in a server action that did its own permission check) to avoid a second
// cookie + DB roundtrip.

import { db, schema } from "@/db";
import { id as makeId } from "@/lib/ids";
import { getStaffUser } from "@/lib/staff-auth";

type Actor = {
  id: string;
  email: string;
};

export type StaffActionInput = {
  action: string;
  target?: string | null;
  details?: Record<string, unknown> | null;
  actor?: Actor | null;
};

export async function logStaffAction(input: StaffActionInput): Promise<void> {
  let actor = input.actor ?? null;
  if (!actor) {
    const me = await getStaffUser();
    if (!me) {
      // Best-effort: log a `system` row rather than throwing. Better to
      // have an action recorded with a vague actor than to drop it.
      await db.insert(schema.staffActions).values({
        id: makeId(),
        staffUserId: null,
        staffEmail: "system@internal",
        action: input.action,
        target: input.target ?? null,
        details: input.details ?? null,
      });
      return;
    }
    actor = { id: me.id, email: me.email };
  }
  await db.insert(schema.staffActions).values({
    id: makeId(),
    staffUserId: actor.id,
    staffEmail: actor.email,
    action: input.action,
    target: input.target ?? null,
    details: input.details ?? null,
  });
}

// Tiny convenience for routes that do many actions on one request.
export function makeAuditLogger(actor: Actor) {
  return (input: Omit<StaffActionInput, "actor">) =>
    logStaffAction({ ...input, actor });
}
