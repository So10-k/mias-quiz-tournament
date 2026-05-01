"use server";

// Staff-flavored mirrors of the /host control actions. Each one:
//   1. Checks the appropriate staff permission via `requireStaff`
//   2. Calls the same engine helper as /host
//   3. Writes a row to `staff_actions` so the audit page + dashboard feed
//      reflect what happened
//
// The host equivalents check `currentUser().role === "author"`. Staff users
// don't share rows with players, so we can't reuse those — but the engine
// helpers themselves don't care about identity, so duplication is shallow.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/staff-auth";
import { logStaffAction } from "@/lib/staff-audit";
import {
  getOrCreateActiveTournament,
  getLatestTournament,
  setRegistrationOpen,
  setSubtitle,
  closeCurrentRound,
  startNextRound,
  endTournament,
  reopenTournament,
  restoreReader,
  adjustStrike,
  removeReader,
  getCast,
} from "@/lib/engine";
import {
  generateBracket,
  clearBracket,
  resolveMatchup,
  swapSeed,
} from "@/lib/bracket";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import {
  ALL_LOCKABLE,
  setPageLocked,
  type LockablePage,
} from "@/lib/page-locks";
import { setSiteTheme, type SiteTheme } from "@/lib/site-theme";
import {
  setActiveProvider,
  type EmailProvider,
} from "@/lib/email-provider";
import { setCountdown } from "@/lib/countdown-settings";

const RETURN = "/staff/control";

function bumpAll() {
  revalidatePath("/staff");
  revalidatePath("/staff/control");
  revalidatePath("/staff/bracket");
  revalidatePath("/staff/players");
  revalidatePath("/staff/standings");
  revalidatePath("/staff/predictions");
  revalidatePath("/staff/audit");
  revalidatePath("/");
  revalidatePath("/play");
  revalidatePath("/players");
  revalidatePath("/standings");
  revalidatePath("/bracket");
}

// ── tournament lifecycle ───────────────────────────────────────────────────

export async function openTheDoorsAction() {
  const me = await requireStaff({ next: RETURN, permission: "players:write" });
  const t = await getOrCreateActiveTournament();
  await setRegistrationOpen(t.id, true);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "tournament.registration_open",
    target: t.title,
  });
  bumpAll();
}

export async function closeTheDoorsAction() {
  const me = await requireStaff({ next: RETURN, permission: "players:write" });
  const t = await getOrCreateActiveTournament();
  await setRegistrationOpen(t.id, false);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "tournament.registration_close",
    target: t.title,
  });
  bumpAll();
}

export async function startNextRoundAction() {
  const me = await requireStaff({ next: RETURN, permission: "bracket:write" });
  const t = await getOrCreateActiveTournament();
  try {
    await startNextRound(t.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not start";
    await logStaffAction({
      actor: { id: me.id, email: me.email },
      action: "round.start_failed",
      details: { error: msg },
    });
    redirect(`${RETURN}?error=${encodeURIComponent(msg)}`);
  }
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "round.started",
    target: t.title,
  });
  bumpAll();
}

export async function closeActiveRoundAction() {
  const me = await requireStaff({ next: RETURN, permission: "bracket:write" });
  const t = await getOrCreateActiveTournament();
  await closeCurrentRound(t.id);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "round.closed",
    target: t.title,
  });
  bumpAll();
}

export async function endTournamentAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "bracket:write" });
  const winnerRaw = String(formData.get("winnerUserId") ?? "");
  const noWinner = String(formData.get("noWinner") ?? "") === "yes";
  if (!winnerRaw && !noWinner) {
    redirect(`${RETURN}?error=Pick+a+winner+or+choose+No+winner`);
  }
  const winnerId = noWinner ? null : winnerRaw || null;
  const t = await getOrCreateActiveTournament();
  await endTournament(t.id, winnerId);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "tournament.ended",
    target: t.title,
    details: { winnerId, noWinner },
  });
  bumpAll();
  redirect(`${RETURN}?ok=Tournament+ended`);
}

export async function reopenTournamentAction() {
  const me = await requireStaff({ next: RETURN, permission: "bracket:write" });
  const latest = await getLatestTournament();
  if (!latest) return;
  await reopenTournament(latest.id);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "tournament.reopened",
    target: latest.title,
  });
  bumpAll();
  redirect(`${RETURN}?ok=Tournament+reopened`);
}

export async function updateSubtitleAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "bracket:write" });
  const t = await getOrCreateActiveTournament();
  const subtitle = String(formData.get("subtitle") ?? "").trim();
  if (subtitle.length === 0 || subtitle.length > 240) {
    redirect(`${RETURN}?error=Subtitle+must+be+1-240+characters`);
  }
  await setSubtitle(t.id, subtitle);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "tournament.subtitle",
    target: subtitle.slice(0, 60),
  });
  bumpAll();
}

// ── round helpers ──────────────────────────────────────────────────────────

export async function deleteDraftRoundAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "bracket:write" });
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) return;
  const [r] = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.id, roundId))
    .limit(1);
  if (!r || r.status !== "draft") {
    redirect(`${RETURN}?error=Only+draft+rounds+can+be+deleted`);
  }
  await db.delete(schema.rounds).where(eq(schema.rounds.id, roundId));
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "round.deleted",
    target: r.title,
  });
  bumpAll();
}

export async function reopenRoundAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "bracket:write" });
  const t = await getOrCreateActiveTournament();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) return;
  const all = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.tournamentId, t.id));
  if (all.some((r) => r.status === "active" && r.id !== roundId)) {
    redirect(
      `${RETURN}?error=${encodeURIComponent(
        "Close the currently active round first."
      )}`
    );
  }
  await db
    .update(schema.rounds)
    .set({ status: "active" })
    .where(
      and(eq(schema.rounds.id, roundId), eq(schema.rounds.tournamentId, t.id))
    );
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "round.reopened",
    target: roundId,
  });
  bumpAll();
  redirect(`${RETURN}?ok=Round+reopened`);
}

// ── player ops ────────────────────────────────────────────────────────────

export async function restoreReaderAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "players:write" });
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  if (!enrollmentId) return;
  await restoreReader(enrollmentId, 0);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "player.restored",
    target: enrollmentId,
  });
  bumpAll();
}

export async function giveHeartAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "players:write" });
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  if (!enrollmentId) return;
  await adjustStrike(enrollmentId, -1);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "player.heart_given",
    target: enrollmentId,
  });
  bumpAll();
}

export async function takeHeartAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "players:write" });
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  if (!enrollmentId) return;
  await adjustStrike(enrollmentId, +1);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "player.heart_taken",
    target: enrollmentId,
  });
  bumpAll();
}

export async function removeReaderAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "players:write" });
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!enrollmentId || confirm !== "yes") {
    redirect(`${RETURN}?error=Please+confirm`);
  }
  await removeReader(enrollmentId);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "player.removed",
    target: enrollmentId,
  });
  bumpAll();
}

// ── bracket controls ──────────────────────────────────────────────────────

export async function generateBracketAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "bracket:write" });
  const t = await getOrCreateActiveTournament();
  const mode = String(formData.get("mode") ?? "registration");
  const includeOut = formData.get("includeOut") === "yes";

  const cast = await getCast(t.id);
  const eligible = cast.filter(
    (c) => includeOut || !c.enrollment.eliminatedAt
  );
  if (eligible.length < 2) {
    redirect(`${RETURN}?error=Need+at+least+2+players+to+make+a+bracket`);
  }
  let seedUserIds = eligible.map((c) => c.user.id);
  if (mode === "shuffle") {
    seedUserIds = [...seedUserIds].sort(() => Math.random() - 0.5);
  } else if (mode === "custom") {
    const raw = String(formData.get("seedOrder") ?? "");
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) seedUserIds = parts;
  }
  try {
    await generateBracket(t.id, seedUserIds);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not generate";
    await logStaffAction({
      actor: { id: me.id, email: me.email },
      action: "bracket.generate_failed",
      details: { error: msg, mode, count: seedUserIds.length },
    });
    redirect(`${RETURN}?error=${encodeURIComponent(msg)}`);
  }
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "bracket.generated",
    target: t.title,
    details: { mode, players: seedUserIds.length },
  });
  bumpAll();
  redirect(`${RETURN}?ok=Bracket+generated`);
}

export async function clearBracketAction() {
  const me = await requireStaff({ next: RETURN, permission: "bracket:write" });
  const t = await getOrCreateActiveTournament();
  await clearBracket(t.id);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "bracket.cleared",
    target: t.title,
  });
  bumpAll();
  redirect(`${RETURN}?ok=Bracket+cleared`);
}

export async function setMatchupWinnerAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "bracket:write" });
  const matchupId = String(formData.get("matchupId") ?? "");
  const winnerRaw = String(formData.get("winnerUserId") ?? "");
  const winnerUserId = winnerRaw ? winnerRaw : null;
  if (!matchupId) return;
  await resolveMatchup(matchupId, winnerUserId, "manual");
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "bracket.set_winner",
    target: matchupId,
    details: { winnerUserId },
  });
  bumpAll();
}

export async function swapSeedAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "bracket:write" });
  const t = await getOrCreateActiveTournament();
  const matchupId = String(formData.get("matchupId") ?? "");
  const side = String(formData.get("side") ?? "a") === "b" ? "b" : "a";
  const newUserIdRaw = String(formData.get("newUserId") ?? "");
  const newUserId = newUserIdRaw ? newUserIdRaw : null;
  if (!matchupId) return;
  await swapSeed(t.id, matchupId, side, newUserId);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "bracket.swap_seed",
    target: matchupId,
    details: { side, newUserId },
  });
  bumpAll();
}

// ── settings ─────────────────────────────────────────────────────────────

export async function togglePageLockAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "bracket:write" });
  const page = String(formData.get("page") ?? "") as LockablePage;
  const locked = String(formData.get("locked") ?? "") === "yes";
  if (!(ALL_LOCKABLE as string[]).includes(page)) {
    redirect(`${RETURN}?error=Unknown+page`);
  }
  await setPageLocked(page, locked);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "settings.page_lock",
    target: page,
    details: { locked },
  });
  revalidatePath("/staff/control");
  revalidatePath(`/${page}`);
}

export async function setSiteThemeAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "bracket:write" });
  const raw = String(formData.get("theme") ?? "");
  const theme: SiteTheme = raw === "arcade" ? "arcade" : "default";
  await setSiteTheme(theme);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "settings.site_theme",
    target: theme,
  });
  bumpAll();
}

export async function setEmailProviderAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "emails:write" });
  const raw = String(formData.get("provider") ?? "");
  const provider: EmailProvider = raw === "brevo" ? "brevo" : "resend";
  await setActiveProvider(provider);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "settings.email_provider",
    target: provider,
  });
  revalidatePath("/staff/control");
}

export async function setCountdownAction(formData: FormData) {
  const me = await requireStaff({ next: RETURN, permission: "bracket:write" });
  const label = String(formData.get("label") ?? "").trim();
  const targetLocal = String(formData.get("target") ?? "").trim();
  const visible = String(formData.get("visible") ?? "") === "yes";
  await setCountdown({ label, targetIso: targetLocal, visible });
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "settings.countdown",
    target: label.slice(0, 60),
    details: { targetIso: targetLocal, visible },
  });
  bumpAll();
}
