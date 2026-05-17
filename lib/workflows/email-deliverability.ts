// Read-only audit: last 30 days of email_sends grouped by template +
// recipient domain. Surfaces open rate, click rate, and any domain
// that's been silent (likely spam-folder issue).

import { db, schema } from "@/db";
import { and, gt, sql } from "drizzle-orm";
import type { WorkflowDef, WorkflowResult, WorkflowCheck } from "./types";

export const emailDeliverabilityWorkflow: WorkflowDef = {
  id: "email-deliverability",
  name: "Email deliverability report",
  description:
    "30-day rollup of email sends, opens, and clicks — by template and by recipient domain. Flags any template or domain with abnormally low open rates so we can investigate before the next broadcast blast.",
  emoji: "📨",
  sideEffects: "None.",
  async run(): Promise<WorkflowResult> {
    const since = new Date(Date.now() - 30 * 86_400_000);

    const totalRow = await db
      .select({
        sent: sql<number>`count(*)::int`,
        opens: sql<number>`count(*) filter (where ${schema.emailSends.openedAt} is not null)::int`,
      })
      .from(schema.emailSends)
      .where(gt(schema.emailSends.sentAt, since));
    const [{ c: clicks30d }] = await db
      .select({ c: sql<number>`count(distinct ${schema.emailClicks.sendId})::int` })
      .from(schema.emailClicks)
      .where(gt(schema.emailClicks.clickedAt, since));

    const sent = totalRow[0]?.sent ?? 0;
    const opens = totalRow[0]?.opens ?? 0;
    const openRate = sent > 0 ? Math.round((opens / sent) * 100) : 0;
    const clickRate = sent > 0 ? Math.round((clicks30d / sent) * 100) : 0;

    const checks: WorkflowCheck[] = [];
    checks.push({
      id: "volume",
      label: "30-day send volume",
      severity: sent === 0 ? "warn" : "ok",
      detail: `${sent} sends.`,
    });
    checks.push({
      id: "open-rate",
      label: "30-day open rate",
      severity: openRate >= 25 ? "ok" : openRate >= 12 ? "warn" : "fail",
      detail: `${openRate}% (${opens} of ${sent}).`,
      remedy:
        openRate < 25
          ? "Check the sender domain's DMARC/SPF/DKIM alignment. <12% suggests reputation issues."
          : undefined,
    });
    checks.push({
      id: "click-rate",
      label: "30-day click rate",
      severity: clickRate >= 5 ? "ok" : clickRate >= 2 ? "warn" : "warn",
      detail: `${clickRate}% (${clicks30d} of ${sent}).`,
    });

    // Per-template breakdown.
    const byTemplate = await db
      .select({
        templateId: schema.emailSends.templateId,
        sent: sql<number>`count(*)::int`,
        opens: sql<number>`count(*) filter (where ${schema.emailSends.openedAt} is not null)::int`,
      })
      .from(schema.emailSends)
      .where(gt(schema.emailSends.sentAt, since))
      .groupBy(schema.emailSends.templateId);
    for (const t of byTemplate.slice(0, 12)) {
      const tplOpenRate = t.sent > 0 ? Math.round((t.opens / t.sent) * 100) : 0;
      checks.push({
        id: `tpl-${t.templateId ?? "untagged"}`,
        label: `Template · ${t.templateId ?? "(untagged)"}`,
        severity: tplOpenRate >= 20 ? "ok" : tplOpenRate >= 8 ? "warn" : "fail",
        detail: `${t.sent} sent · ${tplOpenRate}% open.`,
      });
    }

    // Top recipient domains by send volume — flag any with 0 opens.
    const byDomain = await db.execute(sql<{ domain: string; sent: number; opens: number }>`
      select
        lower(split_part(${schema.emailSends.recipientEmail}, '@', 2)) as domain,
        count(*)::int as sent,
        count(*) filter (where ${schema.emailSends.openedAt} is not null)::int as opens
      from ${schema.emailSends}
      where ${schema.emailSends.sentAt} > ${since}
      group by 1
      order by sent desc
      limit 8
    `);
    for (const r of byDomain as unknown as Array<{
      domain: string;
      sent: number;
      opens: number;
    }>) {
      const rate = r.sent > 0 ? Math.round((r.opens / r.sent) * 100) : 0;
      checks.push({
        id: `domain-${r.domain}`,
        label: `Domain · ${r.domain}`,
        severity:
          r.sent >= 5 && r.opens === 0
            ? "fail"
            : rate >= 20
              ? "ok"
              : "warn",
        detail: `${r.sent} sent · ${rate}% open.`,
        remedy:
          r.sent >= 5 && r.opens === 0
            ? "Likely landing in spam — ask one of these recipients to whitelist your sender."
            : undefined,
      });
    }

    const overall = checks.reduce<"ok" | "warn" | "fail">(
      (acc, c) =>
        c.severity === "fail"
          ? "fail"
          : c.severity === "warn" && acc !== "fail"
            ? "warn"
            : acc,
      "ok"
    );

    return {
      ok: overall !== "fail",
      summary: `📨 ${sent} sent · ${openRate}% open · ${clickRate}% click (30d).`,
      targets: [
        {
          targetId: "deliverability",
          name: "30-day email deliverability",
          status: overall,
          tasksRemaining: checks.filter((c) => c.severity === "fail").length,
          checks,
          emailSent: false,
        },
      ],
      effects: ["Read-only."],
    };
  },
};
