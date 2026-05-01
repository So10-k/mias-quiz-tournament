import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { BracketView } from "@/components/BracketView";
import { currentUser } from "@/lib/session";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import { getBracket, getBracketUsers } from "@/lib/bracket";
import {
  getMyPredictions,
  getPredictionsSettings,
  pointValueFor,
} from "@/lib/predictions";

export const dynamic = "force-dynamic";

export default async function PredictPage() {
  const me = await currentUser();
  if (!me) redirect("/signin");

  const settings = await getPredictionsSettings();
  if (!settings.enabled && me.role !== "author") notFound();

  const tournament =
    (await getActiveTournament()) ?? (await getLatestTournament());
  if (!tournament) notFound();

  const [mainRounds, losersRounds, users, myPreds] = await Promise.all([
    getBracket(tournament.id, "main"),
    getBracket(tournament.id, "losers"),
    getBracketUsers(tournament.id),
    getMyPredictions(me.id, tournament.id),
  ]);

  // Predictions map for the BracketView overlay (matchupId → picked userId).
  const predictionsByMatchup = new Map<string, string>();
  for (const [mid, p] of myPreds) {
    predictionsByMatchup.set(mid, p.predictedWinnerUserId);
  }

  // Score / progress.
  const allMatchups = [...mainRounds, ...losersRounds].flatMap(
    (r) => r.matchups
  );
  const decided = allMatchups.filter((m) => !!m.winnerUserId);
  const predictableNow = allMatchups.filter(
    (m) =>
      !m.winnerUserId &&
      !m.predictionsLockedAt &&
      !!m.playerAUserId &&
      !!m.playerBUserId
  ).length;
  let myPoints = 0;
  let myCorrect = 0;
  let myResolved = 0;
  for (const m of decided) {
    const pick = predictionsByMatchup.get(m.id);
    if (!pick) continue;
    myResolved++;
    if (pick === m.winnerUserId) {
      myCorrect++;
      myPoints += pointValueFor(m);
    }
  }
  const haveAnyPicks = predictionsByMatchup.size > 0;
  const hasLosers = losersRounds.length > 0;

  return (
    <Stage scrollable>
      <div className="max-w-6xl mx-auto pt-4 px-4 flex flex-col gap-5 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">
            🔮 Bracket Predictions
          </h1>
          <Link href="/predict/leaderboard" className="pop pop-coral text-sm">
            🏆 Leaderboard
          </Link>
        </div>

        {settings.prize ? (
          <div className="card-sm bg-coral text-white px-5 py-3">
            <p className="font-display text-base">🏆 Prize: {settings.prize}</p>
          </div>
        ) : null}

        {/* Hero: status + launch */}
        <section className="card px-5 py-6 text-center flex flex-col items-center gap-3">
          {haveAnyPicks ? (
            <>
              <p className="font-display text-base text-navy-soft uppercase tracking-widest">
                Your bracket
              </p>
              <p className="font-display text-4xl text-navy leading-none">
                {predictionsByMatchup.size}{" "}
                <span className="text-navy-soft text-2xl">
                  / {predictableNow + myResolved} picks made
                </span>
              </p>
              <p className="font-body text-sm text-navy-soft">
                Score so far: <strong>{myPoints} pts</strong> ·{" "}
                {myCorrect} correct of {myResolved} resolved
              </p>
              <Link
                href="/predict/play"
                className="pop pop-coral text-xl mt-1"
              >
                {predictionsByMatchup.size >= predictableNow + myResolved
                  ? "🎬 Tweak your picks"
                  : "🎬 Continue picking"}
              </Link>
            </>
          ) : (
            <>
              <p className="font-display text-base text-navy-soft uppercase tracking-widest">
                You haven&rsquo;t picked yet
              </p>
              <p className="font-display text-4xl text-navy leading-tight">
                Launch the experience.
              </p>
              <p className="font-body text-base text-navy-soft max-w-md">
                Cinematic bracket walkthrough. Pick winners. The next round
                auto-fills based on your calls. Editable until each match
                locks.
              </p>
              <Link
                href="/predict/play"
                className="pop pop-coral text-xl mt-1"
              >
                🎬 Launch experience
              </Link>
            </>
          )}
        </section>

        <div className="card px-5 py-5">
          <h2 className="font-display text-xl text-navy mb-3">
            🏆 Main bracket
          </h2>
          <BracketView
            rounds={mainRounds}
            users={users}
            championId={null}
            predictions={predictionsByMatchup}
          />
        </div>

        {hasLosers ? (
          <div className="card px-5 py-5">
            <h2 className="font-display text-xl text-coral-deep mb-3">
              💔 Losers bracket
            </h2>
            <BracketView
              rounds={losersRounds}
              users={users}
              championId={null}
              predictions={predictionsByMatchup}
            />
          </div>
        ) : null}

        <p className="font-body text-xs text-navy-soft text-center mt-2">
          Coral cards with a ★ are your picks. Green cards are decided
          matchups you got right; coral-deep+strikethrough means your pick
          lost. Blank slots = waiting for an upstream matchup to resolve.
          Tap{" "}
          <strong>Launch the experience</strong> at the top to change
          anything.
        </p>
      </div>
    </Stage>
  );
}
