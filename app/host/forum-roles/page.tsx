// Host page for managing manual forum-group memberships. Each row
// is one user; columns are the four grantable groups. Saving a row
// writes via setForumGroupsForUser (diff-applies adds + removes);
// the user's actual Discourse memberships sync on their NEXT login
// via the SSO add_groups/remove_groups payload.
//
// Author-gated (currentUser().role === 'author'). Anyone else gets
// bounced to the homepage.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { db, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import {
  listAllGrants,
  MANUAL_FORUM_GROUPS,
  FORUM_GROUP_META,
} from "@/lib/forum-grants";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import {
  saveUserRolesAction,
  grantFinalistsForDemoAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function ForumRolesPage() {
  const me = await currentUser();
  if (!me) redirect("/signin?next=/host/forum-roles");
  if (me.role !== "author") redirect("/");

  const t = (await getActiveTournament()) ?? (await getLatestTournament());

  const [users, enrollments, grants] = await Promise.all([
    // EVERY signed-up account, not just tournament-enrolled players.
    // Mia, Sam, test accounts, family lurkers — all show here so any
    // user can be granted manual forum roles.
    db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
      })
      .from(schema.users)
      .orderBy(asc(schema.users.email)),
    // Enrollment lookup — used to badge each row "in the tournament"
    // vs "spectator only" so you can tell at a glance.
    t
      ? db
          .select({
            userId: schema.enrollments.userId,
            eliminatedAt: schema.enrollments.eliminatedAt,
          })
          .from(schema.enrollments)
          .where(eq(schema.enrollments.tournamentId, t.id))
      : Promise.resolve([] as { userId: string; eliminatedAt: Date | null }[]),
    listAllGrants(),
  ]);

  const enrollByUserId = new Map<string, Date | null>();
  for (const e of enrollments) enrollByUserId.set(e.userId, e.eliminatedAt);

  return (
    <Stage scrollable>
      <div className="max-w-5xl mx-auto pt-4 px-4 pb-12 flex flex-col gap-4">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-2xl text-navy">
            🛡️ Forum roles
          </h1>
          <Link href="/host" className="pop pop-white text-sm">
            ← Host
          </Link>
        </div>

        <div className="card px-5 py-4">
          <p className="font-body text-sm text-navy">
            Grant manual forum groups (mod tiers, recognition badges)
            to any user. Changes apply on the user&rsquo;s <strong>next
            forum sign-in</strong> — the SSO bridge re-syncs every
            login.
          </p>
          <p className="font-body text-xs text-navy-soft mt-2">
            Bracket-derived groups (<code>players</code> /{" "}
            <code>spectators</code> / <code>semi_finalists</code> /{" "}
            <code>finalists</code>) are auto-managed and aren&rsquo;t
            shown here — they update automatically as the bracket
            resolves.
          </p>
        </div>

        {/* Demo override: force a user into the Discourse `finalists`
            group via the admin API. Use sparingly — bypasses the
            bracket-derived auto-sync. */}
        <div className="card px-5 py-4 border-3 border-coral-deep">
          <h2 className="font-display text-base text-navy">
            🧪 Demo override · grant <code>finalists</code> by email
          </h2>
          <p className="font-body text-xs text-navy-soft mt-1">
            For demos / accounts that aren&rsquo;t actually in the
            bracket. Calls Discourse admin API directly + stamps the
            NDA timestamp. The user must have signed into{" "}
            <code>discuss.miaswebsites.art</code> at least once already.
          </p>
          <form
            action={grantFinalistsForDemoAction}
            className="mt-3 flex flex-wrap gap-2 items-center"
          >
            <input
              name="email"
              type="email"
              placeholder="user@example.com"
              required
              className="card-sm bg-white px-3 py-1.5 text-sm font-body border-2 border-navy min-w-[280px]"
            />
            <button className="pop pop-coral text-sm">
              🧪 Grant finalists
            </button>
          </form>
        </div>

        {/* Legend explaining each role. */}
        <div className="card px-5 py-4">
          <h2 className="font-display text-base text-navy mb-2">
            What each role does
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {MANUAL_FORUM_GROUPS.map((g) => {
              const meta = FORUM_GROUP_META[g];
              return (
                <div
                  key={g}
                  className="card-sm bg-white px-3 py-2 flex gap-2 items-start"
                >
                  <span
                    className="font-display text-xs px-2 py-0.5 rounded-full border-2 border-navy shrink-0"
                    style={{
                      background: meta.color,
                      color: g === "honorary_mods" || g === "regulars" ? "#1B2A4E" : "#FFFFFF",
                    }}
                  >
                    {meta.icon} {meta.label}
                  </span>
                  <p className="font-body text-xs text-navy-soft leading-snug flex-1">
                    {meta.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card px-2 py-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="font-display text-xs uppercase tracking-wider text-navy-soft">
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-2 py-2 text-left">Tournament</th>
                {MANUAL_FORUM_GROUPS.map((g) => (
                  <th key={g} className="px-2 py-2 text-center">
                    <span title={FORUM_GROUP_META[g].description}>
                      {FORUM_GROUP_META[g].icon} {FORUM_GROUP_META[g].label}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Save</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const userGrants = grants.get(u.id) ?? new Set();
                const enrolled = enrollByUserId.has(u.id);
                const eliminatedAt = enrollByUserId.get(u.id);
                let badge: { text: string; bg: string; fg: string };
                if (!enrolled) {
                  badge = {
                    text: "spectator",
                    bg: "#B7E5FF",
                    fg: "#1B2A4E",
                  };
                } else if (eliminatedAt) {
                  badge = {
                    text: "eliminated",
                    bg: "#3B4A7E",
                    fg: "#FFFFFF",
                  };
                } else {
                  badge = {
                    text: "still in",
                    bg: "#4FB04F",
                    fg: "#FFFFFF",
                  };
                }
                return (
                  <tr
                    key={u.id}
                    className="border-t-2 border-navy/10 hover:bg-sky1/30"
                  >
                    <form action={saveUserRolesAction} className="contents">
                      <input type="hidden" name="userId" value={u.id} />
                      <td className="px-3 py-2">
                        <p className="font-display text-sm text-navy">
                          {u.name ?? "(no name)"}
                          {u.role === "author" ? (
                            <span className="ml-2 font-body text-[10px] text-coral-deep uppercase tracking-wider">
                              site author
                            </span>
                          ) : null}
                        </p>
                        <p className="font-body text-xs text-navy-soft truncate">
                          {u.email}
                        </p>
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className="font-display text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border-2 border-navy"
                          style={{
                            background: badge.bg,
                            color: badge.fg,
                          }}
                        >
                          {badge.text}
                        </span>
                      </td>
                      {MANUAL_FORUM_GROUPS.map((g) => (
                        <td key={g} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            name={`role:${g}`}
                            value="1"
                            defaultChecked={userGrants.has(g)}
                            className="w-5 h-5 accent-coral-deep"
                            aria-label={FORUM_GROUP_META[g].label}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <button
                          type="submit"
                          className="pop pop-coral text-xs px-3 py-1"
                        >
                          Save row
                        </button>
                      </td>
                    </form>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="font-body text-xs text-navy-soft text-center">
          {users.length} signed-up user{users.length === 1 ? "" : "s"} ·{" "}
          {enrollByUserId.size} enrolled in the tournament ·{" "}
          {grants.size} with manual roles
        </p>
      </div>
    </Stage>
  );
}
