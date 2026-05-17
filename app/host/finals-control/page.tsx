// Tournament Director Console — single-page everything-in-one-place
// control panel for finals night. Sections, top-to-bottom:
//
//   1. Header + quick links
//   2. Pre-flight readiness audit (the "is anything missing?" panel)
//   3. Run Show runbook — staged event automation
//   4. Finalist roster (names, NDA status)
//   5. Three round-launch cards (Rehearsal / Losers / Winners)
//   6. Inline live HUD (renders whenever a finals round is running)
//   7. Scene Director — quick-switch + inline content editors
//   8. Zoho webinar URL settings
//   9. Secret cohost user-id config

import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { AutoRefresh } from "@/components/AutoRefresh";
import { LiveEffectOverlay } from "@/components/LiveEffectOverlay";
import { currentUser } from "@/lib/session";
import { db, schema } from "@/db";
import { asc, eq, inArray } from "drizzle-orm";
import {
  getFinalsRoundSummary,
  type FinalsRoundSummary,
  type FinalsSlot,
} from "@/lib/finals-rounds";
import { getZohoWebinar } from "@/lib/zoho-webinar";
import {
  getWinnersFinalMatchupId,
  getLosersFinalMatchupId,
} from "@/lib/finals-access";
import {
  getWatchScene,
  type WatchSceneKind,
} from "@/lib/watch-scene";
import { listPublicVideos, listPublicImages } from "@/lib/public-assets";
import { EVENT_VIDEOS } from "@/remotion/eventVideos";
import { getFinalsReadiness } from "@/lib/finals-readiness";
import {
  EVENT_STAGES,
  getCurrentStageIndex,
} from "@/lib/event-runbook";
import { getLiveRoundState, LIVE_EFFECTS } from "@/lib/live";
import {
  launchFinalsRoundAction,
  saveZohoWebinarAction,
  saveCohostAction,
  switchSceneAction,
  saveSceneContentAction,
  advanceStageAction,
  backStageAction,
  jumpStageAction,
  resetRunbookAction,
  startRoundAction,
  advanceRoundAction,
  lockRoundAction,
  completeRoundAction,
  resetRoundAction,
  triggerEffectAction,
  clearEffectInlineAction,
} from "./actions";

export const dynamic = "force-dynamic";

// ────────────────────────────────────────────────────────────────────
// Static config tables
// ────────────────────────────────────────────────────────────────────

const SLOT_DEF: Record<
  FinalsSlot,
  {
    label: string;
    tagline: string;
    accent: string;
    accentBorder: string;
    emoji: string;
    description: string;
  }
> = {
  rehearsal: {
    label: "Rehearsal",
    tagline: "Practice run · open to all signed-in players",
    accent: "bg-sun text-navy",
    accentBorder: "border-coral-deep",
    emoji: "🎬",
    description:
      "Same flow as the finals, with random library questions. No bracket effects, no strikes — pure dress rehearsal.",
  },
  losers: {
    label: "Losers' Final",
    tagline: "🥈 Grandpa vs Sam · 🌍 Famous places (extreme)",
    accent: "bg-coral text-white",
    accentBorder: "border-navy",
    emoji: "🥈",
    description:
      "Real round. Only the two losers-bracket finalists can answer. Famous-places trivia, extreme difficulty — separate set from the winners' final.",
  },
  winners: {
    label: "Winners' Final",
    tagline: "🏆 Karen vs Marc · 🌍 Famous places (extreme)",
    accent: "bg-grass text-white",
    accentBorder: "border-navy",
    emoji: "🏆",
    description:
      "Real round. Only the two winners-bracket finalists can answer. Famous-places trivia, extreme difficulty — separate set from the losers' final.",
  },
  championship: {
    label: "Championship",
    tagline: "👑 WB winner vs LB winner · 🎭 Misc (hard)",
    accent: "bg-navy text-white",
    accentBorder: "border-coral-deep",
    emoji: "👑",
    description:
      "The crown match. Miscellaneous hard trivia — different subject every question, no theme to study. Blinded from the host since Sam may play.",
  },
};

type ScenePreset = {
  kind: WatchSceneKind;
  label: string;
  emoji: string;
};
const SCENE_PRESETS: ScenePreset[] = [
  { kind: "question", label: "Question", emoji: "❓" },
  { kind: "players", label: "Players", emoji: "👥" },
  { kind: "bracket-main", label: "Winners bracket", emoji: "🏆" },
  { kind: "bracket-losers", label: "Losers bracket", emoji: "🥈" },
  { kind: "both-brackets", label: "Both brackets", emoji: "🪜" },
  { kind: "slide", label: "Live slide", emoji: "🎞️" },
  { kind: "video", label: "Video file", emoji: "🎬" },
  { kind: "image", label: "Image", emoji: "🖼️" },
  { kind: "text", label: "Text", emoji: "✍️" },
  { kind: "intermission", label: "Intermission", emoji: "🌞" },
];

function mbStr(bytes: number): string {
  if (!bytes) return "?";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return mb.toFixed(1) + " MB";
  return Math.round(bytes / 1024) + " KB";
}

function statusBadge(s: FinalsRoundSummary["status"]): {
  text: string;
  cls: string;
} {
  switch (s) {
    case "not_created":
      return { text: "READY TO LAUNCH", cls: "bg-white text-navy" };
    case "pre_start":
      return { text: "READY · NOT STARTED", cls: "bg-sky1 text-navy" };
    case "running":
      return { text: "● LIVE", cls: "bg-coral-deep text-white" };
    case "revealing":
      return { text: "REVEAL", cls: "bg-sun text-navy" };
    case "complete":
      return { text: "COMPLETE", cls: "bg-navy text-white" };
  }
}

function launchButtonLabel(s: FinalsRoundSummary["status"]): string {
  switch (s) {
    case "not_created":
      return "🚀 Create + start round";
    case "pre_start":
      return "🚀 Start round now";
    case "running":
      return "🎙️ Show controls";
    case "revealing":
      return "🎙️ Show controls";
    case "complete":
      return "📜 Round complete";
  }
}

async function namesForFinalists(matchupId: string | null): Promise<string> {
  if (!matchupId) return "— matchup not generated yet —";
  const [m] = await db
    .select()
    .from(schema.matchups)
    .where(eq(schema.matchups.id, matchupId))
    .limit(1);
  if (!m) return "— matchup missing —";
  const ids = [m.playerAUserId, m.playerBUserId].filter(
    (x): x is string => !!x
  );
  if (ids.length === 0) return "— TBD —";
  const us = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, ids));
  const byId = new Map(us.map((u) => [u.id, u.name ?? u.email]));
  return ids.map((i) => byId.get(i) ?? "?").join(" vs ");
}

// ────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────

export default async function FinalsControlPage({
  searchParams,
}: {
  searchParams?: Promise<{ round?: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/signin?next=/host/finals-control");
  if (me.role !== "author") redirect("/");

  const sp = (await searchParams) ?? {};
  const requestedRound = (sp.round ?? "").toString() as FinalsSlot | "";

  const [
    readiness,
    webinar,
    winnersMatchupId,
    losersMatchupId,
    scene,
    videos,
    images,
    runbookIndex,
  ] = await Promise.all([
    getFinalsReadiness(),
    getZohoWebinar(),
    getWinnersFinalMatchupId(),
    getLosersFinalMatchupId(),
    getWatchScene(),
    listPublicVideos(),
    listPublicImages(),
    getCurrentStageIndex(),
  ]);

  const rehearsal = readiness.slots.rehearsal;
  const losers = readiness.slots.losers;
  const winners = readiness.slots.winners;
  const championship = readiness.slots.championship;

  const winnersNames = await namesForFinalists(winnersMatchupId);
  const losersNames = await namesForFinalists(losersMatchupId);
  // Championship matchup id only exists once the championship round
  // has been launched (it's created lazily via launchFinalsRound).
  const championshipNames = await namesForFinalists(
    championship.matchupId ?? null
  );

  // First 2 question prompts per slot — gives Sam a glance preview
  // on the launch card so he can tell "yep, my real Qs are in there"
  // without opening the editor.
  const previewByRoundId = new Map<string, string[]>();
  const roundIds = [rehearsal, losers, winners, championship]
    .map((s) => s.roundId)
    .filter((x): x is string => !!x);
  if (roundIds.length > 0) {
    const previewRows = await db
      .select({
        roundId: schema.questions.roundId,
        order: schema.questions.order,
        prompt: schema.questions.prompt,
      })
      .from(schema.questions)
      .where(inArray(schema.questions.roundId, roundIds))
      .orderBy(asc(schema.questions.roundId), asc(schema.questions.order));
    for (const row of previewRows) {
      const arr = previewByRoundId.get(row.roundId) ?? [];
      if (arr.length < 2) {
        arr.push(row.prompt);
        previewByRoundId.set(row.roundId, arr);
      }
    }
  }

  const [cohostRow] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, "finals_cohost_user_ids"))
    .limit(1);
  const cohostIds = cohostRow?.value ?? "";

  // The HUD-target round. Priority:
  //   1. `?round=<slot>` from URL — if it has a roundId, show its HUD
  //      regardless of status (so Sam can pull up controls on a
  //      not-yet-live round to start it).
  //   2. Whichever slot is currently running/revealing/pre_start —
  //      championship first so the crown dominates once live.
  const byName: Record<FinalsSlot, FinalsRoundSummary> = {
    rehearsal,
    losers,
    winners,
    championship,
  };
  let liveSummary: FinalsRoundSummary | undefined;
  if (
    requestedRound &&
    (["rehearsal", "losers", "winners", "championship"] as FinalsSlot[]).includes(
      requestedRound as FinalsSlot
    )
  ) {
    const candidate = byName[requestedRound as FinalsSlot];
    if (candidate.roundId) liveSummary = candidate;
  }
  if (!liveSummary) {
    liveSummary = [championship, winners, losers, rehearsal].find(
      (s) =>
        s.status === "running" ||
        s.status === "revealing" ||
        s.status === "pre_start"
    );
  }
  const liveSlot: { slot: FinalsSlot; summary: FinalsRoundSummary } | null =
    liveSummary ? { slot: liveSummary.slot, summary: liveSummary } : null;
  const liveRoundView =
    liveSlot && liveSlot.summary.roundId
      ? await getLiveRoundState({
          roundId: liveSlot.summary.roundId,
          viewerUserId: me.id,
        })
      : null;

  const cards: Array<{
    slot: FinalsSlot;
    summary: FinalsRoundSummary;
    overrideName?: string;
  }> = [
    { slot: "rehearsal", summary: rehearsal },
    { slot: "losers", summary: losers, overrideName: losersNames },
    { slot: "winners", summary: winners, overrideName: winnersNames },
    {
      slot: "championship",
      summary: championship,
      overrideName: championshipNames,
    },
  ];

  const currentStage =
    runbookIndex >= 0 && runbookIndex < EVENT_STAGES.length
      ? EVENT_STAGES[runbookIndex]
      : null;
  const nextStage =
    runbookIndex + 1 < EVENT_STAGES.length
      ? EVENT_STAGES[runbookIndex + 1]
      : null;

  return (
    <Stage scrollable>
      {/* Auto-refresh during a live round so the inline HUD picks up
          finalist answer changes without a manual reload. */}
      {liveRoundView ? <AutoRefresh seconds={2} /> : null}
      {/* Host previews the same effect overlay attendees see (helps QA). */}
      {liveRoundView ? (
        <LiveEffectOverlay
          effect={liveRoundView.effect.effect}
          at={liveRoundView.effect.at}
          message={liveRoundView.effect.message}
        />
      ) : null}

      <div className="max-w-6xl mx-auto pt-4 px-4 pb-12 flex flex-col gap-6">
        {/* ── Header ───────────────────────────────────────────── */}
        <header className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
              Host · Finals Control
            </p>
            <h1 className="font-display text-3xl md:text-4xl text-navy mt-0.5">
              🎙️ Tournament Director Console
            </h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/host" className="pop pop-white text-sm">
              ← Host
            </Link>
            <Link href="/watch" target="_blank" className="pop pop-coral text-sm">
              👁 /watch
            </Link>
            <Link href="/live" target="_blank" className="pop pop-coral text-sm">
              🎟️ /live
            </Link>
            <Link href="/standings" target="_blank" className="pop pop-sky text-sm">
              📊 Standings
            </Link>
          </div>
        </header>

        {/* ── Pre-flight readiness audit ──────────────────────── */}
        <section
          className={
            "card px-6 py-5 border-4 " +
            (readiness.overall === "fail"
              ? "border-coral-deep"
              : readiness.overall === "warn"
                ? "border-coral"
                : "border-grass")
          }
        >
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="font-display text-2xl text-navy">
              ✅ Pre-flight readiness
            </h2>
            <span
              className={
                "font-display text-sm px-3 py-1 rounded-full border-2 border-navy " +
                (readiness.overall === "fail"
                  ? "bg-coral-deep text-white"
                  : readiness.overall === "warn"
                    ? "bg-coral text-white"
                    : "bg-grass text-white")
              }
            >
              {readiness.overall === "fail"
                ? "BLOCKED"
                : readiness.overall === "warn"
                  ? "MINOR ISSUES"
                  : "READY"}
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-1.5">
            {readiness.checks.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-2 font-body text-sm text-navy"
              >
                <span
                  className="inline-block w-5 text-center"
                  aria-hidden
                  style={{
                    color:
                      c.severity === "fail"
                        ? "#C9296A"
                        : c.severity === "warn"
                          ? "#FF8C42"
                          : "#5BCE7A",
                  }}
                >
                  {c.severity === "fail"
                    ? "✗"
                    : c.severity === "warn"
                      ? "⚠"
                      : "✓"}
                </span>
                <span className="flex-1">
                  <strong>{c.label}</strong> — {c.detail}
                  {c.fixUrl ? (
                    <>
                      {" · "}
                      <Link
                        href={c.fixUrl}
                        className="text-coral-deep underline"
                      >
                        {c.fixLabel ?? "fix"}
                      </Link>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Run Show — runbook orchestration ────────────────── */}
        <section className="card px-6 py-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-display text-2xl text-navy">
                🎯 Run Show
              </h2>
              <p className="font-body text-sm text-navy-soft mt-1">
                One click per stage. Each Advance flips /watch + (when
                relevant) starts / completes the round.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-display text-sm text-navy">
                Stage{" "}
                <strong>
                  {runbookIndex < 0 ? 0 : runbookIndex + 1}
                </strong>{" "}
                <span className="text-navy-soft">/ {EVENT_STAGES.length}</span>
              </span>
              <form action={backStageAction}>
                <button className="pop pop-white text-sm">← Back</button>
              </form>
              <form action={advanceStageAction}>
                <button className="pop pop-coral text-base">
                  ▶ Advance stage
                </button>
              </form>
            </div>
          </div>

          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div
              className="card-sm bg-white px-4 py-3 border-3 border-navy"
              style={{ boxShadow: "6px 6px 0 #FFD93D" }}
            >
              <p className="font-display text-xs uppercase tracking-[0.18em] text-coral-deep">
                Now playing
              </p>
              {currentStage ? (
                <>
                  <p className="font-display text-lg text-navy mt-1">
                    {currentStage.chapter} · {currentStage.label}
                  </p>
                  <p className="font-body text-sm text-navy-soft mt-1">
                    {currentStage.tagline}
                  </p>
                </>
              ) : (
                <p className="font-display text-lg text-navy mt-1">
                  Pre-show — runbook not started
                </p>
              )}
            </div>
            <div
              className="card-sm bg-white px-4 py-3 border-3 border-navy"
              style={{ boxShadow: "6px 6px 0 #87CEEB" }}
            >
              <p className="font-display text-xs uppercase tracking-[0.18em] text-coral-deep">
                Up next
              </p>
              {nextStage ? (
                <>
                  <p className="font-display text-lg text-navy mt-1">
                    {nextStage.chapter} · {nextStage.label}
                  </p>
                  <p className="font-body text-sm text-navy-soft mt-1">
                    {nextStage.tagline}
                  </p>
                </>
              ) : (
                <p className="font-display text-lg text-navy mt-1 italic">
                  End of show.
                </p>
              )}
            </div>
          </div>

          {/* Jump-to-stage selector */}
          <form
            action={jumpStageAction}
            className="mt-4 flex items-center gap-2 flex-wrap"
          >
            <label className="font-display text-sm text-navy">
              Jump to:
              <select
                name="index"
                defaultValue={runbookIndex}
                className="ml-2 card-sm bg-white px-2 py-1 text-sm font-body border-2 border-navy"
              >
                <option value="-1">— Pre-show —</option>
                {EVENT_STAGES.map((s, i) => (
                  <option key={s.id} value={i}>
                    {i + 1}. {s.chapter} — {s.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="pop pop-white text-sm">Jump</button>
          </form>

          {/* Full stage list, collapsed */}
          <details className="mt-4">
            <summary className="font-display text-sm text-coral-deep cursor-pointer">
              Show full runbook ({EVENT_STAGES.length} stages)
            </summary>
            <ol className="mt-2 flex flex-col gap-1">
              {EVENT_STAGES.map((s, i) => {
                const isCurrent = i === runbookIndex;
                return (
                  <li
                    key={s.id}
                    className={
                      "px-3 py-2 rounded-lg border-2 border-navy flex items-center gap-2 " +
                      (isCurrent
                        ? "bg-sun"
                        : i < runbookIndex
                          ? "bg-white opacity-60"
                          : "bg-white")
                    }
                  >
                    <span className="font-display text-xs text-coral-deep w-6 text-right">
                      {i + 1}.
                    </span>
                    <span className="font-display text-xs text-navy uppercase tracking-[0.12em] w-44">
                      {s.chapter}
                    </span>
                    <span className="font-body text-sm text-navy flex-1 min-w-0 truncate">
                      {s.label}
                    </span>
                    {isCurrent ? (
                      <span className="font-display text-[10px] px-2 py-0.5 rounded bg-coral-deep text-white">
                        ● NOW
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </details>

          {/* Reset (destructive) */}
          <details className="mt-4">
            <summary className="font-body text-xs text-coral-deep cursor-pointer">
              ⚠ Reset runbook to pre-show
            </summary>
            <form
              action={resetRunbookAction}
              className="mt-2 flex items-center gap-2"
            >
              <input
                name="confirm"
                placeholder="Type RESET"
                className="card-sm bg-white px-2 py-1 text-xs font-body border-2 border-navy"
              />
              <button className="pop pop-white text-xs">Confirm reset</button>
            </form>
          </details>
        </section>

        {/* ── Finalist roster ─────────────────────────────────── */}
        <section className="card px-6 py-5">
          <h2 className="font-display text-2xl text-navy">
            🏆 Finalist roster
          </h2>
          <p className="font-body text-sm text-navy-soft mt-1">
            Both bracket finals. NDA = whether they've replied
            &ldquo;yes I agree&rdquo; on Discourse.
          </p>
          {readiness.roster.length === 0 ? (
            <p className="font-body text-sm text-coral-deep mt-3 italic">
              No finalists detected. Generate the bracket from{" "}
              <Link href="/host" className="underline">
                /host
              </Link>{" "}
              first.
            </p>
          ) : (
            <div className="mt-3 grid md:grid-cols-2 gap-3">
              {readiness.roster.map((r) => (
                <div
                  key={r.userId}
                  className={
                    "card-sm bg-white px-4 py-3 border-3 flex items-center gap-3 " +
                    (r.bracket === "winners"
                      ? "border-coral"
                      : "border-coral-deep")
                  }
                  style={{ boxShadow: "4px 4px 0 #1B2A4E" }}
                >
                  <div className="text-3xl">
                    {r.bracket === "winners" ? "🏆" : "🥈"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg text-navy truncate">
                      {r.name ?? "(no name)"}
                    </p>
                    <p className="font-body text-xs text-navy-soft truncate">
                      {r.email}
                    </p>
                    <p className="font-display text-[10px] uppercase tracking-[0.18em] text-coral-deep mt-1">
                      {r.bracket} bracket
                    </p>
                  </div>
                  <div className="text-right">
                    {r.ndaAgreedAt ? (
                      <span className="font-display text-xs px-2 py-1 rounded bg-grass text-white">
                        ✓ NDA
                      </span>
                    ) : (
                      <span className="font-display text-xs px-2 py-1 rounded bg-coral-deep text-white">
                        ⚠ NDA pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Four round-launch cards ────────────────────────── */}
        <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(({ slot, summary, overrideName }) => {
            const def = SLOT_DEF[slot];
            const badge = statusBadge(summary.status);
            // Look up the WB + LB final winnerUserIds to gate the
            // championship card — can't launch the crown match until
            // BOTH bracket finals have a winner.
            const wbDone = !!winnersMatchupId && winners.status === "complete";
            const lbDone = !!losersMatchupId && losers.status === "complete";
            const blocked =
              (slot === "winners" && !winnersMatchupId) ||
              (slot === "losers" && !losersMatchupId) ||
              (slot === "championship" && (!wbDone || !lbDone));
            return (
              <div
                key={slot}
                id={summary.roundId ? `round-${summary.roundId}` : slot}
                className={`card px-5 py-5 flex flex-col gap-3 border-4 ${def.accentBorder} ${def.accent} shadow-pop relative overflow-hidden`}
              >
                <div className="absolute top-2 right-2">
                  <span
                    className={`font-display text-[10px] px-2 py-0.5 rounded-full border-2 border-navy ${badge.cls}`}
                  >
                    {badge.text}
                  </span>
                </div>
                <div className="text-5xl bob inline-block">{def.emoji}</div>
                <div>
                  <p className="font-display text-xs uppercase tracking-[0.18em] opacity-80">
                    {def.tagline}
                  </p>
                  <h2 className="font-display text-2xl md:text-3xl mt-1 leading-tight">
                    {def.label}
                  </h2>
                  {overrideName ? (
                    <p className="font-display text-sm mt-1 opacity-80">
                      Finalists: <strong>{overrideName}</strong>
                    </p>
                  ) : null}
                </div>
                <p className="font-body text-sm leading-relaxed">
                  {def.description}
                </p>
                {/* ── Question preview ──────────────────────── */}
                {(() => {
                  if (slot === "championship") {
                    // Sam might be a finalist — never leak the prompts.
                    return (
                      <div className="bg-white text-navy border-2 border-navy rounded-xl px-3 py-2">
                        <p className="font-display text-[10px] uppercase tracking-[0.18em] text-coral-deep">
                          {summary.totalQuestions === 0
                            ? "Mystery questions"
                            : `🎭 ${summary.totalQuestions} mystery question${
                                summary.totalQuestions === 1 ? "" : "s"
                              } sealed`}
                        </p>
                        <p className="font-body text-xs mt-1 italic">
                          {summary.totalQuestions === 0
                            ? "(none yet — open editor to generate)"
                            : "Topic is hidden from the host. Mia / live HUD see them at play."}
                        </p>
                      </div>
                    );
                  }
                  const previews = summary.roundId
                    ? previewByRoundId.get(summary.roundId) ?? []
                    : [];
                  if (summary.totalQuestions === 0) {
                    return (
                      <div className="bg-white text-navy border-2 border-dashed border-navy rounded-xl px-3 py-2">
                        <p className="font-display text-[10px] uppercase tracking-[0.18em] text-coral-deep">
                          Questions
                        </p>
                        <p className="font-body text-xs mt-1 italic">
                          (none yet — click "✏️ Edit questions" below)
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="bg-white text-navy border-2 border-navy rounded-xl px-3 py-2">
                      <p className="font-display text-[10px] uppercase tracking-[0.18em] text-coral-deep">
                        {summary.totalQuestions} question
                        {summary.totalQuestions === 1 ? "" : "s"} ·{" "}
                        {summary.currentQuestionIndex != null
                          ? `on Q${summary.currentQuestionIndex + 1}`
                          : "ready"}
                      </p>
                      <ol className="mt-1 font-body text-xs space-y-0.5">
                        {previews.map((p, i) => (
                          <li
                            key={i}
                            className="truncate"
                            title={p}
                          >
                            {i + 1}. {p}
                          </li>
                        ))}
                        {summary.totalQuestions > previews.length ? (
                          <li className="italic opacity-70">
                            … + {summary.totalQuestions - previews.length}{" "}
                            more
                          </li>
                        ) : null}
                      </ol>
                    </div>
                  );
                })()}

                {/* ── Always-available: Edit questions ─────── */}
                <Link
                  href={`/host/finals-control/round/${slot}`}
                  className="block w-full text-center font-display text-sm px-4 py-2 rounded-xl border-3 border-navy bg-white text-navy hover:-translate-y-0.5 transition-transform"
                  style={{ textDecoration: "none", boxShadow: "4px 4px 0 #1B2A4E" }}
                >
                  ✏️ Edit questions
                </Link>

                {blocked ? (
                  <div className="bg-white text-navy border-2 border-navy rounded-xl px-3 py-2 mt-auto">
                    <p className="font-display text-xs">
                      {slot === "championship"
                        ? "⚠ Resolve WB + LB finals first"
                        : "⚠ Generate the bracket first"}
                    </p>
                    <Link
                      href="/host"
                      className="font-display text-xs text-coral-deep underline"
                    >
                      → /host
                    </Link>
                  </div>
                ) : (
                  <div className="mt-auto flex flex-col gap-2">
                    <form action={launchFinalsRoundAction}>
                      <input type="hidden" name="slot" value={slot} />
                      <button
                        type="submit"
                        className="pop pop-navy text-base px-4 py-3 w-full text-center bg-navy text-white border-3 border-navy"
                      >
                        {launchButtonLabel(summary.status)}
                      </button>
                    </form>
                    {summary.roundId ? (
                      <Link
                        href={`/host/finals-control?round=${slot}#hud`}
                        prefetch={false}
                        className="font-display text-[11px] text-center opacity-90 underline"
                      >
                        🎙️ Show controls below ↓
                      </Link>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* ── Inline live HUD ──────────────────────────────────── */}
        <div id="hud" />
        {liveRoundView && liveSlot ? (
          <LiveHud
            roundId={liveSlot.summary.roundId!}
            view={liveRoundView}
            slot={liveSlot.slot}
            slotLabel={SLOT_DEF[liveSlot.slot].label}
          />
        ) : null}

        {/* ── Scene Director ──────────────────────────────────── */}
        <section className="card px-6 py-5">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-display text-2xl text-navy">
                🎬 Scene Director
              </h2>
              <p className="font-body text-sm text-navy-soft mt-1">
                Pick what shows on{" "}
                <Link
                  href="/watch"
                  target="_blank"
                  className="text-coral-deep underline"
                >
                  /watch
                </Link>{" "}
                — the page you screen-share into Zoho.
              </p>
            </div>
            <Link
              href="/watch"
              target="_blank"
              className="pop pop-coral text-sm"
            >
              👁 Open /watch
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {SCENE_PRESETS.map((preset) => {
              const active = scene.primary === preset.kind;
              return (
                <form
                  key={preset.kind}
                  action={switchSceneAction}
                  className="contents"
                >
                  <input type="hidden" name="primary" value={preset.kind} />
                  <button
                    type="submit"
                    className={`pop text-sm px-3 py-3 text-center border-3 ${
                      active
                        ? "bg-coral-deep text-white border-navy shadow-pop"
                        : "bg-white text-navy border-navy hover:-translate-y-0.5 transition-transform"
                    }`}
                  >
                    <span className="block text-2xl mb-1">{preset.emoji}</span>
                    {preset.label}
                    {active ? (
                      <span className="block text-[10px] mt-1 opacity-90">
                        ● LIVE
                      </span>
                    ) : null}
                  </button>
                </form>
              );
            })}
          </div>

          <form
            action={saveSceneContentAction}
            className="mt-5 grid md:grid-cols-2 gap-4"
          >
            <label className="font-display text-sm text-navy md:col-span-2">
              Banner text (top of every scene)
              <input
                name="bannerText"
                defaultValue={scene.bannerText}
                placeholder="e.g. 🏆 Winners' Bracket Final · Karen vs Marc"
                maxLength={140}
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
              />
            </label>
            <label className="font-display text-sm text-navy md:col-span-2">
              Body text (Text scene)
              <textarea
                name="bodyText"
                defaultValue={scene.bodyText}
                rows={3}
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
              />
            </label>
            <label className="font-display text-sm text-navy md:col-span-2">
              Live slide (Slide scene — renders Remotion comp in browser)
              <select
                name="slideId"
                defaultValue={scene.slideId}
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
              >
                <option value="">— none —</option>
                <optgroup label="Round / transition slides">
                  {EVENT_VIDEOS.filter((v) => v.kind === "slide").map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Parody ads">
                  {EVENT_VIDEOS.filter((v) => v.kind === "ad").map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id}
                    </option>
                  ))}
                </optgroup>
              </select>
              <span className="font-body text-[11px] text-navy-soft block mt-1">
                Banner + body text fields above override the slide's title /
                subtitle live — leave blank to keep defaults from eventVideos.ts.
              </span>
            </label>
            <label className="font-display text-sm text-navy">
              Video file (Video-file scene — only if you have an MP4)
              <select
                name="videoUrl"
                defaultValue={scene.videoUrl}
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
              >
                <option value="">— none —</option>
                {videos.map((v) => (
                  <option key={v.url} value={v.url}>
                    {v.name} ({mbStr(v.size)})
                  </option>
                ))}
              </select>
            </label>
            <label className="font-display text-sm text-navy">
              Image (Image scene)
              <select
                name="imageUrl"
                defaultValue={scene.imageUrl}
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
              >
                <option value="">— none —</option>
                {images.map((i) => (
                  <option key={i.url} value={i.url}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="font-display text-sm text-navy flex items-center gap-2">
              <input
                type="checkbox"
                name="showLowerThird"
                defaultChecked={scene.showLowerThird}
                className="w-4 h-4"
              />
              Show finalist lower-third strip
            </label>
            <label className="font-display text-sm text-navy flex items-center gap-2">
              <input
                type="checkbox"
                name="showQuestionOverlay"
                defaultChecked={scene.showQuestionOverlay}
                className="w-4 h-4"
              />
              Question card corner overlay (on non-question scenes)
            </label>
            <button className="pop pop-coral text-sm md:col-span-2 self-start">
              💾 Save scene content
            </button>
          </form>

          <p className="font-body text-[11px] text-navy-soft mt-3 italic">
            Tip: open /watch in a separate window and press F11 → share
            that tab in Zoho.
          </p>
        </section>

        {/* ── Zoho settings ───────────────────────────────────── */}
        <section className="card px-6 py-5">
          <h2 className="font-display text-xl text-navy">🎙️ Zoho Webinar</h2>
          <p className="font-body text-sm text-navy-soft mt-1">
            Paste the join URL from your Zoho dashboard. Embed URL is
            optional.
          </p>
          <form
            action={saveZohoWebinarAction}
            className="mt-4 grid md:grid-cols-2 gap-3"
          >
            <label className="font-display text-sm text-navy md:col-span-2">
              Join URL
              <input
                name="joinUrl"
                type="url"
                defaultValue={webinar.joinUrl}
                placeholder="https://www.zoho.com/webinar/..."
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
              />
            </label>
            <label className="font-display text-sm text-navy md:col-span-2">
              Embed URL (optional)
              <input
                name="embedUrl"
                type="url"
                defaultValue={webinar.embedUrl}
                placeholder="https://www.zoho.com/webinar/embed/..."
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
              />
            </label>
            <button className="pop pop-coral text-sm md:col-span-2 self-start">
              💾 Save webinar URLs
            </button>
          </form>
        </section>

        {/* ── Cohost ──────────────────────────────────────────── */}
        <section className="card px-6 py-5">
          <h2 className="font-display text-xl text-navy">
            🤫 Secret cohost access
          </h2>
          <p className="font-body text-sm text-navy-soft mt-1">
            User IDs (comma- or space-separated) that get into /live as
            cohosts.
          </p>
          <form
            action={saveCohostAction}
            className="mt-4 flex flex-col gap-3"
          >
            <textarea
              name="cohostUserIds"
              defaultValue={cohostIds}
              rows={3}
              placeholder="usr_xxx, usr_yyy"
              className="card-sm bg-white px-3 py-2 w-full text-sm font-body border-2 border-navy"
            />
            <button className="pop pop-coral text-sm self-start">
              💾 Save cohosts
            </button>
          </form>
        </section>
      </div>
    </Stage>
  );
}

// ────────────────────────────────────────────────────────────────────
// Inline live HUD — renders only when a finals round is running /
// revealing / pre-start. Contains everything from /host/live/[id] so
// the host never has to navigate away.
// ────────────────────────────────────────────────────────────────────

function LiveHud({
  roundId,
  view,
  slot,
  slotLabel,
}: {
  roundId: string;
  view: NonNullable<Awaited<ReturnType<typeof getLiveRoundState>>>;
  slot: FinalsSlot;
  slotLabel: string;
}) {
  // Sam must never see championship questions or which option a
  // finalist picked — he might be the WB or LB winner playing.
  const blind = slot === "championship";
  return (
    <section
      id={`round-${roundId}`}
      className="card px-6 py-5 border-4 border-coral-deep"
      style={{ boxShadow: "10px 10px 0 #FFD93D" }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-display text-2xl text-navy">
          🎙️ Live · {slotLabel}
        </h2>
        <span
          className={
            "font-display text-xs px-3 py-1 rounded-full border-2 border-navy " +
            (view.liveStatus === "running"
              ? "bg-grass text-white"
              : view.liveStatus === "revealing"
                ? "bg-sun text-navy"
                : view.liveStatus === "complete"
                  ? "bg-coral-deep text-white"
                  : "bg-white text-navy")
          }
        >
          {view.liveStatus.replace("_", " ").toUpperCase()}
        </span>
      </div>

      {/* Question card */}
      <div className="mt-4 card-sm bg-white px-5 py-4 border-3 border-navy">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <p className="font-display text-sm text-navy-soft uppercase tracking-wider">
            Question{" "}
            {view.currentQuestionIndex != null
              ? view.currentQuestionIndex + 1
              : "—"}{" "}
            of {view.totalQuestions}
          </p>
          <span
            className={
              "font-display text-sm px-3 py-1 rounded-full border-2 border-navy " +
              (view.locked
                ? "bg-navy/10 text-navy"
                : view.secondsLeft <= 5
                  ? "bg-coral text-white"
                  : "bg-sun text-navy")
            }
          >
            {view.locked ? "🔒 Locked" : `⏱ ${view.secondsLeft}s`}
          </span>
        </div>
        {view.currentQuestion ? (
          blind ? (
            <>
              <h3
                className="font-display text-xl md:text-2xl mt-2"
                style={{ color: "#1B2A4E" }}
              >
                🎭 Sealed question
              </h3>
              <p className="font-body text-sm text-navy-soft mt-1 italic">
                Hidden from host. Mia + /watch see the real question.
                Use the timer + lock controls below to run the round
                blind.
              </p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="card-sm bg-white px-3 py-2 font-display text-base flex items-center gap-2 border-2 border-dashed border-navy"
                  >
                    <span className="text-coral-deep">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <span className="flex-1 italic text-navy-soft">
                      🎭 hidden
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="font-display text-xl md:text-2xl text-navy mt-2">
                {view.currentQuestion.prompt}
              </h3>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {view.currentQuestion.options.map((o, i) => (
                  <div
                    key={o.id}
                    className={
                      "card-sm bg-white px-3 py-2 font-display text-base text-navy flex items-center gap-2 " +
                      (view.locked && o.isCorrect ? "ring-4 ring-grass" : "")
                    }
                  >
                    <span className="text-coral-deep">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <span className="flex-1">{o.label}</span>
                    {view.locked && o.isCorrect ? (
                      <span className="text-grass-deep font-bold">✓</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          )
        ) : (
          <p className="font-body text-base text-navy-soft mt-2 italic">
            No question on screen yet — click <strong>Start round</strong>.
          </p>
        )}
      </div>

      {/* Finalist picks */}
      {view.finalists.length > 0 ? (
        <div className="mt-4 card-sm bg-white px-5 py-4 border-3 border-navy">
          <h3 className="font-display text-base text-navy">Finalist picks</h3>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {view.finalists.map((f) => {
              const pickId = f.currentPickOptionId;
              const opt = view.currentQuestion?.options.find(
                (o) => o.id === pickId
              );
              const answered = !!pickId;
              return (
                <div
                  key={f.userId}
                  className="card-sm bg-white px-3 py-2 flex items-center gap-2 border-2 border-navy"
                >
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{
                      background: answered ? "#5BCE7A" : "#E0D8C3",
                      border: "2px solid #1B2A4E",
                    }}
                  />
                  <span className="font-display text-base text-navy flex-1 truncate">
                    {f.name ?? "(no name)"}
                  </span>
                  {blind ? (
                    <span className="font-body text-xs text-navy-soft italic">
                      {answered ? (view.locked ? "Locked 🎭" : "Locked in") : "Thinking…"}
                    </span>
                  ) : view.locked ? (
                    opt ? (
                      <span className="font-body text-sm">
                        {opt.label}
                        {opt.isCorrect ? (
                          <span className="text-grass-deep ml-1">✓</span>
                        ) : (
                          <span className="text-coral-deep ml-1">✗</span>
                        )}
                      </span>
                    ) : (
                      <span className="font-body text-xs text-navy-soft italic">
                        No pick
                      </span>
                    )
                  ) : (
                    <span className="font-body text-xs text-navy-soft italic">
                      {answered ? "Locked in" : "Thinking…"}
                    </span>
                  )}
                  <span className="font-display text-sm text-coral-deep ml-2">
                    {f.scoreSoFar ?? 0}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Controls */}
      <div className="mt-4 flex flex-wrap gap-2">
        {view.liveStatus === "pre_start" ? (
          <form action={startRoundAction}>
            <input type="hidden" name="roundId" value={roundId} />
            <button className="pop pop-grass text-base">▶ Start round</button>
          </form>
        ) : null}
        {view.liveStatus === "running" ? (
          <>
            <form action={advanceRoundAction}>
              <input type="hidden" name="roundId" value={roundId} />
              <button className="pop pop-coral text-base">
                Next question →
              </button>
            </form>
            <form action={lockRoundAction}>
              <input type="hidden" name="roundId" value={roundId} />
              <button
                className="pop pop-yellow text-base"
                disabled={view.locked}
              >
                🔒 Lock now
              </button>
            </form>
          </>
        ) : null}
        {view.liveStatus === "revealing" ? (
          <form action={completeRoundAction}>
            <input type="hidden" name="roundId" value={roundId} />
            <button className="pop pop-grass text-base">
              ✅ Mark complete
            </button>
          </form>
        ) : null}
      </div>

      {/* Effects bar */}
      <div className="mt-4">
        <p className="font-display text-sm text-navy mb-2">
          ✨ Effects (every connected client sees these)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {(
            [
              ["confetti", "🎉", "Confetti"],
              ["fireworks", "🎆", "Fireworks"],
              ["hearts", "❤️", "Hearts"],
              ["approve", "⭐", "Mia Approves"],
              ["drumroll", "🥁", "Drumroll"],
              ["pressure", "⏰", "Pressure"],
              ["boom", "💥", "BOOM"],
              ["tomato", "🍅", "Tomato"],
            ] as const
          ).map(([id, icon, label]) => (
            <form action={triggerEffectAction} key={id}>
              <input type="hidden" name="roundId" value={roundId} />
              <input type="hidden" name="effect" value={id} />
              <button className="pop pop-white text-sm w-full justify-start">
                <span className="text-xl mr-2">{icon}</span>
                {label}
              </button>
            </form>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <form action={triggerEffectAction} className="flex gap-2">
            <input type="hidden" name="roundId" value={roundId} />
            <input type="hidden" name="effect" value="fanfare" />
            <input
              name="message"
              placeholder="Fanfare text — e.g. NICE!"
              maxLength={60}
              className="card-sm bg-white px-3 py-1.5 flex-1 text-sm font-body border-2 border-navy"
            />
            <button className="pop pop-coral text-sm shrink-0">
              🏆 Fanfare
            </button>
          </form>
          <form action={triggerEffectAction} className="flex gap-2">
            <input type="hidden" name="roundId" value={roundId} />
            <input type="hidden" name="effect" value="banner" />
            <input
              name="message"
              placeholder="Banner text — e.g. FINAL QUESTION!"
              maxLength={120}
              className="card-sm bg-white px-3 py-1.5 flex-1 text-sm font-body border-2 border-navy"
            />
            <button className="pop pop-sky text-sm shrink-0">📣 Banner</button>
          </form>
        </div>
        <form action={clearEffectInlineAction} className="mt-2">
          <input type="hidden" name="roundId" value={roundId} />
          <button className="pop pop-white text-xs">❌ Clear effect</button>
        </form>
      </div>

      {/* Reset */}
      <details className="mt-4">
        <summary className="font-body text-xs text-coral-deep cursor-pointer">
          ⚠ Danger zone — reset this round
        </summary>
        <form
          action={resetRoundAction}
          className="mt-2 flex items-center gap-2"
        >
          <input type="hidden" name="roundId" value={roundId} />
          <input
            name="confirm"
            placeholder="Type RESET"
            className="card-sm bg-white px-2 py-1 text-xs font-body border-2 border-navy"
          />
          <button className="pop pop-white text-xs">Confirm reset</button>
        </form>
      </details>
    </section>
  );
}

// Suppress unused warning — LIVE_EFFECTS is referenced indirectly via
// the action import to keep the symbol in the bundle.
void LIVE_EFFECTS;
