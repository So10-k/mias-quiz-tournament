// Auto-post helpers — push tournament events into Discourse so the
// forum reads as a live record of the game, not a separate site.
//
// Each helper is fire-and-forget from the caller's perspective:
// failures log but never throw, since the SOT of the event is in
// the quiz DB and the forum mirror is a courtesy. Idempotency is
// handled via Discourse `external_id` on each topic.

import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { createTopic } from "@/lib/discourse-api";

// Public match recap. Posted to the "round-recaps" Discourse
// category when the host sets a winner on a previously-undecided
// matchup. Idempotent on matchup id.
export async function postMatchRecap(matchupId: string): Promise<void> {
  try {
    const [m] = await db
      .select()
      .from(schema.matchups)
      .where(eq(schema.matchups.id, matchupId))
      .limit(1);
    if (!m || !m.winnerUserId) return;

    const [tournament] = await db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.id, m.tournamentId))
      .limit(1);
    if (!tournament) return;

    const [winner, playerA, playerB] = await Promise.all([
      lookupUser(m.winnerUserId),
      m.playerAUserId ? lookupUser(m.playerAUserId) : null,
      m.playerBUserId ? lookupUser(m.playerBUserId) : null,
    ]);

    if (!winner) return;

    const opponent =
      m.winnerUserId === m.playerAUserId ? playerB : playerA;
    const bracketLabel = m.bracket === "losers" ? "Losers Bracket" : "Main Bracket";
    const roundLabel = `Round ${m.roundIndex}`;

    const title = opponent
      ? `${winner.displayName} defeats ${opponent.displayName} — ${bracketLabel} ${roundLabel}`
      : `${winner.displayName} advances — ${bracketLabel} ${roundLabel}`;

    const raw = [
      `**${winner.displayName}** is through to the next round of *${tournament.title}*.`,
      "",
      opponent
        ? `Bracket matchup: ${winner.displayName} vs ${opponent.displayName}`
        : `Bracket matchup: ${winner.displayName} (bye)`,
      `Resolved via: ${m.resolvedVia ?? "auto"}`,
      `Stage: ${bracketLabel} · ${roundLabel}`,
      "",
      `🌐 Live bracket: https://quiz.miaswebsites.art/standings`,
      "",
      `[quizbook-bracket]`,
    ].join("\n");

    const result = await createTopic({
      title,
      raw,
      categorySlug: "round-recaps",
      tags: ["match-recap", `round-${m.roundIndex}`],
      externalId: `match-${matchupId}`,
    });
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error("forum auto-post failed:", result.error);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("postMatchRecap crashed:", err);
  }
}

async function lookupUser(
  userId: string
): Promise<{ displayName: string } | null> {
  const [u] = await db
    .select({
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!u) return null;
  return { displayName: u.name ?? u.email.split("@")[0] };
}
