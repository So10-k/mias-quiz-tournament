import Link from "next/link";
import { Stage } from "@/components/Stage";
import { requireStaff } from "@/lib/staff-auth";
import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";
import { ALL_ROLES, describeRole } from "@/lib/staff-permissions";
import { logStaffAction } from "@/lib/staff-audit";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function setRoleAction(formData: FormData) {
  "use server";
  const me = await requireStaff({
    next: "/staff/staff",
    permission: "staff:write",
  });
  const targetId = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  // Only allow the built-in roles plus the legacy "staff" bootstrap value.
  // Reject anything else so a bad form post can't write garbage that
  // silently falls back to viewer permissions.
  const allowed = new Set([...ALL_ROLES, "staff"]);
  if (!targetId || !allowed.has(role)) {
    await logStaffAction({
      actor: { id: me.id, email: me.email },
      action: "staff.role_change_blocked",
      target: targetId || "—",
      details: { reason: "invalid-role", attemptedRole: role },
    });
    revalidatePath("/staff/staff");
    return;
  }
  if (targetId === me.id && role !== "admin") {
    // Don't let an admin demote themselves and lock the team out.
    await logStaffAction({
      actor: { id: me.id, email: me.email },
      action: "staff.role_change_blocked",
      target: targetId,
      details: { reason: "self-demote", attemptedRole: role },
    });
    revalidatePath("/staff/staff");
    return;
  }
  const [target] = await db
    .select()
    .from(schema.staffUsers)
    .where(eq(schema.staffUsers.id, targetId))
    .limit(1);
  if (!target) return;
  await db
    .update(schema.staffUsers)
    .set({ role })
    .where(eq(schema.staffUsers.id, targetId));
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "staff.role_changed",
    target: target.email,
    details: { from: target.role, to: role },
  });
  revalidatePath("/staff/staff");
}

async function revokeSessionsAction(formData: FormData) {
  "use server";
  const me = await requireStaff({
    next: "/staff/staff",
    permission: "staff:write",
  });
  const targetId = String(formData.get("id") ?? "");
  if (!targetId) return;
  const [target] = await db
    .select()
    .from(schema.staffUsers)
    .where(eq(schema.staffUsers.id, targetId))
    .limit(1);
  if (!target) return;
  await db
    .delete(schema.staffSessions)
    .where(eq(schema.staffSessions.staffUserId, targetId));
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "staff.sessions_revoked",
    target: target.email,
  });
  revalidatePath("/staff/staff");
}

export default async function StaffManagementPage() {
  const me = await requireStaff({
    next: "/staff/staff",
    permission: "staff:read",
  });

  const users = await db
    .select()
    .from(schema.staffUsers)
    .orderBy(desc(schema.staffUsers.lastLoginAt));

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">👥 Staff & roles</h1>
          <Link href="/staff" className="pop pop-white text-sm">
            ← Overview
          </Link>
        </div>

        <section className="card-sm bg-white px-5 py-3">
          <p className="font-body text-xs text-navy-soft">
            Roles control what each staff member sees and does. Admins can
            change roles; editors can run the tournament; viewers (e.g.
            Mia) get read-only access. Provisioning is JIT — anyone in your
            Duo directory shows up here on their first sign-in as{" "}
            <code>viewer</code>.
          </p>
        </section>

        <section className="card px-3 py-3">
          {users.length === 0 ? (
            <p className="font-body text-sm text-navy-soft px-3 py-3">
              No staff yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-navy/10">
              {users.map((u) => {
                const isMe = u.id === me.id;
                return (
                  <li
                    key={u.id}
                    className="py-3 px-2 flex flex-wrap items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-base text-navy truncate">
                        {u.name ?? u.email}
                        {isMe ? (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-sun text-navy">
                            you
                          </span>
                        ) : null}
                      </p>
                      <p className="font-body text-xs text-navy-soft truncate">
                        {u.email} · {describeRole(u.role)}
                        {u.lastLoginAt
                          ? ` · last login ${new Date(
                              u.lastLoginAt
                            ).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}`
                          : " · never logged in"}
                      </p>
                    </div>
                    <form action={setRoleAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        className="card-sm px-2 py-1 text-sm font-body"
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                        {!ALL_ROLES.includes(u.role as "admin") &&
                        u.role !== "admin" &&
                        u.role !== "editor" &&
                        u.role !== "viewer" ? (
                          <option value={u.role}>{u.role}</option>
                        ) : null}
                      </select>
                      <button className="pop pop-coral text-xs">Set</button>
                    </form>
                    <form action={revokeSessionsAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <button
                        className="pop pop-white text-xs"
                        title="Force this user to re-authenticate"
                      >
                        Sign out
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card-sm bg-white px-5 py-3">
          <p className="font-body text-xs text-navy-soft">
            Roles in this build:
          </p>
          <ul className="font-body text-xs text-navy mt-1 list-disc pl-5">
            <li>
              <strong>admin</strong> — full power: bracket, players, predictions,
              emails, staff, audit.
            </li>
            <li>
              <strong>editor</strong> — runs the tournament: bracket, players,
              predictions, emails. Can&rsquo;t change other staff or roles.
            </li>
            <li>
              <strong>viewer</strong> — read-only: bracket, players, standings,
              predictions, emails, visitors. Mia&rsquo;s default.
            </li>
          </ul>
        </section>
      </div>
    </Stage>
  );
}
