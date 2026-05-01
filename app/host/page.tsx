import { redirect } from "next/navigation";
import Link from "next/link";
import { Stage } from "@/components/Stage";
import { ChapterEditor } from "@/components/ChapterEditor";
import { AnnouncementForm } from "@/components/AnnouncementForm";
import { BracketView } from "@/components/BracketView";
import { currentUser } from "@/lib/session";
import {
  ALL_LOCKABLE,
  getLockedPages,
  pageLabel,
  type LockablePage,
} from "@/lib/page-locks";
import { togglePageLockAction } from "./page-locks-actions";
import { getSiteTheme } from "@/lib/site-theme";
import { setSiteThemeAction } from "./site-theme-actions";
import { getActiveProvider } from "@/lib/email-provider";
import { setEmailProviderAction } from "./email-provider-actions";
import { getCountdown } from "@/lib/countdown-settings";
import { setCountdownAction } from "./countdown-actions";
import {
  getOrCreateActiveTournament,
  getRoundsForTournament,
  getCast,
} from "@/lib/engine";
import {
  getBracket,
  getBracketUsers,
  getBracketChampionId,
} from "@/lib/bracket";
import {
  openTheDoors,
  closeTheDoors,
  startNextRoundAction,
  closeActiveRound,
  endTournamentAction,
  reopenTournamentAction,
  restoreReaderAction,
  giveHeartAction,
  takeHeartAction,
  removeReaderAction,
  updateSubtitle,
  deleteDraftRound,
  reopenRound,
  generateBracketAction,
  clearBracketAction,
  setMatchupWinnerAction,
  swapSeedAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function HostPanel({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  if (user.role !== "author") redirect("/play");

  const { error, ok } = await searchParams;

  const tournament = await getOrCreateActiveTournament();
  const allRounds = await getRoundsForTournament(tournament.id);
  // Real-round controls (start/close/etc.) only see real rounds. Practice
  // rounds are listed in their own section so they're never confused with
  // tournament rounds.
  const rounds = allRounds.filter((r) => !r.isPractice);
  const practiceRounds = allRounds.filter((r) => r.isPractice);
  const cast = await getCast(tournament.id);
  const bracket = await getBracket(tournament.id, "main");
  const losersBracket = await getBracket(tournament.id, "losers");
  const bracketUsers = await getBracketUsers(tournament.id);
  const championId = await getBracketChampionId(tournament.id);
  const lockedPages = await getLockedPages();
  const siteTheme = await getSiteTheme();
  const emailProvider = await getActiveProvider();
  const countdown = await getCountdown();

  const activeRound = rounds.find((r) => r.status === "active");
  const draftRounds = rounds.filter((r) => r.status === "draft");
  const closedRounds = rounds.filter((r) => r.status === "closed");
  const isComplete = tournament.status === "complete";

  return (
    <Stage scrollable>
      <div className="max-w-4xl mx-auto pt-4 px-4 flex flex-col gap-5">
        <div className="card-sm px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl md:text-4xl text-navy">
            🛠️ Host Panel
          </h1>
          <div className="flex gap-2 flex-wrap">
            <Link href="/host/predictions" className="pop pop-coral text-sm">
              🔮 Predictions
            </Link>
            <Link href="/host/email-analytics" className="pop pop-sky text-sm">
              📨 Emails
            </Link>
            <Link href="/host/attempts" className="pop pop-grass text-sm">
              📡 Attempts
            </Link>
            <Link href="/host/visitors" className="pop pop-sky text-sm">
              👁 Visitors
            </Link>
            <Link href="/host/blocks" className="pop pop-danger text-sm">
              🛑 Blocks
            </Link>
            <Link href="/host/files" className="pop pop-yellow text-sm">
              📁 Files
            </Link>
            <Link href="/" className="pop pop-white text-sm">
              ← Home
            </Link>
          </div>
        </div>

        {error ? (
          <div className="card-sm px-5 py-3 bg-coral-deep text-white">
            ⚠️ {error}
          </div>
        ) : null}
        {ok ? (
          <div className="card-sm px-5 py-3 bg-grass text-white">
            ✓ {ok}
          </div>
        ) : null}

        {/* The tournament status */}
        <section className="card px-5 py-5">
          <h2 className="font-display text-2xl text-navy">🎯 Tournament</h2>
          <p className="font-body text-lg text-navy mt-2">
            Status:{" "}
            <strong>
              {isComplete
                ? "Closed (you ended it)"
                : activeRound
                ? `Round ${activeRound.chapterNumber} active — ${activeRound.title}`
                : draftRounds.length > 0
                ? "Between rounds (draft ready)"
                : tournament.status === "registration"
                ? tournament.registrationOpen
                  ? "Sign-ups open · waiting for first round"
                  : "Sign-ups closed · waiting for first round"
                : "Between rounds (no draft yet)"}
            </strong>
          </p>

          <div className="flex flex-wrap gap-3 mt-5">
            {!isComplete &&
              (tournament.registrationOpen ? (
                <form action={closeTheDoors}>
                  <button type="submit" className="pop pop-white">
                    🚪 Close sign-ups
                  </button>
                </form>
              ) : (
                <form action={openTheDoors}>
                  <button type="submit" className="pop pop-grass">
                    🚪 Open sign-ups
                  </button>
                </form>
              ))}

            {!isComplete && !activeRound && draftRounds.length > 0 ? (
              <form action={startNextRoundAction}>
                <button type="submit" className="pop pop-coral">
                  🚀 Start Round {draftRounds[0].chapterNumber}
                </button>
              </form>
            ) : null}

            {!isComplete && activeRound ? (
              <form action={closeActiveRound}>
                <button type="submit" className="pop pop-yellow">
                  🔒 Close Round {activeRound.chapterNumber}
                </button>
              </form>
            ) : null}

            {!isComplete ? (
              <details>
                <summary className="pop pop-white cursor-pointer list-none">
                  🏁 End the tournament…
                </summary>
                <form
                  action={endTournamentAction}
                  className="mt-3 card-sm px-5 py-5 flex flex-col gap-3"
                >
                  <p className="font-display text-base text-navy">
                    Pick the champion:
                  </p>
                  <select
                    name="winnerUserId"
                    className="px-3 py-2 bg-white border-3 border-navy rounded-md font-body text-base"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose a player…
                    </option>
                    {cast.map((row) => (
                      <option key={row.user.id} value={row.user.id}>
                        {row.user.name ?? row.user.email}
                        {row.enrollment.eliminatedAt ? "  (was OUT)" : ""}
                      </option>
                    ))}
                  </select>
                  <label className="font-body text-sm text-navy-soft flex items-center gap-2">
                    <input type="checkbox" name="noWinner" value="yes" />
                    End with no champion (just close it)
                  </label>
                  <button type="submit" className="pop pop-danger">
                    End tournament
                  </button>
                </form>
              </details>
            ) : (
              <form action={reopenTournamentAction}>
                <button type="submit" className="pop pop-grass">
                  ↩️ Reopen tournament (undo)
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Bracket */}
        <section className="card px-5 py-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-display text-2xl text-navy">🎟️ Bracket</h2>
            <Link href="/bracket" className="pop pop-white text-sm">
              Public bracket →
            </Link>
          </div>

          <p className="font-body text-sm text-navy-soft mt-1">
            Single-elimination. When a quiz round closes, the bracket
            auto-fills winners by score — but you can override anyone any
            time.
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            <form action={generateBracketAction}>
              <input type="hidden" name="mode" value="registration" />
              <button type="submit" className="pop pop-coral text-sm">
                {bracket.length === 0 ? "🎯 Generate bracket" : "🔁 Re-seed by sign-up order"}
              </button>
            </form>
            <form action={generateBracketAction}>
              <input type="hidden" name="mode" value="shuffle" />
              <button type="submit" className="pop pop-yellow text-sm">
                🎲 Shuffle bracket
              </button>
            </form>
            {bracket.length > 0 ? (
              <form action={clearBracketAction}>
                <button type="submit" className="pop pop-white text-sm">
                  🧹 Clear bracket
                </button>
              </form>
            ) : null}
          </div>

          {bracket.length > 0 ? (
            <div className="mt-5">
              <BracketView
                rounds={bracket}
                users={bracketUsers}
                championId={championId}
                renderControls={(m) => {
                  const playerOptions: Array<{ id: string; name: string }> = [];
                  if (m.playerAUserId) {
                    playerOptions.push({
                      id: m.playerAUserId,
                      name:
                        bracketUsers.get(m.playerAUserId)?.name ??
                        bracketUsers.get(m.playerAUserId)?.email ??
                        "—",
                    });
                  }
                  if (m.playerBUserId) {
                    playerOptions.push({
                      id: m.playerBUserId,
                      name:
                        bracketUsers.get(m.playerBUserId)?.name ??
                        bracketUsers.get(m.playerBUserId)?.email ??
                        "—",
                    });
                  }
                  return (
                    <form action={setMatchupWinnerAction} className="flex gap-1">
                      <input type="hidden" name="matchupId" value={m.id} />
                      <select
                        name="winnerUserId"
                        defaultValue={m.winnerUserId ?? ""}
                        className="px-2 py-1 bg-white border-2 border-navy rounded-md font-body text-xs flex-1 min-w-0"
                      >
                        <option value="">—</option>
                        {playerOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="px-2 py-1 rounded-md border-2 border-navy bg-coral text-white font-display text-xs"
                      >
                        set
                      </button>
                    </form>
                  );
                }}
              />
            </div>
          ) : (
            <div className="mt-5 px-5 py-7 border-3 border-dashed border-navy rounded-2xl text-center text-navy-soft font-display text-base">
              {cast.length === 0
                ? "Sign some players up first."
                : `Ready to seed ${cast.length} player${cast.length === 1 ? "" : "s"} into a bracket.`}
            </div>
          )}

          {/* Losers bracket (double-elim only — only rendered if it exists) */}
          {losersBracket.length > 0 ? (
            <div className="mt-7 pt-5 border-t-3 border-coral-deep border-dashed">
              <h3 className="font-display text-lg text-coral-deep">
                💔 Losers bracket
              </h3>
              <p className="font-body text-xs text-navy-soft mt-1">
                Auto-seeded from main R1 losers. From here, one loss = out.
              </p>
              <div className="mt-3">
                <BracketView
                  rounds={losersBracket}
                  users={bracketUsers}
                  championId={null}
                  renderControls={(m) => {
                    const playerOptions: Array<{ id: string; name: string }> = [];
                    if (m.playerAUserId) {
                      playerOptions.push({
                        id: m.playerAUserId,
                        name:
                          bracketUsers.get(m.playerAUserId)?.name ??
                          bracketUsers.get(m.playerAUserId)?.email ??
                          "—",
                      });
                    }
                    if (m.playerBUserId) {
                      playerOptions.push({
                        id: m.playerBUserId,
                        name:
                          bracketUsers.get(m.playerBUserId)?.name ??
                          bracketUsers.get(m.playerBUserId)?.email ??
                          "—",
                      });
                    }
                    return (
                      <form action={setMatchupWinnerAction} className="flex gap-1">
                        <input type="hidden" name="matchupId" value={m.id} />
                        <select
                          name="winnerUserId"
                          defaultValue={m.winnerUserId ?? ""}
                          className="px-2 py-1 bg-white border-2 border-navy rounded-md font-body text-xs flex-1 min-w-0"
                        >
                          <option value="">—</option>
                          {playerOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="px-2 py-1 rounded-md border-2 border-navy bg-coral-deep text-white font-display text-xs"
                        >
                          set
                        </button>
                      </form>
                    );
                  }}
                />
              </div>
            </div>
          ) : null}

          {/* Round-1 seed swap UI */}
          {bracket.length > 0 ? (
            <div className="mt-7">
              <h3 className="font-display text-lg text-navy">
                🎚️ Adjust round-1 seeds
              </h3>
              <p className="font-body text-xs text-navy-soft">
                Pick a different player for any seat. Downstream slots reset
                whenever you swap.
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {bracket[0].matchups.map((m, i) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border-3 border-navy bg-white"
                  >
                    <span className="font-display text-sm text-navy w-12">
                      M{i + 1}
                    </span>
                    <SeatSelect
                      matchupId={m.id}
                      side="a"
                      currentUserId={m.playerAUserId}
                      cast={cast}
                    />
                    <span className="font-display text-xs text-navy-soft">
                      vs
                    </span>
                    <SeatSelect
                      matchupId={m.id}
                      side="b"
                      currentUserId={m.playerBUserId}
                      cast={cast}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {/* Landing-page countdown card */}
        <section className="card px-5 py-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-display text-2xl text-navy">⏰ Countdown card</h2>
            <span className="font-body text-xs text-navy-soft">
              Shows on / and /play when visible
            </span>
          </div>
          <p className="font-body text-sm text-navy-soft mt-1">
            Pick a label and a target moment. While visible, every signed-in
            visitor sees a live ticking clock at the top of the home and play
            pages.
          </p>
          <form action={setCountdownAction} className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-display text-sm text-navy">Label</span>
              <input
                type="text"
                name="label"
                defaultValue={countdown.label}
                maxLength={80}
                placeholder="e.g. Round 2 starts in"
                className="px-3 py-2 bg-white border-3 border-navy rounded-md font-body text-base"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-display text-sm text-navy">
                Target (your local time)
              </span>
              <input
                type="datetime-local"
                name="target"
                defaultValue={countdown.targetIso.slice(0, 16)}
                className="px-3 py-2 bg-white border-3 border-navy rounded-md font-body text-base"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="visible"
                value="yes"
                defaultChecked={countdown.visible}
              />
              <span className="font-display text-sm text-navy">
                Visible to players (untick to hide)
              </span>
            </label>
            <button type="submit" className="pop pop-coral text-sm self-start">
              Save countdown
            </button>
          </form>
          <p className="font-body text-xs text-navy-soft mt-3">
            Currently:{" "}
            <strong className="text-navy">
              {countdown.visible ? "showing" : "hidden"}
            </strong>
            {countdown.targetIso ? (
              <>
                {" "}· target{" "}
                <code className="text-navy">{countdown.targetIso}</code>
              </>
            ) : null}
          </p>
        </section>

        {/* Email provider toggle */}
        <section className="card px-5 py-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-display text-2xl text-navy">
              📬 Email provider
            </h2>
            <span className="font-body text-xs text-navy-soft">
              Affects /host announcements + magic-link sign-in emails
            </span>
          </div>
          <p className="font-body text-sm text-navy-soft mt-1">
            Switch between <strong>Resend</strong> and <strong>Brevo</strong>{" "}
            if you&rsquo;re hitting one provider&rsquo;s daily/monthly limits.
            Both use the same EMAIL_FROM env var; each needs its own API key
            (RESEND_API_KEY or BREVO_API_KEY).
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <form action={setEmailProviderAction}>
              <input type="hidden" name="provider" value="resend" />
              <button
                type="submit"
                disabled={emailProvider === "resend"}
                className={
                  "pop text-sm " +
                  (emailProvider === "resend" ? "pop-coral" : "pop-white")
                }
              >
                {emailProvider === "resend" ? "● " : ""}📧 Resend
              </button>
            </form>
            <form action={setEmailProviderAction}>
              <input type="hidden" name="provider" value="brevo" />
              <button
                type="submit"
                disabled={emailProvider === "brevo"}
                className={
                  "pop text-sm " +
                  (emailProvider === "brevo" ? "pop-coral" : "pop-white")
                }
              >
                {emailProvider === "brevo" ? "● " : ""}📨 Brevo
              </button>
            </form>
          </div>
          <p className="font-body text-xs text-navy-soft mt-3">
            Currently:{" "}
            <strong className="text-navy">
              {emailProvider === "brevo" ? "Brevo" : "Resend"}
            </strong>
            . Change takes effect within ~30 seconds (cache).
          </p>
        </section>

        {/* Public site theme */}
        <section className="card px-5 py-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-display text-2xl text-navy">🎨 Site theme</h2>
            <span className="font-body text-xs text-navy-soft">
              Affects /bracket, /players, /standings (public pages only)
            </span>
          </div>
          <p className="font-body text-sm text-navy-soft mt-1">
            Pick the look of the public pages. <strong>Picture-book</strong> is
            the original sunny picture-book theme. <strong>Arcade</strong> is a
            Supercell-store-inspired dark mode with neon glow, rarity badges and
            a holographic title.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <form action={setSiteThemeAction}>
              <input type="hidden" name="theme" value="default" />
              <button
                type="submit"
                disabled={siteTheme === "default"}
                className={
                  "pop text-sm " +
                  (siteTheme === "default" ? "pop-coral" : "pop-white")
                }
              >
                {siteTheme === "default" ? "● " : ""}🌞 Picture-book (default)
              </button>
            </form>
            <form action={setSiteThemeAction}>
              <input type="hidden" name="theme" value="arcade" />
              <button
                type="submit"
                disabled={siteTheme === "arcade"}
                className={
                  "pop text-sm " +
                  (siteTheme === "arcade" ? "pop-coral" : "pop-white")
                }
              >
                {siteTheme === "arcade" ? "● " : ""}🎮 Arcade (neon)
              </button>
            </form>
          </div>
          <p className="font-body text-xs text-navy-soft mt-3">
            Currently:{" "}
            <strong className="text-navy">
              {siteTheme === "arcade" ? "Arcade (neon)" : "Picture-book"}
            </strong>
            . Change takes effect within ~30 seconds (cache).
          </p>
        </section>

        {/* Public-page visibility toggles */}
        <section className="card px-5 py-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-display text-2xl text-navy">
              👁 Public pages
            </h2>
            <span className="font-body text-xs text-navy-soft">
              You always see them; this only hides for everyone else.
            </span>
          </div>
          <p className="font-body text-sm text-navy-soft mt-1">
            Tap a page to flip it open or closed. Closed pages show a friendly
            “paused” card to non-author visitors.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {(ALL_LOCKABLE as LockablePage[]).map((p) => {
              const locked = lockedPages.has(p);
              return (
                <form
                  key={p}
                  action={togglePageLockAction}
                  className="flex items-center gap-3 card-sm bg-white px-3 py-2"
                >
                  <input type="hidden" name="page" value={p} />
                  <input
                    type="hidden"
                    name="locked"
                    value={locked ? "no" : "yes"}
                  />
                  <span className="font-display text-base text-navy flex-1">
                    {pageLabel(p)}{" "}
                    <code className="font-body text-xs text-navy-soft">
                      /{p}
                    </code>
                  </span>
                  <span
                    className={
                      "font-display text-xs px-2 py-1 rounded-md border-2 border-navy " +
                      (locked
                        ? "bg-coral-deep text-white"
                        : "bg-grass text-white")
                    }
                  >
                    {locked ? "🔒 hidden" : "👁 visible"}
                  </span>
                  <button
                    type="submit"
                    className={
                      "pop text-sm " + (locked ? "pop-grass" : "pop-coral")
                    }
                  >
                    {locked ? "Open it back up" : "Hide for visitors"}
                  </button>
                </form>
              );
            })}
          </div>
        </section>

        {/* Announcements */}
        <section className="card px-5 py-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-display text-2xl text-navy">
              📣 Send an announcement
            </h2>
            <span className="font-body text-xs text-navy-soft">
              Email everyone who&rsquo;s signed up
            </span>
          </div>
          <p className="font-body text-sm text-navy-soft mt-1">
            Pick an audience, write a quick note, review, then send. The email
            goes out from{" "}
            <strong>Mia&rsquo;s Quiz Tournament</strong> with the same sunny
            styling as the magic-link emails.
          </p>
          <div className="mt-3">
            <AnnouncementForm />
          </div>
        </section>

        {/* Cover line */}
        <section className="card px-5 py-5">
          <h2 className="font-display text-2xl text-navy">✍️ Cover line</h2>
          <form
            action={updateSubtitle}
            className="flex flex-col md:flex-row items-stretch md:items-end gap-3 mt-3"
          >
            <input
              name="subtitle"
              defaultValue={tournament.subtitle ?? ""}
              maxLength={240}
              className="flex-1"
              placeholder="Quizzes! Friends! Adventure!"
            />
            <button type="submit" className="pop pop-coral">
              Save
            </button>
          </form>
        </section>

        {/* Rounds */}
        <section className="card px-5 py-5">
          <h2 className="font-display text-2xl text-navy">📚 Rounds</h2>
          {rounds.length === 0 ? (
            <p className="font-body text-lg text-navy-soft mt-3">
              No rounds yet — write one below.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {rounds.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border-3 border-navy bg-white shadow-pop-sm"
                >
                  <span className="font-display text-lg text-navy w-24">
                    Round {r.chapterNumber}
                  </span>
                  <span className="font-display text-lg text-navy flex-1 truncate">
                    {r.title}
                  </span>
                  <span
                    className={
                      "font-display text-sm px-2 py-1 rounded-md border-2 border-navy " +
                      (r.status === "active"
                        ? "bg-grass text-white"
                        : r.status === "closed"
                        ? "bg-navy text-white"
                        : "bg-sun text-navy")
                    }
                  >
                    {r.status}
                  </span>
                  {r.status === "draft" ? (
                    <form action={deleteDraftRound}>
                      <input type="hidden" name="roundId" value={r.id} />
                      <button
                        type="submit"
                        className="font-display text-sm text-coral-deep hover:underline"
                      >
                        delete
                      </button>
                    </form>
                  ) : r.status === "closed" ? (
                    <form action={reopenRound}>
                      <input type="hidden" name="roundId" value={r.id} />
                      <button
                        type="submit"
                        className="font-display text-sm text-coral-deep hover:underline"
                      >
                        reopen
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {!isComplete && draftRounds.length > 0 && !activeRound ? (
            <p className="mt-3 font-display text-sm text-navy-soft">
              Tip: hit{" "}
              <strong>Start Round {draftRounds[0].chapterNumber}</strong> above
              when you&rsquo;re ready to release it.
            </p>
          ) : null}
        </section>

        {/* Practice rounds */}
        <section className="card px-5 py-5">
          <h2 className="font-display text-2xl text-navy">🎯 Practice rounds</h2>
          <p className="font-body text-sm text-navy-soft mt-1">
            Always-open warm-ups. They never give strikes or feed the bracket.
          </p>
          {practiceRounds.length === 0 ? (
            <p className="font-body text-base text-navy-soft mt-3">
              None yet. Toggle <strong>Practice round</strong> in the editor
              below to make one.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {practiceRounds.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border-3 border-navy bg-sky1 shadow-pop-sm"
                >
                  <span className="font-display text-lg text-navy w-24">
                    Practice {r.chapterNumber}
                  </span>
                  <span className="font-display text-lg text-navy flex-1 truncate">
                    {r.title}
                  </span>
                  <span
                    className={
                      "font-display text-sm px-2 py-1 rounded-md border-2 border-navy " +
                      (r.status === "active"
                        ? "bg-grass text-white"
                        : "bg-navy text-white")
                    }
                  >
                    {r.status}
                  </span>
                  <form action={deleteDraftRound}>
                    <input type="hidden" name="roundId" value={r.id} />
                    <button
                      type="submit"
                      className="font-display text-sm text-coral-deep hover:underline"
                      title="Only draft practice rounds can be deleted; active ones aren't deletable here for safety"
                    >
                      delete (drafts only)
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Write a round */}
        <section className="card px-5 py-5">
          <h2 className="font-display text-2xl text-navy">
            ✏️ Write a new round
          </h2>
          <p className="font-body text-base text-navy-soft mt-1">
            Save it as a draft. Players won&rsquo;t see it until you press{" "}
            <strong>Start Round</strong>.
          </p>
          <div className="mt-3">
            <ChapterEditor />
          </div>
        </section>

        {/* Players */}
        <section className="card px-5 py-5">
          <h2 className="font-display text-2xl text-navy">👥 Players</h2>
          <p className="font-body text-sm text-navy-soft mt-1">
            Mistakes happen — give back hearts or restore players.
          </p>
          {cast.length === 0 ? (
            <p className="font-body text-lg text-navy-soft mt-3">
              No players yet.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {cast.map((row) => {
                const livesLeft = Math.max(
                  0,
                  tournament.strikeLimit - row.enrollment.strikeCount
                );
                const isOut = !!row.enrollment.eliminatedAt;
                return (
                  <li
                    key={row.enrollment.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border-3 border-navy bg-white shadow-pop-sm flex-wrap"
                  >
                    <span className="font-display text-lg text-navy flex-1 truncate min-w-0">
                      {row.user.name ?? row.user.email ?? "—"}
                    </span>
                    <span className="font-display text-base text-navy whitespace-nowrap">
                      {Array.from({ length: tournament.strikeLimit }).map(
                        (_, i) => (
                          <span key={i}>
                            {i < livesLeft ? "❤️" : "🤍"}
                          </span>
                        )
                      )}
                    </span>
                    {isOut ? (
                      <span className="px-2 py-1 rounded-md border-2 border-navy bg-coral-deep text-white text-xs font-display">
                        OUT
                      </span>
                    ) : null}
                    <div className="flex items-center gap-1">
                      <form action={giveHeartAction}>
                        <input
                          type="hidden"
                          name="enrollmentId"
                          value={row.enrollment.id}
                        />
                        <button
                          type="submit"
                          className="px-2 py-1 rounded-md border-2 border-navy bg-grass text-white font-display text-xs"
                          title="Give back a heart"
                        >
                          + ❤️
                        </button>
                      </form>
                      <form action={takeHeartAction}>
                        <input
                          type="hidden"
                          name="enrollmentId"
                          value={row.enrollment.id}
                        />
                        <button
                          type="submit"
                          className="px-2 py-1 rounded-md border-2 border-navy bg-coral text-white font-display text-xs"
                          title="Take a heart"
                        >
                          − ❤️
                        </button>
                      </form>
                      {isOut ? (
                        <form action={restoreReaderAction}>
                          <input
                            type="hidden"
                            name="enrollmentId"
                            value={row.enrollment.id}
                          />
                          <button
                            type="submit"
                            className="px-2 py-1 rounded-md border-2 border-navy bg-sun text-navy font-display text-xs"
                          >
                            ↩️ Restore
                          </button>
                        </form>
                      ) : null}
                      <form action={removeReaderAction}>
                        <input
                          type="hidden"
                          name="enrollmentId"
                          value={row.enrollment.id}
                        />
                        <input type="hidden" name="confirm" value="yes" />
                        <button
                          type="submit"
                          className="font-display text-xs text-coral-deep hover:underline px-1"
                          title="Remove from tournament (cannot undo)"
                        >
                          remove
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="text-center font-body text-xs text-navy-soft pb-5">
          {closedRounds.length} closed · {draftRounds.length} draft ·{" "}
          {activeRound ? 1 : 0} active
        </div>
      </div>
    </Stage>
  );
}

function SeatSelect({
  matchupId,
  side,
  currentUserId,
  cast,
}: {
  matchupId: string;
  side: "a" | "b";
  currentUserId: string | null;
  cast: Awaited<ReturnType<typeof getCast>>;
}) {
  return (
    <form action={swapSeedAction} className="flex items-center gap-1">
      <input type="hidden" name="matchupId" value={matchupId} />
      <input type="hidden" name="side" value={side} />
      <select
        name="newUserId"
        defaultValue={currentUserId ?? ""}
        className="px-2 py-1 bg-white border-2 border-navy rounded-md font-body text-xs"
      >
        <option value="">— bye —</option>
        {cast.map((c) => (
          <option key={c.user.id} value={c.user.id}>
            {c.user.name ?? c.user.email}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="px-2 py-1 rounded-md border-2 border-navy bg-sun text-navy font-display text-xs"
      >
        swap
      </button>
    </form>
  );
}
