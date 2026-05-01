import Link from "next/link";
import { Stage } from "@/components/Stage";
import { BracketView } from "@/components/BracketView";
import { requireStaff } from "@/lib/staff-auth";
import { staffCan } from "@/lib/staff-permissions";
import {
  getActiveTournament,
  getLatestTournament,
  getRoundsForTournament,
  getCast,
} from "@/lib/engine";
import {
  getBracket,
  getBracketUsers,
  getBracketChampionId,
} from "@/lib/bracket";
import {
  ALL_LOCKABLE,
  getLockedPages,
  pageLabel,
} from "@/lib/page-locks";
import { getSiteTheme } from "@/lib/site-theme";
import { getActiveProvider } from "@/lib/email-provider";
import { getCountdown } from "@/lib/countdown-settings";
import {
  openTheDoorsAction,
  closeTheDoorsAction,
  startNextRoundAction,
  closeActiveRoundAction,
  endTournamentAction,
  reopenTournamentAction,
  updateSubtitleAction,
  deleteDraftRoundAction,
  reopenRoundAction,
  restoreReaderAction,
  giveHeartAction,
  takeHeartAction,
  removeReaderAction,
  generateBracketAction,
  clearBracketAction,
  setMatchupWinnerAction,
  swapSeedAction,
  togglePageLockAction,
  setSiteThemeAction,
  setEmailProviderAction,
  setCountdownAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function StaffControlPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const me = await requireStaff({
    next: "/staff/control",
    permission: "bracket:read",
  });
  const sp = await searchParams;

  const role = me.role;
  const canBracket = staffCan(role, "bracket:write");
  const canPlayers = staffCan(role, "players:write");
  const canEmails = staffCan(role, "emails:write");

  const t =
    (await getActiveTournament()) ?? (await getLatestTournament());
  if (!t) {
    return (
      <Stage>
        <div className="max-w-2xl mx-auto pt-9">
          <div className="card px-7 py-7 text-center">
            <p className="font-display text-2xl text-navy">
              No tournament yet.
            </p>
            <p className="font-body text-sm text-navy-soft mt-2">
              Create one from the apex /host page.
            </p>
            <Link href="/staff" className="pop pop-white text-sm mt-5 inline-flex">
              ← Overview
            </Link>
          </div>
        </div>
      </Stage>
    );
  }

  const [
    rounds,
    cast,
    mainRounds,
    losersRounds,
    bracketUsers,
    championId,
    locked,
    theme,
    provider,
    countdown,
  ] = await Promise.all([
    getRoundsForTournament(t.id),
    getCast(t.id),
    getBracket(t.id, "main"),
    getBracket(t.id, "losers"),
    getBracketUsers(t.id),
    getBracketChampionId(t.id),
    getLockedPages(),
    getSiteTheme(),
    getActiveProvider(),
    getCountdown(),
  ]);

  const activeRound = rounds.find((r) => r.status === "active");
  const draftRounds = rounds.filter((r) => r.status === "draft");
  const closedRounds = rounds.filter((r) => r.status === "closed");
  const tournamentEnded = !!t.endedAt;

  return (
    <Stage scrollable>
      <div className="max-w-6xl mx-auto pt-4 px-4 flex flex-col gap-5 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">🛠️ Control panel</h1>
          <Link href="/staff" className="pop pop-white text-sm">
            ← Overview
          </Link>
        </div>

        {sp.ok ? (
          <div className="card-sm bg-grass text-white px-5 py-3 font-display text-sm">
            ✅ {sp.ok.replace(/\+/g, " ")}
          </div>
        ) : null}
        {sp.error ? (
          <div className="card-sm bg-coral-deep text-white px-5 py-3 font-display text-sm">
            ⚠️ {sp.error.replace(/\+/g, " ")}
          </div>
        ) : null}

        {/* ── Tournament header ─────────────────────────────────────── */}
        <section className="card px-5 py-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <p className="font-display text-sm text-coral-deep uppercase tracking-widest">
                Tournament
              </p>
              <p className="font-display text-2xl text-navy mt-1">{t.title}</p>
              <p className="font-body text-sm text-navy-soft mt-1">
                {t.subtitle ?? "—"}
              </p>
              <p className="font-body text-xs text-navy-soft mt-1">
                Status: <strong>{t.status}</strong> · Registration{" "}
                <strong>{t.registrationOpen ? "open" : "closed"}</strong> ·
                Strike limit <strong>{t.strikeLimit}</strong>
                {tournamentEnded ? " · ended" : ""}
              </p>
            </div>
            {canBracket ? (
              <div className="flex flex-wrap gap-2">
                {!tournamentEnded && t.registrationOpen ? (
                  <form action={closeTheDoorsAction}>
                    <button className="pop pop-coral text-sm">
                      🔒 Close registration
                    </button>
                  </form>
                ) : null}
                {!tournamentEnded && !t.registrationOpen ? (
                  <form action={openTheDoorsAction}>
                    <button className="pop pop-grass text-sm">
                      🚪 Open registration
                    </button>
                  </form>
                ) : null}
                {tournamentEnded ? (
                  <form action={reopenTournamentAction}>
                    <button className="pop pop-yellow text-sm">
                      ♻️ Reopen tournament
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>
          {canBracket && !tournamentEnded ? (
            <form
              action={updateSubtitleAction}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                name="subtitle"
                defaultValue={t.subtitle ?? ""}
                placeholder="Subtitle (1–240 chars)"
                maxLength={240}
                className="card-sm px-3 py-2 flex-1 min-w-[16ch] text-sm font-body"
              />
              <button className="pop pop-white text-sm">Save subtitle</button>
            </form>
          ) : null}
        </section>

        {/* ── Round controls ─────────────────────────────────────── */}
        {canBracket ? (
          <section className="card px-5 py-5 flex flex-col gap-3">
            <h2 className="font-display text-xl text-navy">Rounds</h2>
            <div className="flex flex-wrap gap-2">
              <form action={startNextRoundAction}>
                <button className="pop pop-grass text-sm">
                  ▶️ Start next round
                </button>
              </form>
              {activeRound ? (
                <form action={closeActiveRoundAction}>
                  <button className="pop pop-coral text-sm">
                    ⏹ Close active round
                  </button>
                </form>
              ) : null}
            </div>
            <div className="grid md:grid-cols-2 gap-2 mt-2">
              {rounds.length === 0 ? (
                <p className="font-body text-sm text-navy-soft">
                  No rounds yet.
                </p>
              ) : null}
              {rounds.map((r) => (
                <div
                  key={r.id}
                  className="card-sm bg-white px-3 py-2 flex items-center gap-2"
                >
                  <span className="font-display text-sm text-navy flex-1 min-w-0 truncate">
                    📖 Ch {r.chapterNumber} · {r.title}
                  </span>
                  <span
                    className={
                      "font-display text-xs px-2 py-0.5 rounded-md " +
                      (r.status === "active"
                        ? "bg-grass text-white"
                        : r.status === "draft"
                          ? "bg-sun text-navy"
                          : "bg-navy/20 text-navy")
                    }
                  >
                    {r.status}
                  </span>
                  {r.status === "draft" ? (
                    <form action={deleteDraftRoundAction}>
                      <input type="hidden" name="roundId" value={r.id} />
                      <button className="pop pop-white text-xs">delete</button>
                    </form>
                  ) : null}
                  {r.status === "closed" && !activeRound ? (
                    <form action={reopenRoundAction}>
                      <input type="hidden" name="roundId" value={r.id} />
                      <button className="pop pop-yellow text-xs">reopen</button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── End tournament ─────────────────────────────────────── */}
        {canBracket && !tournamentEnded ? (
          <section className="card px-5 py-5 flex flex-col gap-3">
            <h2 className="font-display text-xl text-navy">End tournament</h2>
            <form
              action={endTournamentAction}
              className="flex flex-wrap items-center gap-2"
            >
              <select
                name="winnerUserId"
                className="card-sm px-3 py-2 text-sm font-body"
                defaultValue=""
              >
                <option value="">— pick winner —</option>
                {cast.map((c) => (
                  <option key={c.user.id} value={c.user.id}>
                    {c.user.name ?? c.user.email}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1 font-body text-sm text-navy">
                <input type="checkbox" name="noWinner" value="yes" />
                No winner
              </label>
              <button className="pop pop-coral text-sm">🏁 End</button>
            </form>
          </section>
        ) : null}

        {/* ── Bracket controls ─────────────────────────────────────── */}
        {canBracket ? (
          <section className="card px-5 py-5 flex flex-col gap-3">
            <h2 className="font-display text-xl text-navy">Bracket</h2>
            <form
              action={generateBracketAction}
              className="flex flex-wrap items-center gap-2"
            >
              <select
                name="mode"
                className="card-sm px-3 py-2 text-sm font-body"
                defaultValue="registration"
              >
                <option value="registration">By registration order</option>
                <option value="shuffle">Shuffle</option>
              </select>
              <label className="flex items-center gap-1 font-body text-sm text-navy">
                <input type="checkbox" name="includeOut" value="yes" />
                Include eliminated
              </label>
              <button className="pop pop-grass text-sm">⚡ Generate</button>
              <form action={clearBracketAction}>
                <button className="pop pop-coral text-sm">🧹 Clear</button>
              </form>
            </form>

            <BracketView
              rounds={mainRounds}
              users={bracketUsers}
              championId={championId}
            />
            {losersRounds.length > 0 ? (
              <>
                <h3 className="font-display text-sm text-coral-deep mt-3">
                  Losers bracket
                </h3>
                <BracketView
                  rounds={losersRounds}
                  users={bracketUsers}
                  championId={null}
                />
              </>
            ) : null}

            <details className="mt-2">
              <summary className="font-display text-sm text-navy cursor-pointer">
                Manual matchup overrides
              </summary>
              <div className="grid md:grid-cols-2 gap-2 mt-2">
                {[...mainRounds, ...losersRounds]
                  .flatMap((r) => r.matchups)
                  .map((m) => {
                    const aName =
                      m.playerAUserId
                        ? bracketUsers.get(m.playerAUserId)?.name ?? "—"
                        : "—";
                    const bName =
                      m.playerBUserId
                        ? bracketUsers.get(m.playerBUserId)?.name ?? "—"
                        : "—";
                    return (
                      <div
                        key={m.id}
                        className="card-sm bg-white px-3 py-2 flex items-center gap-2"
                      >
                        <span className="font-display text-xs text-navy flex-1 truncate">
                          {m.bracket === "losers" ? "L" : "W"}R{m.roundIndex} #
                          {m.slot}: {aName} vs {bName}
                        </span>
                        <form
                          action={setMatchupWinnerAction}
                          className="flex items-center gap-1"
                        >
                          <input type="hidden" name="matchupId" value={m.id} />
                          <select
                            name="winnerUserId"
                            defaultValue={m.winnerUserId ?? ""}
                            className="card-sm px-2 py-1 text-xs font-body"
                          >
                            <option value="">— winner —</option>
                            {m.playerAUserId ? (
                              <option value={m.playerAUserId}>{aName}</option>
                            ) : null}
                            {m.playerBUserId ? (
                              <option value={m.playerBUserId}>{bName}</option>
                            ) : null}
                          </select>
                          <button className="pop pop-yellow text-xs">
                            set
                          </button>
                        </form>
                      </div>
                    );
                  })}
              </div>
            </details>

            <details className="mt-2">
              <summary className="font-display text-sm text-navy cursor-pointer">
                Round-1 seed swap
              </summary>
              <div className="grid md:grid-cols-2 gap-2 mt-2">
                {mainRounds[0]?.matchups.map((m) => (
                  <div
                    key={m.id}
                    className="card-sm bg-white px-3 py-2 flex flex-col gap-1"
                  >
                    <p className="font-display text-xs text-navy">
                      Slot {m.slot}
                    </p>
                    {(["a", "b"] as const).map((side) => {
                      const uid =
                        side === "a" ? m.playerAUserId : m.playerBUserId;
                      const name = uid
                        ? bracketUsers.get(uid)?.name ?? "—"
                        : "(empty)";
                      return (
                        <form
                          key={side}
                          action={swapSeedAction}
                          className="flex items-center gap-1"
                        >
                          <input type="hidden" name="matchupId" value={m.id} />
                          <input type="hidden" name="side" value={side} />
                          <span className="font-body text-xs text-navy-soft w-16">
                            side {side}
                          </span>
                          <select
                            name="newUserId"
                            defaultValue={uid ?? ""}
                            className="card-sm px-2 py-1 text-xs font-body flex-1"
                          >
                            <option value="">— empty —</option>
                            {cast.map((c) => (
                              <option key={c.user.id} value={c.user.id}>
                                {c.user.name ?? c.user.email}
                              </option>
                            ))}
                          </select>
                          <button className="pop pop-white text-xs">
                            {name === "(empty)" ? "set" : "swap"}
                          </button>
                        </form>
                      );
                    })}
                  </div>
                ))}
              </div>
            </details>
          </section>
        ) : null}

        {/* ── Players ─────────────────────────────────────── */}
        {canPlayers ? (
          <section className="card px-5 py-5 flex flex-col gap-3">
            <h2 className="font-display text-xl text-navy">Players</h2>
            <div className="grid md:grid-cols-2 gap-2">
              {cast.map((c) => {
                const out = !!c.enrollment.eliminatedAt;
                return (
                  <div
                    key={c.enrollment.id}
                    className={
                      "card-sm bg-white px-3 py-2 flex items-center gap-2 " +
                      (out ? "opacity-70" : "")
                    }
                  >
                    <span className="font-display text-sm text-navy flex-1 min-w-0 truncate">
                      {c.user.name ?? c.user.email}
                    </span>
                    <span className="font-body text-xs text-navy-soft">
                      ❤️ {c.enrollment.strikeCount}/{t.strikeLimit}
                    </span>
                    {out ? (
                      <form action={restoreReaderAction}>
                        <input
                          type="hidden"
                          name="enrollmentId"
                          value={c.enrollment.id}
                        />
                        <button className="pop pop-grass text-xs">
                          restore
                        </button>
                      </form>
                    ) : (
                      <>
                        <form action={giveHeartAction}>
                          <input
                            type="hidden"
                            name="enrollmentId"
                            value={c.enrollment.id}
                          />
                          <button className="pop pop-grass text-xs">+❤️</button>
                        </form>
                        <form action={takeHeartAction}>
                          <input
                            type="hidden"
                            name="enrollmentId"
                            value={c.enrollment.id}
                          />
                          <button className="pop pop-coral text-xs">−❤️</button>
                        </form>
                      </>
                    )}
                    <form action={removeReaderAction}>
                      <input
                        type="hidden"
                        name="enrollmentId"
                        value={c.enrollment.id}
                      />
                      <input type="hidden" name="confirm" value="yes" />
                      <button
                        className="pop pop-white text-xs"
                        title="Remove from tournament"
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ── Settings ─────────────────────────────────────── */}
        {canBracket ? (
          <section className="card px-5 py-5 flex flex-col gap-3">
            <h2 className="font-display text-xl text-navy">Settings</h2>

            <div>
              <p className="font-display text-sm text-navy-soft uppercase tracking-widest">
                Page locks
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {ALL_LOCKABLE.map((p) => {
                  const isLocked = locked.has(p);
                  return (
                    <form key={p} action={togglePageLockAction}>
                      <input type="hidden" name="page" value={p} />
                      <input
                        type="hidden"
                        name="locked"
                        value={isLocked ? "no" : "yes"}
                      />
                      <button
                        className={
                          isLocked
                            ? "pop pop-coral text-xs"
                            : "pop pop-white text-xs"
                        }
                      >
                        {isLocked ? "🔒" : "🔓"} {pageLabel(p)}
                      </button>
                    </form>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="font-display text-sm text-navy-soft uppercase tracking-widest">
                Site theme
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {(["default", "arcade"] as const).map((th) => (
                  <form key={th} action={setSiteThemeAction}>
                    <input type="hidden" name="theme" value={th} />
                    <button
                      className={
                        theme === th
                          ? "pop pop-coral text-xs"
                          : "pop pop-white text-xs"
                      }
                    >
                      {th}
                    </button>
                  </form>
                ))}
              </div>
            </div>

            {canEmails ? (
              <div>
                <p className="font-display text-sm text-navy-soft uppercase tracking-widest">
                  Email provider
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(["resend", "brevo"] as const).map((p) => (
                    <form key={p} action={setEmailProviderAction}>
                      <input type="hidden" name="provider" value={p} />
                      <button
                        className={
                          provider === p
                            ? "pop pop-coral text-xs"
                            : "pop pop-white text-xs"
                        }
                      >
                        {p}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            ) : null}

            <form
              action={setCountdownAction}
              className="flex flex-col gap-2 mt-2"
            >
              <p className="font-display text-sm text-navy-soft uppercase tracking-widest">
                Countdown
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  name="label"
                  defaultValue={countdown.label}
                  placeholder="Label"
                  className="card-sm px-3 py-2 text-sm font-body flex-1 min-w-[12ch]"
                  maxLength={120}
                />
                <input
                  name="target"
                  type="datetime-local"
                  defaultValue={
                    countdown.targetIso
                      ? // strip seconds + tz for datetime-local input
                        new Date(countdown.targetIso)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  className="card-sm px-3 py-2 text-sm font-body"
                />
                <label className="flex items-center gap-1 font-body text-sm text-navy">
                  <input
                    type="checkbox"
                    name="visible"
                    value="yes"
                    defaultChecked={countdown.visible}
                  />
                  visible
                </label>
                <button className="pop pop-yellow text-sm">Save</button>
              </div>
            </form>
          </section>
        ) : null}

        <p className="font-body text-xs text-navy-soft text-center">
          {closedRounds.length} closed round
          {closedRounds.length === 1 ? "" : "s"} · {draftRounds.length} draft
          {draftRounds.length === 1 ? "" : "s"}. Round creation lives on the
          apex /host page (the chapter editor is heavy and not yet ported).
        </p>
      </div>
    </Stage>
  );
}
