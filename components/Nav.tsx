import Link from "next/link";
import { headers } from "next/headers";
import { currentUser } from "@/lib/session";
import { AUTHOR_NAME } from "@/lib/author";
import { getPredictionsSettings } from "@/lib/predictions";
import { getStaffUser } from "@/lib/staff-auth";
import { staffCan } from "@/lib/staff-permissions";
import { signOutEverywhereAction } from "@/app/actions/signout";
import { MobileNavMenu } from "./MobileNavMenu";

const linkBase = "pop pop-white text-base px-3 py-2 rounded-xl";
// Mobile-drawer rows are styled to be tap-friendly: full-width, larger,
// no need to fit a horizontal row.
const drawerLink =
  "pop pop-white text-base w-full text-left px-4 py-3 rounded-xl";

async function isStaffSubdomain(): Promise<boolean> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return host.startsWith("staff.");
}

export async function Nav() {
  if (await isStaffSubdomain()) return <StaffNav />;
  return <PlayerNav />;
}

async function PlayerNav() {
  const user = await currentUser();
  const isHost = user?.role === "author";
  const predictions = await getPredictionsSettings();
  const showPredictLink = !!user && (predictions.enabled || isHost);

  // The link list — server-rendered once and used in BOTH the desktop
  // inline row AND the mobile drawer (passed to MobileNavMenu as children).
  // For each surface we apply slightly different classes so the drawer
  // rows feel like full-width buttons rather than chiclets.
  const inlineLinks = (
    <>
      <Link href="/" className={linkBase}>Home</Link>
      {user ? (
        <Link href="/play" className={linkBase}>Play</Link>
      ) : (
        <Link
          href="/signin"
          className="pop pop-coral text-base px-3 py-2 rounded-xl"
        >
          Sign In
        </Link>
      )}
      <Link href="/bracket" className={linkBase}>Bracket</Link>
      <Link href="/players" className={linkBase}>Players</Link>
      <Link href="/standings" className={linkBase}>Standings</Link>
      {showPredictLink ? (
        <Link
          href="/predict"
          className="pop pop-coral text-base px-3 py-2 rounded-xl"
        >
          🔮 Predict
        </Link>
      ) : null}
      {user ? (
        <Link
          href="/miamail"
          className="pop pop-sky text-base px-3 py-2 rounded-xl"
        >
          📬 Miamail
        </Link>
      ) : null}
      {isHost ? (
        <Link
          href="/host"
          className="pop pop-yellow text-base px-3 py-2 rounded-xl"
        >
          🛠️ Host
        </Link>
      ) : null}
      {user ? (
        <form action={signOutEverywhereAction}>
          <button
            type="submit"
            className="pop pop-white text-base px-3 py-2 rounded-xl"
            title="Sign out of the site and Auth0"
          >
            Sign out
          </button>
        </form>
      ) : null}
    </>
  );

  const drawerLinks = (
    <>
      <Link href="/" className={drawerLink}>🏠 Home</Link>
      {user ? (
        <Link href="/play" className={drawerLink}>▶️ Play</Link>
      ) : (
        <Link
          href="/signin"
          className="pop pop-coral text-base w-full text-left px-4 py-3 rounded-xl"
        >
          🔐 Sign In
        </Link>
      )}
      <Link href="/bracket" className={drawerLink}>🏆 Bracket</Link>
      <Link href="/players" className={drawerLink}>👥 Players</Link>
      <Link href="/standings" className={drawerLink}>📊 Standings</Link>
      {showPredictLink ? (
        <Link
          href="/predict"
          className="pop pop-coral text-base w-full text-left px-4 py-3 rounded-xl"
        >
          🔮 Predict
        </Link>
      ) : null}
      {user ? (
        <Link
          href="/miamail"
          className="pop pop-sky text-base w-full text-left px-4 py-3 rounded-xl"
        >
          📬 Miamail
        </Link>
      ) : null}
      {isHost ? (
        <Link
          href="/host"
          className="pop pop-yellow text-base w-full text-left px-4 py-3 rounded-xl"
        >
          🛠️ Host
        </Link>
      ) : null}
      {user ? (
        <form action={signOutEverywhereAction} className="mt-2">
          <button
            type="submit"
            className="pop pop-white text-base w-full text-left px-4 py-3 rounded-xl"
          >
            🚪 Sign out
          </button>
        </form>
      ) : null}
    </>
  );

  return (
    <header className="relative z-20 px-4 md:px-7 pt-4">
      {/* Mobile bar — hamburger left, brand centered, balance space right */}
      <nav className="card-sm flex md:hidden items-center px-3 py-2">
        <MobileNavMenu>{drawerLinks}</MobileNavMenu>
        <Link
          href="/"
          className="flex-1 flex items-center justify-center gap-2 font-display text-lg text-navy hover:text-coral transition-colors"
        >
          <span className="text-2xl">🌞</span>
          <span>{AUTHOR_NAME}&rsquo;s Quiz</span>
        </Link>
        {/* Spacer with the same width as the hamburger so the brand is
            visually centered, not just space-betweened. */}
        <span aria-hidden className="w-10 h-10 shrink-0" />
      </nav>

      {/* Desktop bar — brand left, link list right */}
      <nav className="card-sm hidden md:flex items-center justify-between gap-2 px-5 py-3">
        <Link
          href="/"
          className="font-display text-xl text-navy hover:text-coral transition-colors flex items-center gap-2"
        >
          <span className="text-2xl">🌞</span>
          <span>{AUTHOR_NAME}&rsquo;s Quiz</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">{inlineLinks}</div>
      </nav>
    </header>
  );
}

async function StaffNav() {
  const me = await getStaffUser();
  const role = me?.role ?? null;
  const canViewBracket = staffCan(role, "bracket:read");
  const canControl =
    staffCan(role, "bracket:write") || staffCan(role, "players:write");
  const canViewPlayers = staffCan(role, "players:read");
  const canViewStandings = staffCan(role, "standings:read");
  const canViewVisitors = staffCan(role, "visitors:read");
  const canViewPredictions = staffCan(role, "predictions:read");
  const canViewEmails = staffCan(role, "emails:read");
  const canViewAttempts = staffCan(role, "attempts:read");
  const canViewForms = staffCan(role, "forms:read");
  const canManageStaff = staffCan(role, "staff:read");
  const canViewAudit = staffCan(role, "audit:read");

  const inlineLinks = me ? (
    <>
      <Link href="/staff" className={linkBase}>Overview</Link>
      {canControl ? (
        <Link
          href="/staff/control"
          className="pop pop-yellow text-base px-3 py-2 rounded-xl"
        >
          🛠️ Control
        </Link>
      ) : null}
      {canViewBracket ? (
        <Link href="/staff/bracket" className={linkBase}>Bracket</Link>
      ) : null}
      {canViewPlayers ? (
        <Link href="/staff/players" className={linkBase}>Players</Link>
      ) : null}
      {canViewStandings ? (
        <Link href="/staff/standings" className={linkBase}>Standings</Link>
      ) : null}
      {canViewPredictions ? (
        <Link href="/staff/predictions" className={linkBase}>Predictions</Link>
      ) : null}
      {canViewAttempts ? (
        <Link href="/staff/attempts" className={linkBase}>Attempts</Link>
      ) : null}
      {canViewEmails ? (
        <Link href="/staff/emails" className={linkBase}>Emails</Link>
      ) : null}
      {canViewForms ? (
        <Link href="/staff/forms" className={linkBase}>Forms</Link>
      ) : null}
      {canViewVisitors ? (
        <Link href="/staff/visitors" className={linkBase}>Visitors</Link>
      ) : null}
      {canViewAudit ? (
        <Link href="/staff/audit" className={linkBase}>Audit</Link>
      ) : null}
      {canManageStaff ? (
        <Link
          href="/staff/staff"
          className="pop pop-yellow text-base px-3 py-2 rounded-xl"
        >
          👥 Staff
        </Link>
      ) : null}
      <span className="font-display text-xs text-navy-soft hidden md:inline px-2">
        {me.email}
      </span>
      <form action="/staff/signout" method="POST">
        <button
          type="submit"
          className="pop pop-coral text-base px-3 py-2 rounded-xl"
        >
          Sign out
        </button>
      </form>
    </>
  ) : (
    <Link
      href="/staff/signin"
      className="pop pop-coral text-base px-3 py-2 rounded-xl"
    >
      Sign in with MiaAuth Staff
    </Link>
  );

  const drawerLinks = me ? (
    <>
      <Link href="/staff" className={drawerLink}>🛡️ Overview</Link>
      {canControl ? (
        <Link
          href="/staff/control"
          className="pop pop-yellow text-base w-full text-left px-4 py-3 rounded-xl"
        >
          🛠️ Control panel
        </Link>
      ) : null}
      {canViewBracket ? (
        <Link href="/staff/bracket" className={drawerLink}>🏆 Bracket</Link>
      ) : null}
      {canViewPlayers ? (
        <Link href="/staff/players" className={drawerLink}>👥 Players</Link>
      ) : null}
      {canViewStandings ? (
        <Link href="/staff/standings" className={drawerLink}>📊 Standings</Link>
      ) : null}
      {canViewPredictions ? (
        <Link href="/staff/predictions" className={drawerLink}>🔮 Predictions</Link>
      ) : null}
      {canViewAttempts ? (
        <Link href="/staff/attempts" className={drawerLink}>📝 Attempts</Link>
      ) : null}
      {canViewEmails ? (
        <Link href="/staff/emails" className={drawerLink}>📨 Emails</Link>
      ) : null}
      {canViewForms ? (
        <Link href="/staff/forms" className={drawerLink}>📝 Forms</Link>
      ) : null}
      {canViewVisitors ? (
        <Link href="/staff/visitors" className={drawerLink}>👀 Visitors</Link>
      ) : null}
      {canViewAudit ? (
        <Link href="/staff/audit" className={drawerLink}>📜 Audit</Link>
      ) : null}
      {canManageStaff ? (
        <Link
          href="/staff/staff"
          className="pop pop-yellow text-base w-full text-left px-4 py-3 rounded-xl"
        >
          👥 Manage staff
        </Link>
      ) : null}
      <span className="font-body text-xs text-navy-soft px-1 mt-1 truncate">
        Signed in as {me.email}
      </span>
      <form action="/staff/signout" method="POST" className="mt-1">
        <button
          type="submit"
          className="pop pop-coral text-base w-full text-left px-4 py-3 rounded-xl"
        >
          🚪 Sign out
        </button>
      </form>
    </>
  ) : (
    <Link
      href="/staff/signin"
      className="pop pop-coral text-base w-full text-left px-4 py-3 rounded-xl"
    >
      🔐 Sign in with MiaAuth Staff
    </Link>
  );

  return (
    <header className="relative z-20 px-4 md:px-7 pt-4">
      {/* Mobile bar */}
      <nav className="card-sm flex md:hidden items-center px-3 py-2">
        <MobileNavMenu>{drawerLinks}</MobileNavMenu>
        <Link
          href="/staff"
          className="flex-1 flex items-center justify-center gap-2 font-display text-lg text-navy hover:text-coral transition-colors"
        >
          <span className="text-2xl">🛠️</span>
          <span>Staff</span>
        </Link>
        <span aria-hidden className="w-10 h-10 shrink-0" />
      </nav>
      {/* Desktop bar */}
      <nav className="card-sm hidden md:flex items-center justify-between gap-2 px-5 py-3">
        <Link
          href="/staff"
          className="font-display text-xl text-navy hover:text-coral transition-colors flex items-center gap-2"
        >
          <span className="text-2xl">🛠️</span>
          <span>Staff</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">{inlineLinks}</div>
      </nav>
    </header>
  );
}
