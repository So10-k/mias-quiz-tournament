"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Resend } from "resend";
import { requireUser } from "@/lib/session";
import { db, schema } from "@/db";
import {
  eq,
  isNull,
  and,
  isNotNull,
  inArray,
  desc,
  asc,
} from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  applyMergeVars,
  getTemplate,
  recipientMergeValues,
} from "@/lib/email-templates";
import {
  AudienceFilterSchema,
  type AudienceFilter,
  type AudienceMode,
  type AudienceUniverse,
} from "@/lib/audience";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") redirect("/play");
  return u;
}

const Input = z.object({
  subject: z.string().min(1).max(140),
  body: z.string().max(8000).optional().default(""),
  audience: z.string().min(1).max(8000), // serialized AudienceFilter JSON
  confirm: z.literal("yes"),
  templateId: z.string().max(64).optional().default(""),
  templateFields: z.string().max(8000).optional().default(""),
});

export type AnnouncementResult = {
  ok: boolean;
  audience: AudienceMode;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  errors: string[];
  dryRun: boolean;
};

function parseAudience(raw: string): AudienceFilter {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { mode: "still_in" };
  }
  const result = AudienceFilterSchema.safeParse(json);
  return result.success ? result.data : { mode: "still_in" };
}

async function getLatestTournamentId(): Promise<string | null> {
  const [t] = await db
    .select({ id: schema.tournaments.id })
    .from(schema.tournaments)
    .orderBy(desc(schema.tournaments.createdAt))
    .limit(1);
  return t?.id ?? null;
}

async function gatherRecipients(filter: AudienceFilter) {
  if (filter.mode === "all_users") {
    const rows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
      })
      .from(schema.users);
    return dedupe(rows);
  }

  if (filter.mode === "specific") {
    if (filter.userIds.length === 0) return [];
    const rows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
      })
      .from(schema.users)
      .where(inArray(schema.users.id, filter.userIds));
    return dedupe(rows);
  }

  const tournamentId = await getLatestTournamentId();
  if (!tournamentId) return [];

  // Modes that filter on round-scoped data require resolving roundId →
  // userIds first, then a final user-row fetch. Modes that filter on
  // enrollment columns can do it in one join.
  switch (filter.mode) {
    case "still_in":
      return joinUsersByEnrollment(
        and(
          eq(schema.enrollments.tournamentId, tournamentId),
          isNull(schema.enrollments.eliminatedAt)
        )
      );
    case "eliminated":
      return joinUsersByEnrollment(
        and(
          eq(schema.enrollments.tournamentId, tournamentId),
          isNotNull(schema.enrollments.eliminatedAt)
        )
      );
    case "all":
      return joinUsersByEnrollment(
        eq(schema.enrollments.tournamentId, tournamentId)
      );
    case "with_strikes":
      return joinUsersByEnrollment(
        and(
          eq(schema.enrollments.tournamentId, tournamentId),
          eq(schema.enrollments.strikeCount, filter.strikes)
        )
      );
    case "eliminated_in_round": {
      // Direct hit on enrollment.eliminatedInRoundId, plus a fallback for
      // anyone who failed the round and was already eliminated (covers
      // legacy rows where eliminatedInRoundId wasn't set).
      const direct = await db
        .select({ userId: schema.enrollments.userId })
        .from(schema.enrollments)
        .where(
          and(
            eq(schema.enrollments.tournamentId, tournamentId),
            eq(schema.enrollments.eliminatedInRoundId, filter.roundId)
          )
        );
      const ids = new Set(direct.map((r) => r.userId));
      // Fallback: users whose attempt in this round failed AND who are now
      // eliminated AND have no later round attempt (best-effort).
      const failed = await db
        .select({
          userId: schema.attempts.userId,
        })
        .from(schema.attempts)
        .where(
          and(
            eq(schema.attempts.roundId, filter.roundId),
            eq(schema.attempts.passed, false)
          )
        );
      if (failed.length > 0) {
        const eliminated = await db
          .select({ userId: schema.enrollments.userId })
          .from(schema.enrollments)
          .where(
            and(
              eq(schema.enrollments.tournamentId, tournamentId),
              isNotNull(schema.enrollments.eliminatedAt),
              inArray(
                schema.enrollments.userId,
                failed.map((f) => f.userId)
              )
            )
          );
        for (const e of eliminated) ids.add(e.userId);
      }
      return fetchUsersByIds([...ids]);
    }
    case "survived_round": {
      const passed = await db
        .select({ userId: schema.attempts.userId })
        .from(schema.attempts)
        .where(
          and(
            eq(schema.attempts.roundId, filter.roundId),
            eq(schema.attempts.passed, true)
          )
        );
      return fetchUsersByIds(passed.map((p) => p.userId));
    }
    case "no_submit_in_round": {
      // Enrolled in tournament, no submitted attempt for the given round.
      const enrolledRows = await db
        .select({ userId: schema.enrollments.userId })
        .from(schema.enrollments)
        .where(eq(schema.enrollments.tournamentId, tournamentId));
      const submittedRows = await db
        .select({ userId: schema.attempts.userId })
        .from(schema.attempts)
        .where(
          and(
            eq(schema.attempts.roundId, filter.roundId),
            isNotNull(schema.attempts.submittedAt)
          )
        );
      const submitted = new Set(submittedRows.map((r) => r.userId));
      const candidates = enrolledRows
        .map((r) => r.userId)
        .filter((u) => !submitted.has(u));
      return fetchUsersByIds(candidates);
    }
  }
}

async function joinUsersByEnrollment(where: ReturnType<typeof and>) {
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.enrollments)
    .innerJoin(schema.users, eq(schema.users.id, schema.enrollments.userId))
    .where(where);
  return dedupe(rows);
}

async function fetchUsersByIds(userIds: string[]) {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, userIds));
  return dedupe(rows);
}

function dedupe<T extends { id: string; email: string | null; name: string | null }>(
  rows: T[]
) {
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (!r.email) return false;
    const key = r.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function previewRecipients(
  filter: AudienceFilter
): Promise<{ count: number; emails: string[] }> {
  await requireHost();
  const safe = AudienceFilterSchema.safeParse(filter);
  if (!safe.success) return { count: 0, emails: [] };
  const list = await gatherRecipients(safe.data);
  return {
    count: list.length,
    emails: list.map((r) => r.email!).slice(0, 25),
  };
}

// ─── audience-picker support data ──────────────────────────────────────
export async function getAudienceUniverse(): Promise<AudienceUniverse> {
  await requireHost();
  const tournamentId = await getLatestTournamentId();
  if (!tournamentId) return { rounds: [], players: [] };
  const [rounds, playerRows] = await Promise.all([
    db
      .select({
        id: schema.rounds.id,
        chapterNumber: schema.rounds.chapterNumber,
        title: schema.rounds.title,
        isPractice: schema.rounds.isPractice,
        status: schema.rounds.status,
      })
      .from(schema.rounds)
      .where(eq(schema.rounds.tournamentId, tournamentId))
      .orderBy(asc(schema.rounds.chapterNumber)),
    db
      .select({
        userId: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        enrollmentId: schema.enrollments.id,
        eliminatedAt: schema.enrollments.eliminatedAt,
        strikeCount: schema.enrollments.strikeCount,
      })
      .from(schema.enrollments)
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.enrollments.userId)
      )
      .where(eq(schema.enrollments.tournamentId, tournamentId)),
  ]);
  return {
    rounds,
    players: playerRows
      .filter((p) => !!p.email)
      .map((p) => ({
        userId: p.userId,
        name: p.name,
        email: p.email!,
        enrollmentId: p.enrollmentId,
        eliminatedAt: p.eliminatedAt
          ? new Date(p.eliminatedAt).toISOString()
          : null,
        strikeCount: p.strikeCount,
      }))
      .sort((a, b) =>
        (a.name ?? a.email).localeCompare(b.name ?? b.email)
      ),
  };
}

function plainToHtml(body: string): string {
  // Conservative: escape, preserve paragraph breaks, linkify URLs.
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const paragraphs = body
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="font-size:18px;line-height:1.55;margin:0 0 16px">${esc(p)
          .replace(/\n/g, "<br/>")
          .replace(
            /(https?:\/\/[^\s<]+)/g,
            (u) =>
              `<a href="${u}" style="color:#FF6B9D;text-decoration:underline">${u}</a>`
          )}</p>`
    )
    .join("");
  return `<!doctype html>
<html><body style="background:#87CEEB;margin:0;padding:32px;font-family:Quicksand,sans-serif;color:#1B2A4E">
  <div style="max-width:560px;margin:0 auto;background:white;padding:32px;border:4px solid #1B2A4E;border-radius:24px;box-shadow:8px 8px 0 0 #1B2A4E">
    <p style="font-family:Fredoka,sans-serif;font-weight:700;font-size:22px;margin:0 0 16px">🌞 Mia&rsquo;s Quiz Tournament</p>
    ${paragraphs}
    <p style="font-size:13px;color:#3B4A7E;margin:24px 0 0">— Mia & Sam</p>
  </div>
</body></html>`;
}

export async function sendAnnouncement(
  formData: FormData
): Promise<AnnouncementResult> {
  await requireHost();

  const parsed = Input.safeParse({
    subject: String(formData.get("subject") ?? "").trim(),
    body: String(formData.get("body") ?? ""),
    audience: String(formData.get("audience") ?? '{"mode":"still_in"}'),
    confirm: String(formData.get("confirm") ?? ""),
    templateId: String(formData.get("templateId") ?? "").trim(),
    templateFields: String(formData.get("templateFields") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      audience: "still_in",
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
      errors: [parsed.error.errors[0]?.message ?? "Invalid input"],
      dryRun: false,
    };
  }

  const audienceFilter = parseAudience(parsed.data.audience);
  const audience: AudienceMode = audienceFilter.mode;
  const { subject, templateId, templateFields } = parsed.data;
  const body = parsed.data.body ?? "";

  let resolvedSubject = subject;
  let html: string;
  let text: string;

  if (templateId) {
    const template = getTemplate(templateId);
    if (!template) {
      return {
        ok: false,
        audience,
        recipientCount: 0,
        sentCount: 0,
        failedCount: 0,
        errors: [`Unknown template: ${templateId}`],
        dryRun: false,
      };
    }
    let fields: Record<string, string> = {};
    if (templateFields) {
      try {
        const raw = JSON.parse(templateFields);
        if (raw && typeof raw === "object") {
          for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
            if (typeof v === "string") fields[k] = v;
          }
        }
      } catch {
        return {
          ok: false,
          audience,
          recipientCount: 0,
          sentCount: 0,
          failedCount: 0,
          errors: ["Template fields were malformed."],
          dryRun: false,
        };
      }
    }
    const rendered = template.render({ subject, fields });
    resolvedSubject = rendered.subject;
    html = rendered.html;
    text = rendered.text;
  } else {
    if (!body.trim()) {
      return {
        ok: false,
        audience,
        recipientCount: 0,
        sentCount: 0,
        failedCount: 0,
        errors: ["Message body is required."],
        dryRun: false,
      };
    }
    html = plainToHtml(body);
    text = body;
  }
  const recipients = await gatherRecipients(audienceFilter);
  if (recipients.length === 0) {
    return {
      ok: false,
      audience,
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
      errors: ["No recipients in that audience yet."],
      dryRun: false,
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ||
    "Mia's Quiz Tournament <onboarding@resend.dev>";

  // Dev fallback: print, don't actually send.
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.log(
      `\n[DEV] Would send "${resolvedSubject}" to ${recipients.length} recipient(s):`
    );
    for (const r of recipients) {
      // eslint-disable-next-line no-console
      console.log(`  - ${r.email}`);
    }
    revalidatePath("/host");
    return {
      ok: true,
      audience,
      recipientCount: recipients.length,
      sentCount: recipients.length,
      failedCount: 0,
      errors: [],
      dryRun: true,
    };
  }

  const resend = new Resend(apiKey);
  const errors: string[] = [];
  let sent = 0;

  // Batch up to 100 per Resend call. Per-recipient merge-variable
  // substitution happens here so each person gets their own {name} etc.
  const CHUNK = 90;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const slice = recipients.slice(i, i + CHUNK);
    try {
      const { data, error } = await resend.batch.send(
        slice.map((r) => {
          const vars = recipientMergeValues(r);
          return {
            from,
            to: r.email!,
            subject: applyMergeVars(resolvedSubject, vars, false),
            text: applyMergeVars(text, vars, false),
            html: applyMergeVars(html, vars, true),
          };
        })
      );
      if (error) {
        errors.push(error.message ?? String(error));
      } else if (data && Array.isArray((data as any).data)) {
        sent += (data as any).data.length;
      } else {
        sent += slice.length;
      }
    } catch (e: any) {
      errors.push(e?.message ?? String(e));
    }
  }

  revalidatePath("/host");
  return {
    ok: errors.length === 0,
    audience,
    recipientCount: recipients.length,
    sentCount: sent,
    failedCount: Math.max(0, recipients.length - sent),
    errors,
    dryRun: false,
  };
}

