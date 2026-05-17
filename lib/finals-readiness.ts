// Pre-flight readiness audit for the finals broadcast.
//
// Returns a list of checks with a traffic-light severity. The host
// console renders this so Sam can glance at one panel and know
// whether anything's missing 24 hours / 1 hour / 5 minutes before
// the show.

import { db, schema } from "@/db";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getActiveTournament, getLatestTournament } from "@/lib/engine";
import {
  getAllFinalistUserIds,
  getWinnersFinalMatchupId,
  getLosersFinalMatchupId,
} from "@/lib/finals-access";
import { getZohoWebinar } from "@/lib/zoho-webinar";
import {
  getFinalsRoundSummary,
  type FinalsRoundSummary,
} from "@/lib/finals-rounds";
import { listPublicVideos } from "@/lib/public-assets";

export type CheckSeverity = "ok" | "warn" | "fail";

export type ReadinessCheck = {
  id: string;
  label: string;
  severity: CheckSeverity;
  detail: string;
  /** Optional link to the page that fixes the problem. */
  fixUrl?: string;
  fixLabel?: string;
};

export type FinalistRosterEntry = {
  userId: string;
  name: string | null;
  email: string;
  bracket: "winners" | "losers";
  ndaAgreedAt: Date | null;
};

export type FinalsReadiness = {
  checks: ReadinessCheck[];
  // Aggregate severity: worst-of.
  overall: CheckSeverity;
  // Helpful for the UI — pre-resolved + sorted finalist roster.
  roster: FinalistRosterEntry[];
  // Slot summaries also surface here so the UI can mark a slot red
  // when not_created, yellow when pre_start.
  slots: {
    championship: FinalsRoundSummary;
    rehearsal: FinalsRoundSummary;
    winners: FinalsRoundSummary;
    losers: FinalsRoundSummary;
  };
};

function severityRank(s: CheckSeverity): number {
  return s === "fail" ? 2 : s === "warn" ? 1 : 0;
}

export async function getFinalsReadiness(): Promise<FinalsReadiness> {
  const checks: ReadinessCheck[] = [];

  const tournament =
    (await getActiveTournament()) ?? (await getLatestTournament());
  if (!tournament) {
    checks.push({
      id: "tournament",
      label: "Tournament exists",
      severity: "fail",
      detail: "No tournament rows in the DB. Create one before doing anything else.",
      fixUrl: "/host",
      fixLabel: "Open host panel",
    });
    return {
      checks,
      overall: "fail",
      roster: [],
      slots: {
        rehearsal: await getFinalsRoundSummary("rehearsal"),
        winners: await getFinalsRoundSummary("winners"),
        losers: await getFinalsRoundSummary("losers"),
        championship: await getFinalsRoundSummary("championship"),
      },
    };
  } else {
    checks.push({
      id: "tournament",
      label: "Tournament exists",
      severity: "ok",
      detail: `"${tournament.title}" (status: ${tournament.status})`,
    });
  }

  // Bracket: both finals have two players.
  const [winnersMatchupId, losersMatchupId] = await Promise.all([
    getWinnersFinalMatchupId(),
    getLosersFinalMatchupId(),
  ]);
  const winnersMatchup = winnersMatchupId
    ? (
        await db
          .select()
          .from(schema.matchups)
          .where(eq(schema.matchups.id, winnersMatchupId))
          .limit(1)
      )[0] ?? null
    : null;
  const losersMatchup = losersMatchupId
    ? (
        await db
          .select()
          .from(schema.matchups)
          .where(eq(schema.matchups.id, losersMatchupId))
          .limit(1)
      )[0] ?? null
    : null;

  if (!winnersMatchup) {
    checks.push({
      id: "bracket-winners",
      label: "Winners' bracket has a final",
      severity: "fail",
      detail:
        "Couldn't find a deepest-round matchup in the main bracket. Generate the bracket from /host.",
      fixUrl: "/host",
      fixLabel: "Generate bracket",
    });
  } else if (!winnersMatchup.playerAUserId || !winnersMatchup.playerBUserId) {
    checks.push({
      id: "bracket-winners",
      label: "Winners' final has both players",
      severity: "warn",
      detail:
        "The winners' bracket final exists but isn't fully populated yet (a feeder match hasn't resolved).",
      fixUrl: "/host",
      fixLabel: "Resolve feeder matches",
    });
  } else {
    checks.push({
      id: "bracket-winners",
      label: "Winners' bracket final ready",
      severity: "ok",
      detail: "Both players seated.",
    });
  }

  if (!losersMatchup) {
    checks.push({
      id: "bracket-losers",
      label: "Losers' bracket has a final",
      severity: "fail",
      detail:
        "Couldn't find a deepest-round matchup in the losers bracket. Generate / fill the losers bracket from /host.",
      fixUrl: "/host",
      fixLabel: "Open host panel",
    });
  } else if (!losersMatchup.playerAUserId || !losersMatchup.playerBUserId) {
    checks.push({
      id: "bracket-losers",
      label: "Losers' final has both players",
      severity: "warn",
      detail:
        "The losers' bracket final exists but isn't fully populated yet.",
      fixUrl: "/host",
      fixLabel: "Resolve feeder matches",
    });
  } else {
    checks.push({
      id: "bracket-losers",
      label: "Losers' bracket final ready",
      severity: "ok",
      detail: "Both players seated.",
    });
  }

  // Finalist roster + NDA status.
  const finalistIds = await getAllFinalistUserIds();
  const roster: FinalistRosterEntry[] = [];
  if (finalistIds.length > 0) {
    const userRows = await db
      .select()
      .from(schema.users)
      .where(inArray(schema.users.id, finalistIds));
    const byId = new Map(userRows.map((u) => [u.id, u]));
    const winnersIds = new Set(
      winnersMatchup
        ? [winnersMatchup.playerAUserId, winnersMatchup.playerBUserId].filter(
            (x): x is string => !!x
          )
        : []
    );
    for (const id of finalistIds) {
      const u = byId.get(id);
      if (!u) continue;
      roster.push({
        userId: u.id,
        name: u.name,
        email: u.email,
        bracket: winnersIds.has(id) ? "winners" : "losers",
        ndaAgreedAt: u.finalsNdaAgreedAt,
      });
    }
    // Stable order: winners first, then by name.
    roster.sort((a, b) => {
      if (a.bracket !== b.bracket) return a.bracket === "winners" ? -1 : 1;
      return (a.name ?? a.email).localeCompare(b.name ?? b.email);
    });
  }

  const expectedFinalists =
    (winnersMatchup ? 2 : 0) + (losersMatchup ? 2 : 0);
  if (roster.length < expectedFinalists) {
    checks.push({
      id: "roster",
      label: "All 4 finalist user records exist",
      severity: "fail",
      detail: `Only ${roster.length} of ${expectedFinalists} expected finalist users were found in the DB. Bracket seats reference missing users.`,
    });
  } else if (roster.length === 0) {
    checks.push({
      id: "roster",
      label: "Finalist roster",
      severity: "warn",
      detail: "No finalists detected yet — depends on bracket generation.",
    });
  } else {
    checks.push({
      id: "roster",
      label: "Finalist user records present",
      severity: "ok",
      detail: `${roster.length} finalists wired up.`,
    });
  }

  // NDA — every finalist should have finalsNdaAgreedAt set before the
  // broadcast starts. Warn (not fail) if not — host can chase them.
  const missingNda = roster.filter((r) => !r.ndaAgreedAt);
  if (missingNda.length === 0 && roster.length > 0) {
    checks.push({
      id: "nda",
      label: "All finalists agreed to NDA",
      severity: "ok",
      detail: "Confidentiality terms accepted by all four.",
    });
  } else if (roster.length > 0) {
    checks.push({
      id: "nda",
      label: "Finalists missing NDA agreement",
      severity: "warn",
      detail: `${missingNda.length} finalist(s) haven't replied "yes I agree" in their Discourse PM yet: ${missingNda
        .map((m) => m.name ?? m.email)
        .join(", ")}.`,
      fixUrl: "/host/forum-roles",
      fixLabel: "Check forum status",
    });
  }

  // Zoho webinar URL.
  const webinar = await getZohoWebinar();
  if (!webinar.joinUrl && !webinar.embedUrl) {
    checks.push({
      id: "zoho",
      label: "Zoho webinar URL set",
      severity: "fail",
      detail:
        "/live can't show a join button — finalists won't be able to enter the webinar from inside the site.",
      fixUrl: "/host/finals-control",
      fixLabel: "Paste the webinar URL",
    });
  } else if (webinar.joinUrl && !webinar.embedUrl) {
    checks.push({
      id: "zoho",
      label: "Zoho webinar join URL set",
      severity: "ok",
      detail:
        "Join button will appear on /live. (Embed URL is optional — set it to iframe the webinar in-page.)",
    });
  } else {
    checks.push({
      id: "zoho",
      label: "Zoho webinar fully configured",
      severity: "ok",
      detail: "Both join and embed URLs are set.",
    });
  }

  // Finals rounds — all four slots.
  const [rehearsal, winners, losers, championship] = await Promise.all([
    getFinalsRoundSummary("rehearsal"),
    getFinalsRoundSummary("winners"),
    getFinalsRoundSummary("losers"),
    getFinalsRoundSummary("championship"),
  ]);

  function slotCheck(slot: FinalsRoundSummary, label: string) {
    if (slot.status === "not_created") {
      checks.push({
        id: `round-${slot.slot}`,
        label: `${label} round ready`,
        severity: slot.slot === "rehearsal" ? "warn" : "warn",
        detail:
          "Hasn't been created yet — clicking Launch on its card auto-creates from the question library.",
      });
    } else if (slot.totalQuestions === 0) {
      checks.push({
        id: `round-${slot.slot}`,
        label: `${label} has questions`,
        severity: "fail",
        detail: "Round exists but has no questions. Edit it before launching.",
      });
    } else if (slot.status === "complete") {
      checks.push({
        id: `round-${slot.slot}`,
        label: `${label} round`,
        severity: "warn",
        detail:
          "Already marked complete from a previous run. Reset via its control panel before re-running.",
      });
    } else {
      checks.push({
        id: `round-${slot.slot}`,
        label: `${label} round ready`,
        severity: "ok",
        detail: `${slot.totalQuestions} questions queued (status: ${slot.status}).`,
      });
    }
  }
  slotCheck(rehearsal, "Rehearsal");
  slotCheck(winners, "Winners' Final");
  slotCheck(losers, "Losers' Final");
  slotCheck(championship, "Championship");

  // Library not empty (needed if any slot still needs creation).
  const [{ libCount }] = await db
    .select({ libCount: sql<number>`count(*)::int` })
    .from(schema.libraryQuestions);
  if (libCount === 0) {
    checks.push({
      id: "library",
      label: "Question library has content",
      severity: "fail",
      detail:
        "Empty libraryQuestions table. Launch buttons that need to auto-create rounds will throw.",
    });
  } else {
    checks.push({
      id: "library",
      label: "Question library populated",
      severity: "ok",
      detail: `${libCount} library questions available.`,
    });
  }

  // Public assets — at minimum the finals-invite + finals-intro video
  // should exist so the Scene Director's video/image dropdowns have
  // something to offer.
  const videos = await listPublicVideos();
  if (videos.length === 0) {
    checks.push({
      id: "videos",
      label: "Public videos available",
      severity: "warn",
      detail:
        "No videos in /public/videos. The Video scene will be empty.",
    });
  } else {
    checks.push({
      id: "videos",
      label: "Video assets present",
      severity: "ok",
      detail: `${videos.length} video(s) in /public/videos.`,
    });
  }

  // Aggregate severity.
  const overall: CheckSeverity = checks.reduce<CheckSeverity>(
    (acc, c) => (severityRank(c.severity) > severityRank(acc) ? c.severity : acc),
    "ok"
  );

  return {
    checks,
    overall,
    roster,
    slots: { rehearsal, winners, losers, championship },
  };
}
