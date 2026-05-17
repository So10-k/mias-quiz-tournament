// Public status page for everything Sam runs.
//
// Public viewers see the websites + internal API gating + Auth0
// issuers. Author-authenticated viewers get the full set: database
// row counts, Groq, Resend, Brevo, R2, cron freshness, hosting
// metadata.
//
// Auth model: we re-use the existing Next-Auth player session. No
// extra OIDC callback needed because /status lives on the same
// origin as /signin. Author = Sam + Mia.

import Link from "next/link";
import type { Metadata } from "next";
import { Stage } from "@/components/Stage";
import { AnswerCapsule } from "@/components/AnswerCapsule";
import { AutoRefresh } from "@/components/AutoRefresh";
import { currentUser } from "@/lib/session";
import {
  runChecks,
  summarize,
  type CheckStatus,
  type CheckCategory,
} from "@/lib/status";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Status",
  description:
    "Live operational status of Mia's Quiz Tournament — websites, internal APIs, third-party services, and cron jobs.",
  alternates: { canonical: `${SITE_URL}/status` },
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Outage",
  unknown: "Unknown",
};

const STATUS_BG: Record<CheckStatus, string> = {
  operational: "bg-grass",
  degraded: "bg-sun",
  outage: "bg-coral",
  unknown: "bg-sky1",
};

const STATUS_TEXT: Record<CheckStatus, string> = {
  operational: "text-white",
  degraded: "text-navy",
  outage: "text-white",
  unknown: "text-navy",
};

const STATUS_ICON: Record<CheckStatus, string> = {
  operational: "✓",
  degraded: "⚠",
  outage: "✗",
  unknown: "?",
};

// Fixed render order so the page doesn't reshuffle between checks.
const CATEGORY_ORDER: CheckCategory[] = [
  "Websites",
  "Internal APIs",
  "Auth",
  "Database",
  "Email",
  "AI / TTS",
  "Storage",
  "Crons",
  "Hosting",
];

export default async function StatusPage() {
  const me = await currentUser();
  const isAuthor = me?.role === "author";

  const results = await runChecks({ includePrivate: isAuthor });
  const { overall, counts } = summarize(results);

  // Group by category, preserving fixed order.
  const grouped = new Map<CheckCategory, typeof results>();
  for (const r of results) {
    const cat = r.check.category;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(r);
  }
  const orderedCategories = CATEGORY_ORDER.filter((c) => grouped.has(c));

  return (
    <Stage scrollable>
      {/* Re-runs every 30s so the indicator stays fresh without
          hammering external services. Pauses when tab hidden. */}
      <AutoRefresh seconds={30} />
      <div className="max-w-4xl mx-auto pt-6 px-4 pb-12 flex flex-col gap-5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <Link href="/" className="pop pop-white text-sm">
            ← Home
          </Link>
          <div className="font-body text-xs text-navy-soft">
            Auto-refreshes every 30s
          </div>
        </div>

        <AnswerCapsule
          topic="status"
          question="What does the Quiz Book status page show?"
          answer="The status page reports live operational status for every website, internal API, third-party service, and scheduled job behind Mia's Quiz Tournament. Public visitors see uptime indicators for the main sites and APIs. Signed-in admins (Sam, Mia) see the full picture — database health, third-party API checks, cron freshness, and deployment metadata."
        />

        {/* Big overall status banner */}
        <div
          className={`card-sm px-5 py-4 flex items-center gap-4 flex-wrap ${STATUS_BG[overall]} ${STATUS_TEXT[overall]}`}
        >
          <span className="text-4xl shrink-0">{STATUS_ICON[overall]}</span>
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg uppercase tracking-[0.18em] opacity-90">
              All systems
            </p>
            <p className="font-display text-2xl md:text-3xl">
              {overall === "operational"
                ? "Operational"
                : overall === "degraded"
                  ? "Partially degraded"
                  : overall === "outage"
                    ? "Major outage"
                    : "Status unknown"}
            </p>
          </div>
          <div className="font-body text-xs opacity-90 text-right">
            <p>{counts.operational} operational</p>
            {counts.degraded ? <p>{counts.degraded} degraded</p> : null}
            {counts.outage ? <p>{counts.outage} outage</p> : null}
            {counts.unknown ? <p>{counts.unknown} unknown</p> : null}
          </div>
        </div>

        {!isAuthor ? (
          <div className="card-sm bg-sky1 px-4 py-3">
            <p className="font-body text-sm text-navy">
              👋 You&rsquo;re viewing the public status. Admins see the
              full set (database, Groq, Resend, Brevo, R2, crons).{" "}
              <Link
                href="/signin?next=/status"
                className="text-coral-deep underline"
              >
                Sign in
              </Link>{" "}
              if you have an admin account.
            </p>
          </div>
        ) : null}

        {orderedCategories.map((cat) => (
          <section key={cat} className="card px-5 py-4 md:px-6 md:py-5">
            <h2 className="font-display text-lg text-navy mb-3">{cat}</h2>
            <ul className="flex flex-col gap-2">
              {grouped.get(cat)!.map(({ check, result }) => (
                <li
                  key={check.id}
                  className="card-sm bg-white px-3 py-2 flex items-center gap-3 flex-wrap"
                >
                  <span
                    className={
                      "shrink-0 w-7 h-7 rounded-full border-2 border-navy flex items-center justify-center font-display text-sm " +
                      `${STATUS_BG[result.status]} ${STATUS_TEXT[result.status]}`
                    }
                    aria-label={STATUS_LABEL[result.status]}
                    title={STATUS_LABEL[result.status]}
                  >
                    {STATUS_ICON[result.status]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-base text-navy truncate">
                      {check.name}
                      {check.visibility === "private" ? (
                        <span className="ml-2 font-body text-[10px] uppercase tracking-wider text-coral-deep">
                          admin
                        </span>
                      ) : null}
                    </p>
                    {check.description ? (
                      <p className="font-body text-xs text-navy-soft">
                        {check.description}
                      </p>
                    ) : null}
                    <p className="font-body text-xs text-navy-soft mt-0.5">
                      {result.message}
                    </p>
                  </div>
                  {result.latencyMs != null ? (
                    <span className="font-body text-xs text-navy-soft shrink-0 tabular-nums">
                      {result.latencyMs}ms
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="font-body text-xs text-navy-soft text-center mt-2">
          Checks run server-side from the active Vercel region. Last
          updated {new Date().toLocaleTimeString()}.
        </p>
      </div>
    </Stage>
  );
}
