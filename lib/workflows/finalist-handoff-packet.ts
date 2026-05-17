// Build a "broadcast-day handoff" PDF for every finalist. Each
// finalist's section bundles: their bracket position, opponent name,
// NDA status, last sign-in date, Zoho join URL, and a checklist they
// can tick off the morning of. Pure read-only.

import { db, schema } from "@/db";
import { desc, eq, inArray } from "drizzle-orm";
import {
  getAllFinalistUserIds,
  getWinnersFinalMatchupId,
  getLosersFinalMatchupId,
} from "@/lib/finals-access";
import { getZohoWebinar } from "@/lib/zoho-webinar";
import type { WorkflowDef, WorkflowResult, WorkflowTargetResult } from "./types";

export const finalistHandoffPacketWorkflow: WorkflowDef = {
  id: "finalist-handoff-packet",
  name: "Finalist handoff packet",
  description:
    "Builds a single PDF with one page per finalist — bracket position, opponent name, NDA status, last sign-in, Zoho join URL, day-of checklist. Hand it to each player at the prep call.",
  emoji: "📋",
  sideEffects: "Read-only — no emails, no DB writes.",
  async run(): Promise<WorkflowResult> {
    const ids = await getAllFinalistUserIds();
    if (ids.length === 0) {
      return {
        ok: false,
        summary: "No finalists found.",
        targets: [],
        effects: [],
      };
    }
    const [users, winId, losId, webinar] = await Promise.all([
      db.select().from(schema.users).where(inArray(schema.users.id, ids)),
      getWinnersFinalMatchupId(),
      getLosersFinalMatchupId(),
      getZohoWebinar(),
    ]);

    const matchups = await db
      .select()
      .from(schema.matchups)
      .where(
        inArray(
          schema.matchups.id,
          [winId, losId].filter((x): x is string => !!x)
        )
      );

    const opponentByUser = new Map<string, { bracket: string; opponentId?: string }>();
    for (const m of matchups) {
      if (m.playerAUserId)
        opponentByUser.set(m.playerAUserId, {
          bracket: m.bracket,
          opponentId: m.playerBUserId ?? undefined,
        });
      if (m.playerBUserId)
        opponentByUser.set(m.playerBUserId, {
          bracket: m.bracket,
          opponentId: m.playerAUserId ?? undefined,
        });
    }
    const opponentIds = Array.from(opponentByUser.values())
      .map((v) => v.opponentId)
      .filter((x): x is string => !!x);
    const opponents =
      opponentIds.length > 0
        ? await db
            .select({
              id: schema.users.id,
              name: schema.users.name,
              email: schema.users.email,
            })
            .from(schema.users)
            .where(inArray(schema.users.id, opponentIds))
        : [];
    const opponentNameById = new Map(
      opponents.map((u) => [u.id, u.name ?? u.email ?? "(unknown)"])
    );

    const targets: WorkflowTargetResult[] = [];
    for (const u of users) {
      const ctx = opponentByUser.get(u.id);
      const oppName =
        ctx?.opponentId ? opponentNameById.get(ctx.opponentId) ?? "(TBD)" : "(TBD)";
      const [lastVisit] = await db
        .select({ at: schema.visitLogs.createdAt })
        .from(schema.visitLogs)
        .where(eq(schema.visitLogs.userId, u.id))
        .orderBy(desc(schema.visitLogs.createdAt))
        .limit(1);
      targets.push({
        targetId: u.id,
        name: u.name ?? u.email ?? "(no name)",
        contact: u.email,
        status: u.finalsNdaAgreedAt ? "ok" : "warn",
        tasksRemaining: u.finalsNdaAgreedAt ? 0 : 1,
        checks: [
          {
            id: "bracket",
            label: "Bracket position",
            severity: ctx ? "ok" : "warn",
            detail: ctx
              ? `${ctx.bracket === "main" ? "Winners'" : "Losers'"} bracket final · facing ${oppName}.`
              : "Not yet seated in a final.",
          },
          {
            id: "nda",
            label: "Confidentiality NDA",
            severity: u.finalsNdaAgreedAt ? "ok" : "fail",
            detail: u.finalsNdaAgreedAt
              ? `Agreed ${u.finalsNdaAgreedAt.toISOString().slice(0, 10)}.`
              : "Not yet agreed.",
            remedy: u.finalsNdaAgreedAt
              ? undefined
              : "Sign into discuss.miaswebsites.art and reply 'yes I agree' to the 🔒 PM.",
          },
          {
            id: "lastVisit",
            label: "Last quiz-site visit",
            severity: lastVisit
              ? Date.now() - lastVisit.at.getTime() < 14 * 86_400_000
                ? "ok"
                : "warn"
              : "warn",
            detail: lastVisit
              ? `${lastVisit.at.toISOString().slice(0, 10)}.`
              : "Never (no visit logs).",
          },
          {
            id: "join",
            label: "Zoho join URL on file",
            severity: webinar.joinUrl ? "ok" : "fail",
            detail: webinar.joinUrl
              ? webinar.joinUrl
              : "Not yet set — host needs to paste at /host/finals-control.",
          },
          {
            id: "day-of-1",
            label: "[Day-of] Test camera + mic by 11:30 AM ET",
            severity: "warn",
            detail: "Open quiz.miaswebsites.art/live and click 'Join Zoho Webinar'.",
          },
          {
            id: "day-of-2",
            label: "[Day-of] Headphones ready (kills echo)",
            severity: "warn",
            detail: "Any wired or BT headphones work.",
          },
          {
            id: "day-of-3",
            label: "[Day-of] Stable internet — wired if possible",
            severity: "warn",
            detail: "If on WiFi: be close to the router, no streaming on the same network.",
          },
        ],
        emailSent: false,
        notes: [`Opponent: ${oppName}.`, `Bracket: ${ctx?.bracket ?? "TBD"}.`],
      });
    }

    return {
      ok: true,
      summary: `📋 Handoff packet ready for ${targets.length} finalist${targets.length === 1 ? "" : "s"}.`,
      targets,
      effects: [
        "Read-only. Download the PDF for the day-of packet.",
        webinar.joinUrl
          ? `Zoho join URL: ${webinar.joinUrl}`
          : "⚠ Zoho join URL not yet set.",
      ],
    };
  },
};
