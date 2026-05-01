import Link from "next/link";
import { Stage } from "@/components/Stage";
import { AutoRefresh } from "@/components/AutoRefresh";
import { requireStaff } from "@/lib/staff-auth";
import { describeRole, staffCan } from "@/lib/staff-permissions";
import { db, schema } from "@/db";
import { desc, eq, gte, sql } from "drizzle-orm";
import {
  getActiveTournament,
  getLatestTournament,
  getRoundsForTournament,
  getCast,
} from "@/lib/engine";

export const dynamic = "force-dynamic";

type FeedItem = {
  ts: Date;
  kind: "action" | "attempt" | "visit" | "email" | "click";
  title: string;
  detail: string;
  who?: string;
};

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d2 = Math.floor(h / 24);
  return `${d2}d ago`;
}

export default async function StaffHome({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const me = await requireStaff({ next: "/staff" });
  const sp = await searchParams;
  const denied = sp.denied;

  const role = me.role;
  const canViewVisitors = staffCan(role, "visitors:read");
  const canViewAttempts = staffCan(role, "attempts:read");
  const canViewEmails = staffCan(role, "emails:read");
  const canViewAudit = staffCan(role, "audit:read");
  const canViewBracket = staffCan(role, "bracket:read");
  const canControl =
    staffCan(role, "bracket:write") || staffCan(role, "players:write");
  const canViewPlayers = staffCan(role, "players:read");
  const canViewPredictions = staffCan(role, "predictions:read");
  const canManageStaff = staffCan(role, "staff:read");

  // Tournament summary.
  const t =
    (await getActiveTournament()) ?? (await getLatestTournament());
  const rounds = t ? await getRoundsForTournament(t.id) : [];
  const cast = t ? await getCast(t.id) : [];
  const activeRound = rounds.find((r) => r.status === "active");
  const playersTotal = cast.length;
  const playersLeft = cast.filter((c) => !c.enrollment.eliminatedAt).length;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Live feed inputs — pull only what each role can see.
  const [recentActions, recentAttempts, recentVisits, recentEmails, recentClicks] =
    await Promise.all([
      canViewAudit
        ? db
            .select()
            .from(schema.staffActions)
            .orderBy(desc(schema.staffActions.createdAt))
            .limit(20)
        : Promise.resolve([] as (typeof schema.staffActions.$inferSelect)[]),
      canViewAttempts
        ? db
            .select({
              id: schema.attempts.id,
              userId: schema.attempts.userId,
              roundId: schema.attempts.roundId,
              score: schema.attempts.score,
              submittedAt: schema.attempts.submittedAt,
              userName: schema.users.name,
              userEmail: schema.users.email,
            })
            .from(schema.attempts)
            .innerJoin(
              schema.users,
              eq(schema.users.id, schema.attempts.userId)
            )
            .orderBy(desc(schema.attempts.submittedAt))
            .limit(15)
        : Promise.resolve(
            [] as Array<{
              id: string;
              userId: string;
              roundId: string;
              score: unknown;
              submittedAt: Date | null;
              userName: string | null;
              userEmail: string | null;
            }>
          ),
      canViewVisitors
        ? db
            .select()
            .from(schema.visitLogs)
            .orderBy(desc(schema.visitLogs.createdAt))
            .limit(15)
        : Promise.resolve([] as (typeof schema.visitLogs.$inferSelect)[]),
      canViewEmails
        ? db
            .select()
            .from(schema.emailSends)
            .orderBy(desc(schema.emailSends.sentAt))
            .limit(10)
        : Promise.resolve([] as (typeof schema.emailSends.$inferSelect)[]),
      canViewEmails
        ? db
            .select()
            .from(schema.emailClicks)
            .orderBy(desc(schema.emailClicks.clickedAt))
            .limit(10)
        : Promise.resolve([] as (typeof schema.emailClicks.$inferSelect)[]),
    ]);

  // 24h counts (one query each, cheap on Neon HTTP).
  const [visits24, emails24, clicks24, attempts24] = await Promise.all([
    canViewVisitors
      ? db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.visitLogs)
          .where(gte(schema.visitLogs.createdAt, since))
      : Promise.resolve([{ c: 0 }]),
    canViewEmails
      ? db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.emailSends)
          .where(gte(schema.emailSends.sentAt, since))
      : Promise.resolve([{ c: 0 }]),
    canViewEmails
      ? db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.emailClicks)
          .where(gte(schema.emailClicks.clickedAt, since))
      : Promise.resolve([{ c: 0 }]),
    canViewAttempts
      ? db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.attempts)
          .where(gte(schema.attempts.submittedAt, since))
      : Promise.resolve([{ c: 0 }]),
  ]);

  // Merge into a unified feed and sort newest first.
  const feed: FeedItem[] = [];
  for (const a of recentActions) {
    feed.push({
      ts: a.createdAt,
      kind: "action",
      title: `🛠️ ${a.action}`,
      detail: a.target ?? "",
      who: a.staffEmail,
    });
  }
  for (const a of recentAttempts) {
    if (!a.submittedAt) continue;
    feed.push({
      ts: a.submittedAt,
      kind: "attempt",
      title: "📝 attempt submitted",
      detail: `score ${Number(a.score ?? 0).toFixed(2)}`,
      who: a.userName ?? a.userEmail ?? "—",
    });
  }
  for (const v of recentVisits) {
    feed.push({
      ts: v.createdAt,
      kind: "visit",
      title: "👀 visit",
      detail: `${v.path}${v.country ? ` · ${v.country}` : ""}`,
      who: v.userId ?? v.fingerprint.slice(0, 6),
    });
  }
  for (const e of recentEmails) {
    feed.push({
      ts: e.sentAt,
      kind: "email",
      title: "📨 email sent",
      detail: e.subject,
      who: e.recipientEmail,
    });
  }
  for (const c of recentClicks) {
    feed.push({
      ts: c.clickedAt,
      kind: "click",
      title: "🖱️ email click",
      detail: c.originalUrl.slice(0, 80),
    });
  }
  feed.sort((a, b) => b.ts.getTime() - a.ts.getTime());
  const feedTrimmed = feed.slice(0, 40);

  return (
    <Stage scrollable>
      <AutoRefresh seconds={20} />
      <div className="max-w-5xl mx-auto pt-4 px-4 flex flex-col gap-5 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl text-navy">
              🛡️ Staff Overview
            </h1>
            <p className="font-body text-xs text-navy-soft mt-1">
              Live feed · auto-refreshes every 20s.
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-sm text-navy">
              {me.name ?? me.email}
            </p>
            <p className="font-body text-xs text-navy-soft">
              {describeRole(role)}
            </p>
          </div>
        </div>

        {denied ? (
          <div className="card-sm bg-coral text-white px-5 py-3">
            <p className="font-display text-sm">
              ⛔ You don&rsquo;t have permission for{" "}
              <code className="bg-coral-deep px-1.5 py-0.5 rounded">
                {denied}
              </code>
              . Ask an admin to upgrade your role.
            </p>
          </div>
        ) : null}

        {/* Tournament summary */}
        <section className="card px-5 py-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <p className="font-display text-sm text-coral-deep uppercase tracking-widest">
                {t ? "Tournament" : "No tournament"}
              </p>
              <p className="font-display text-2xl text-navy mt-1">
                {t?.title ?? "—"}
              </p>
              {activeRound ? (
                <p className="font-body text-sm text-navy-soft mt-1">
                  📖 Chapter {activeRound.chapterNumber}
                  {activeRound.title ? ` · ${activeRound.title}` : ""} ·{" "}
                  open
                </p>
              ) : (
                <p className="font-body text-sm text-navy-soft mt-1">
                  No round currently open.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Stat label="Players" value={playersTotal} />
              <Stat label="Still in" value={playersLeft} />
              {canViewAttempts ? (
                <Stat label="Attempts 24h" value={attempts24[0]?.c ?? 0} />
              ) : null}
              {canViewVisitors ? (
                <Stat label="Visits 24h" value={visits24[0]?.c ?? 0} />
              ) : null}
              {canViewEmails ? (
                <Stat label="Emails 24h" value={emails24[0]?.c ?? 0} />
              ) : null}
              {canViewEmails ? (
                <Stat label="Clicks 24h" value={clicks24[0]?.c ?? 0} />
              ) : null}
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="card px-5 py-5">
          <h2 className="font-display text-xl text-navy mb-3">Jump to</h2>
          <div className="flex flex-wrap gap-2">
            {canControl ? (
              <Link href="/staff/control" className="pop pop-yellow text-sm">
                🛠️ Control panel
              </Link>
            ) : null}
            {canViewBracket ? (
              <Link href="/staff/bracket" className="pop pop-coral text-sm">
                🏆 Bracket
              </Link>
            ) : null}
            {canViewPlayers ? (
              <Link href="/staff/players" className="pop pop-yellow text-sm">
                👥 Players
              </Link>
            ) : null}
            <Link href="/staff/standings" className="pop pop-grass text-sm">
              📊 Standings
            </Link>
            {canViewPredictions ? (
              <Link
                href="/staff/predictions"
                className="pop pop-sky text-sm"
              >
                🔮 Predictions
              </Link>
            ) : null}
            {canViewAttempts ? (
              <Link href="/staff/attempts" className="pop pop-white text-sm">
                📝 Attempts
              </Link>
            ) : null}
            {canViewEmails ? (
              <Link href="/staff/emails" className="pop pop-white text-sm">
                📨 Emails
              </Link>
            ) : null}
            {canViewVisitors ? (
              <Link href="/staff/visitors" className="pop pop-white text-sm">
                👀 Visitors
              </Link>
            ) : null}
            {canViewAudit ? (
              <Link href="/staff/audit" className="pop pop-white text-sm">
                📜 Audit log
              </Link>
            ) : null}
            {canManageStaff ? (
              <Link
                href="/staff/staff"
                className="pop pop-yellow text-sm"
              >
                👥 Manage staff
              </Link>
            ) : null}
          </div>
        </section>

        {/* Live feed */}
        <section className="card px-5 py-5">
          <h2 className="font-display text-xl text-navy mb-3">Live feed</h2>
          {feedTrimmed.length === 0 ? (
            <p className="font-body text-sm text-navy-soft">
              Quiet. Nothing to show yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-navy/10">
              {feedTrimmed.map((f, i) => (
                <li
                  key={`${f.kind}-${i}-${f.ts.getTime()}`}
                  className="py-2 flex items-baseline gap-3"
                >
                  <span className="font-display text-sm text-navy w-32 shrink-0">
                    {f.title}
                  </span>
                  <span className="font-body text-sm text-navy-soft flex-1 min-w-0 truncate">
                    {f.detail}
                  </span>
                  {f.who ? (
                    <span className="font-body text-xs text-navy-soft truncate max-w-[40%]">
                      {f.who}
                    </span>
                  ) : null}
                  <span className="font-body text-xs text-navy-soft w-20 text-right shrink-0">
                    {timeAgo(f.ts)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Stage>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-sm bg-white px-3 py-2 text-center min-w-[5rem]">
      <p className="font-display text-2xl text-navy leading-none">{value}</p>
      <p className="font-body text-[10px] text-navy-soft uppercase tracking-widest mt-1">
        {label}
      </p>
    </div>
  );
}
