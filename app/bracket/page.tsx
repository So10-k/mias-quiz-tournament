import Link from "next/link";
import { Stage } from "@/components/Stage";
import { BracketView } from "@/components/BracketView";
import { PageLockedNotice } from "@/components/PageLockedNotice";
import { ArcadeStage } from "@/components/arcade/Stage";
import { ArcadeTitle } from "@/components/arcade/Title";
import { ArcadeBracket } from "@/components/arcade/ArcadeBracket";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import {
  getBracket,
  getBracketUsers,
  getBracketChampionId,
} from "@/lib/bracket";
import { isPageLocked } from "@/lib/page-locks";
import { getSiteTheme } from "@/lib/site-theme";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
  const me = await currentUser();
  if ((await isPageLocked("bracket")) && me?.role !== "author") {
    return <PageLockedNotice title="The bracket" emoji="🏆" />;
  }
  const t =
    (await getActiveTournament()) ?? (await getLatestTournament());

  if (!t) {
    return (
      <Stage>
        <div className="h-[calc(100vh-128px)] flex items-center justify-center px-4">
          <div className="card px-7 py-7 text-center max-w-md">
            <div className="text-6xl">🎟️</div>
            <h1 className="font-display text-3xl text-navy mt-3">
              No bracket yet!
            </h1>
            <Link href="/" className="pop pop-coral mt-5">
              ← Home
            </Link>
          </div>
        </div>
      </Stage>
    );
  }

  const [mainRounds, losersRounds] = await Promise.all([
    getBracket(t.id, "main"),
    getBracket(t.id, "losers"),
  ]);
  const users = await getBracketUsers(t.id);
  const championId = await getBracketChampionId(t.id);
  const hasLosers = losersRounds.length > 0;
  const theme = await getSiteTheme();

  if (theme === "arcade") {
    return (
      <ArcadeStage scrollable>
        <ArcadeTitle
          eyebrow="Live Tournament"
          title="The Bracket"
          subtitle="Win twice or play your way back through the losers bracket."
          links={[
            { href: "/play", label: "▶ Play" },
            { href: "/bracket", label: "Bracket", active: true },
            { href: "/players", label: "Players" },
            { href: "/standings", label: "Standings" },
          ]}
        />
        <ArcadeBracket
          rounds={mainRounds}
          users={users}
          championId={championId}
        />
        {hasLosers ? (
          <>
            <div className="px-4 mt-6">
              <div
                style={{
                  textAlign: "center",
                  fontFamily: "Fredoka, sans-serif",
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#FF2D75",
                  fontSize: 14,
                }}
              >
                ⚔️ Losers bracket — last chance
              </div>
            </div>
            <ArcadeBracket
              rounds={losersRounds}
              users={users}
              championId={null}
            />
          </>
        ) : null}
      </ArcadeStage>
    );
  }

  return (
    <Stage scrollable>
      <div className="max-w-6xl mx-auto pt-4 px-4 flex flex-col gap-5">
        <div className="card-sm px-5 py-3 flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl md:text-4xl text-navy">
            🎟️ Bracket
          </h1>
          <div className="flex gap-2">
            <Link href="/standings" className="pop pop-white text-sm">
              🏅 Standings
            </Link>
            <Link href="/play" className="pop pop-coral text-sm">
              ▶ Play
            </Link>
          </div>
        </div>

        <div className="card px-5 py-5">
          <h2 className="font-display text-xl text-navy mb-3">
            🏆 Main bracket
          </h2>
          <BracketView
            rounds={mainRounds}
            users={users}
            championId={championId}
          />
        </div>
        {hasLosers ? (
          <div className="card px-5 py-5">
            <h2 className="font-display text-xl text-coral-deep mb-3">
              💔 Losers bracket — round-1 fallers&rsquo; second chance
            </h2>
            <BracketView
              rounds={losersRounds}
              users={users}
              championId={null}
            />
          </div>
        ) : null}
      </div>
    </Stage>
  );
}
