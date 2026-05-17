// Embed-mode bracket. Same data as /bracket but bare — designed to
// be iframed from discuss.miaswebsites.art via the
// [quizbook-bracket] shortcode.
//
// We re-use the BracketView component that the public page uses, so
// the rendered content stays in lockstep with whatever the main site
// shows. Just no Nav, no Stage chrome, no header.

import Link from "next/link";
import { BracketView } from "@/components/BracketView";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import {
  getBracket,
  getBracketUsers,
  getBracketChampionId,
} from "@/lib/bracket";

export const dynamic = "force-dynamic";

export default async function EmbedBracketPage() {
  const tournament =
    (await getActiveTournament()) ?? (await getLatestTournament());
  if (!tournament) {
    return (
      <div style={{ padding: "1.5rem", textAlign: "center" }}>
        <p>No active tournament.</p>
      </div>
    );
  }
  const matchups = await getBracket(tournament.id);
  const users = await getBracketUsers(tournament.id);
  const championId = await getBracketChampionId(tournament.id);

  return (
    <div style={{ padding: "12px 16px" }}>
      <BracketView
        rounds={matchups}
        users={users}
        championId={championId}
      />
      <p
        style={{
          marginTop: "12px",
          fontSize: "11px",
          textAlign: "right",
          opacity: 0.7,
        }}
      >
        <Link
          href="https://quiz.miaswebsites.art/bracket"
          target="_top"
          style={{ color: "#3B4A7E" }}
        >
          Open on quiz.miaswebsites.art →
        </Link>
      </p>
    </div>
  );
}
