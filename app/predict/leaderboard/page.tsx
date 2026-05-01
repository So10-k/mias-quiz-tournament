import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import {
  getLeaderboard,
  getPredictionsSettings,
} from "@/lib/predictions";

export const dynamic = "force-dynamic";

export default async function PredictLeaderboardPage() {
  const me = await currentUser();
  if (!me) redirect("/signin");

  const settings = await getPredictionsSettings();
  if (!settings.enabled && me.role !== "author") notFound();

  const tournament =
    (await getActiveTournament()) ?? (await getLatestTournament());
  if (!tournament) notFound();

  const rows = await getLeaderboard(tournament.id);

  return (
    <Stage scrollable>
      <div className="max-w-2xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">
            🏆 Predictor leaderboard
          </h1>
          <Link href="/predict" className="pop pop-white text-sm">
            ← Predict
          </Link>
        </div>
        {settings.prize ? (
          <div className="card-sm bg-coral text-white px-5 py-3">
            <p className="font-display text-base">🏆 Prize: {settings.prize}</p>
          </div>
        ) : null}
        {rows.length === 0 ? (
          <div className="card px-7 py-7 text-center">
            <p className="font-display text-xl text-navy">
              No predictions yet — be the first.
            </p>
            <Link href="/predict" className="pop pop-coral mt-5 inline-flex">
              ▶ Make your picks
            </Link>
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {rows.map((r, i) => {
              const place = i + 1;
              const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : "";
              const isMe = r.userId === me.id;
              return (
                <li
                  key={r.userId}
                  className={
                    "card-sm px-4 py-3 flex items-center gap-3 " +
                    (isMe ? "bg-sun" : "bg-white")
                  }
                >
                  <span className="font-display text-2xl text-navy w-10 text-right">
                    {medal || `${place}.`}
                  </span>
                  <span className="font-display text-lg text-navy flex-1 truncate">
                    {r.name ?? r.email ?? "—"}
                    {isMe ? (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-coral text-white">
                        you
                      </span>
                    ) : null}
                  </span>
                  <span className="font-body text-sm text-navy-soft">
                    {r.correctCount}/{r.resolvedCount} correct · {r.predictionsMade} picked
                  </span>
                  <span className="font-display text-xl text-navy">
                    {r.totalPoints} pts
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Stage>
  );
}
