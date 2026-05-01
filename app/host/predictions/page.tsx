import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import {
  getAllMatchupsForGame,
  getLeaderboard,
  getPredictionsSettings,
  isPredictable,
  pointValueFor,
} from "@/lib/predictions";
import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";
import {
  lockAllAction,
  lockMatchupAction,
  setPredictionsSettingsAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function HostPredictionsPage() {
  const me = await currentUser();
  if (!me) redirect("/signin");
  if (me.role !== "author") redirect("/play");

  const settings = await getPredictionsSettings();
  const tournament =
    (await getActiveTournament()) ?? (await getLatestTournament());
  const allMatchups = tournament
    ? await getAllMatchupsForGame(tournament.id)
    : [];
  const leaderboard = tournament ? await getLeaderboard(tournament.id) : [];

  const userIds = new Set<string>();
  for (const m of allMatchups) {
    if (m.playerAUserId) userIds.add(m.playerAUserId);
    if (m.playerBUserId) userIds.add(m.playerBUserId);
    if (m.winnerUserId) userIds.add(m.winnerUserId);
  }
  const userRows =
    userIds.size === 0
      ? []
      : await db
          .select()
          .from(schema.users)
          .where(inArray(schema.users.id, [...userIds]));
  const nameById = new Map(userRows.map((u) => [u.id, u]));
  const nameOf = (id: string | null) =>
    id ? nameById.get(id)?.name ?? nameById.get(id)?.email ?? "—" : "—";

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col gap-5 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">
            🔮 Prediction game
          </h1>
          <Link href="/host" className="pop pop-white text-sm">
            ← Host
          </Link>
        </div>

        <section className="card px-5 py-5">
          <h2 className="font-display text-xl text-navy">Settings</h2>
          <p className="font-body text-sm text-navy-soft mt-1">
            When the game is enabled, every signed-in user can hit{" "}
            <code>/predict</code> and the &ldquo;🔮 Predict&rdquo; link
            appears in the top nav. When disabled, the page returns 404 to
            non-authors and the nav link is hidden — but you and any allowed
            users can still load it via direct URL.
          </p>
          <form
            action={setPredictionsSettingsAction}
            className="mt-3 flex flex-col gap-3"
          >
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="enabled"
                value="yes"
                defaultChecked={settings.enabled}
              />
              <span className="font-display text-sm text-navy">
                Enabled (visible to all signed-in users)
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-display text-sm text-navy">
                Prize description (shown on /predict)
              </span>
              <input
                type="text"
                name="prize"
                defaultValue={settings.prize}
                maxLength={240}
                placeholder='e.g. "Best predictor wins a custom Mia drawing"'
                className="px-3 py-2 bg-white border-3 border-navy rounded-md font-body text-base"
              />
            </label>
            <button type="submit" className="pop pop-coral text-sm self-start">
              Save settings
            </button>
          </form>
        </section>

        <section className="card px-5 py-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-display text-xl text-navy">
              Lock controls
            </h2>
            <div className="flex gap-2">
              <form action={lockAllAction}>
                <input type="hidden" name="locked" value="yes" />
                <button type="submit" className="pop pop-danger text-xs">
                  🔒 Lock all undecided
                </button>
              </form>
              <form action={lockAllAction}>
                <input type="hidden" name="locked" value="no" />
                <button type="submit" className="pop pop-grass text-xs">
                  🔓 Unlock all
                </button>
              </form>
            </div>
          </div>
          <p className="font-body text-sm text-navy-soft mt-2">
            Per-matchup lock toggles. Locked matchups can&rsquo;t accept new
            predictions or edits. A matchup auto-locks when it resolves with
            a winner regardless of what you set here.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {allMatchups.map((m) => {
              const decided = !!m.winnerUserId;
              const locked = !!m.predictionsLockedAt;
              const seated = !!m.playerAUserId && !!m.playerBUserId;
              const predictable = isPredictable(m);
              const labelA = nameOf(m.playerAUserId);
              const labelB = nameOf(m.playerBUserId);
              return (
                <li
                  key={m.id}
                  className="card-sm bg-white px-3 py-2 flex flex-wrap items-center gap-3"
                >
                  <span
                    className={
                      "font-display text-xs px-2 py-1 rounded-md border-2 border-navy " +
                      (m.bracket === "main"
                        ? "bg-sky2 text-white"
                        : "bg-coral-deep text-white")
                    }
                  >
                    {m.bracket === "main" ? "🏆 main" : "💔 losers"} R{m.roundIndex}/s{m.slot}
                  </span>
                  <span className="font-display text-base text-navy flex-1 min-w-0 truncate">
                    {labelA} vs {labelB}
                  </span>
                  <span className="font-body text-xs text-navy-soft">
                    {pointValueFor(m)}pt
                  </span>
                  {decided ? (
                    <span className="font-display text-xs px-2 py-1 rounded-md border-2 border-navy bg-grass text-white">
                      ✓ {nameOf(m.winnerUserId)}
                    </span>
                  ) : !seated ? (
                    <span className="font-display text-xs text-navy-soft">⏳ awaiting</span>
                  ) : (
                    <form action={lockMatchupAction}>
                      <input type="hidden" name="matchupId" value={m.id} />
                      <input
                        type="hidden"
                        name="locked"
                        value={locked ? "no" : "yes"}
                      />
                      <button
                        type="submit"
                        className={
                          "pop text-xs " + (locked ? "pop-grass" : "pop-coral")
                        }
                      >
                        {locked ? "🔓 unlock" : "🔒 lock"}
                      </button>
                    </form>
                  )}
                  {predictable ? null : decided ? null : !seated ? null : (
                    <span className="font-body text-xs text-navy-soft">locked</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card px-5 py-5">
          <h2 className="font-display text-xl text-navy">Leaderboard</h2>
          {leaderboard.length === 0 ? (
            <p className="font-body text-sm text-navy-soft mt-2">
              No predictions made yet.
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2">
              {leaderboard.map((r, i) => (
                <li
                  key={r.userId}
                  className="card-sm bg-white px-3 py-2 flex items-center gap-3"
                >
                  <span className="font-display text-lg text-navy w-8 text-right">
                    {i + 1}.
                  </span>
                  <span className="font-display text-base text-navy flex-1 truncate">
                    {r.name ?? r.email ?? "—"}
                  </span>
                  <span className="font-body text-xs text-navy-soft">
                    {r.correctCount}/{r.resolvedCount} correct · {r.predictionsMade} picked
                  </span>
                  <span className="font-display text-base text-navy">
                    {r.totalPoints} pts
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Stage>
  );
}
