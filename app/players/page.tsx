import Link from "next/link";
import { Stage } from "@/components/Stage";
import { PlayerCard } from "@/components/PlayerCard";
import {
  getActiveTournament,
  getCast,
  getLatestTournament,
} from "@/lib/engine";

export const dynamic = "force-dynamic";

function numberWord(n: number) {
  return (
    ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven"][n] ??
    String(n)
  );
}

export default async function CastPage() {
  const tournament =
    (await getActiveTournament()) ?? (await getLatestTournament());

  if (!tournament) {
    return (
      <Stage>
        <div className="max-w-2xl mx-auto pt-9">
          <div className="card px-7 py-7 text-center">
            <div className="text-6xl">🪧</div>
            <h1 className="font-display text-3xl text-navy mt-3">
              No tournament yet.
            </h1>
            <Link href="/" className="pop pop-coral mt-7">
              ← Home
            </Link>
          </div>
        </div>
      </Stage>
    );
  }

  const cast = await getCast(tournament.id);
  const active = cast.filter((c) => !c.enrollment.eliminatedAt);
  const eliminated = cast.filter((c) => !!c.enrollment.eliminatedAt);
  const onlyOne = active.length === 1 && tournament.status !== "complete";
  const fewLeft =
    !onlyOne &&
    tournament.status === "in_progress" &&
    active.length > 1 &&
    active.length <= 3;

  const heading = onlyOne
    ? "And then there was one!"
    : fewLeft
    ? `${numberWord(active.length)} players left!`
    : "Players";

  return (
    <Stage scrollable>
      <div className="max-w-5xl mx-auto pt-4">
        <div className="card-sm px-5 py-4 mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl md:text-4xl text-navy">
            {heading}
          </h1>
          <p className="font-display text-base text-navy-soft">
            {active.length} in 🌟 · {eliminated.length} out 💔
          </p>
        </div>

        {cast.length === 0 ? (
          <div className="card px-7 py-7 text-center">
            <div className="text-6xl">📭</div>
            <p className="font-display text-2xl text-navy mt-3">
              Nobody&rsquo;s signed up yet!
            </p>
            <Link href="/join" className="pop pop-coral mt-7">
              ✨ Be the first
            </Link>
          </div>
        ) : (
          <>
            {onlyOne && active[0] ? (
              <div className="mb-7 max-w-md mx-auto">
                <PlayerCard
                  name={active[0].user.name ?? active[0].user.email ?? "—"}
                  strikeCount={active[0].enrollment.strikeCount}
                  strikeLimit={tournament.strikeLimit}
                  eliminated={false}
                  isWinner
                />
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {(onlyOne ? eliminated : cast).map((row) => (
                <PlayerCard
                  key={row.enrollment.id}
                  name={row.user.name ?? row.user.email ?? "—"}
                  strikeCount={row.enrollment.strikeCount}
                  strikeLimit={tournament.strikeLimit}
                  eliminated={!!row.enrollment.eliminatedAt}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </Stage>
  );
}
