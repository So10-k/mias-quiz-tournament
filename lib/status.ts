// Status-page health check infrastructure.
//
// Each check is a function returning { status, latencyMs, message,
// details? }. The page runs all visible checks in parallel, ignoring
// individual failures (a downed third-party doesn't block rendering),
// with a hard 6-second timeout per check so the page never hangs.
//
// Visibility:
//   public   — visible to anyone (signed-in or not). Bare up/down.
//   private  — visible only to currentUser().role === 'author'. Pulls
//              in API-key-authenticated checks + internal probes.

import { db, schema } from "@/db";
import { desc, eq, sql, gt } from "drizzle-orm";
import { isR2Configured, headObject } from "@/lib/r2";

export type CheckStatus = "operational" | "degraded" | "outage" | "unknown";

export type CheckResult = {
  status: CheckStatus;
  latencyMs: number | null;
  message: string;
  details?: Record<string, unknown>;
};

export type CheckCategory =
  | "Websites"
  | "Internal APIs"
  | "Database"
  | "Auth"
  | "Email"
  | "AI / TTS"
  | "Storage"
  | "Crons"
  | "Hosting";

export type Check = {
  id: string;
  name: string;
  category: CheckCategory;
  // Public checks render for everyone. Private checks require the
  // viewer's role === 'author' (Sam or Mia).
  visibility: "public" | "private";
  // Optional extra description rendered under the name.
  description?: string;
  run: () => Promise<CheckResult>;
};

// ─── helpers ─────────────────────────────────────────────────────

const PER_CHECK_TIMEOUT_MS = 6000;

function timeoutAbort(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return {
    signal: ctrl.signal,
    cancel: () => clearTimeout(id),
  };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const start = performance.now();
  const value = await fn();
  return { value, latencyMs: Math.round(performance.now() - start) };
}

// HTTP HEAD check — counts a 2xx/3xx as operational, 4xx as
// "degraded" (auth/permission), 5xx as outage. Network errors → outage.
async function httpCheck(args: {
  url: string;
  method?: "GET" | "HEAD";
  expectStatus?: number | "ok" | "any";
  // Optional headers (e.g. Authorization)
  headers?: Record<string, string>;
}): Promise<CheckResult> {
  const { signal, cancel } = timeoutAbort(PER_CHECK_TIMEOUT_MS);
  try {
    const start = performance.now();
    const res = await fetch(args.url, {
      method: args.method ?? "HEAD",
      headers: args.headers,
      cache: "no-store",
      signal,
    });
    const latencyMs = Math.round(performance.now() - start);
    const expect = args.expectStatus ?? "ok";
    let status: CheckStatus = "operational";
    if (expect === "any") {
      status = "operational";
    } else if (typeof expect === "number") {
      status = res.status === expect ? "operational" : "degraded";
    } else {
      // "ok"
      if (res.ok) status = "operational";
      else if (res.status >= 500) status = "outage";
      else status = "degraded";
    }
    return {
      status,
      latencyMs,
      message: `${res.status} ${res.statusText || ""}`.trim(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return {
      status: msg.includes("aborted") ? "degraded" : "outage",
      latencyMs: null,
      message: msg,
    };
  } finally {
    cancel();
  }
}

// ─── public checks ───────────────────────────────────────────────

const SELF_BASE =
  process.env.PUBLIC_BASE_URL ?? "https://quiz.miaswebsites.art";

// Self-check: trivially operational because we rendered. Latency
// "0" = "we're here".
async function selfCheck(): Promise<CheckResult> {
  return {
    status: "operational",
    latencyMs: 0,
    message: "page rendered — service is up",
  };
}

const PUBLIC_CHECKS: Check[] = [
  {
    id: "site-quiz",
    name: "Quiz site (quiz.miaswebsites.art)",
    category: "Websites",
    visibility: "public",
    description: "The main tournament app. You're looking at it.",
    run: selfCheck,
  },
  {
    id: "site-root",
    name: "Root domain (miaswebsites.art)",
    category: "Websites",
    visibility: "public",
    description: "Parent landing site.",
    run: () =>
      httpCheck({
        url: "https://miaswebsites.art",
        method: "GET",
        expectStatus: "ok",
      }),
  },
  {
    id: "site-staff",
    name: "Staff portal (staff.miaswebsites.art)",
    category: "Websites",
    visibility: "public",
    description: "Duo-authenticated staff dashboards.",
    run: () =>
      httpCheck({
        url: "https://staff.miaswebsites.art/staff/signin",
        method: "GET",
        // Should redirect to OIDC or render the signin page.
        expectStatus: "any",
      }),
  },
  {
    id: "site-status",
    name: "Status DNS (status.miaswebsites.art)",
    category: "Websites",
    visibility: "public",
    description: "Subdomain reserved; this page lives at /status for now.",
    run: () =>
      httpCheck({
        url: "https://status.miaswebsites.art",
        method: "GET",
        expectStatus: "any",
      }),
  },
  {
    id: "site-discuss",
    name: "Discuss forum (discuss.miaswebsites.art)",
    category: "Websites",
    visibility: "public",
    description:
      "Self-hosted Discourse instance. SSO bridges to the quiz site session.",
    run: () =>
      httpCheck({
        url: "https://discuss.miaswebsites.art",
        method: "GET",
        expectStatus: "any",
      }),
  },
  {
    id: "api-discourse-sso",
    name: "/api/discourse/sso (auth gate)",
    category: "Internal APIs",
    visibility: "public",
    description:
      "DiscourseConnect endpoint. Bare GET should 400 with 'missing sso/sig'.",
    run: () =>
      httpCheck({
        url: `${SELF_BASE}/api/discourse/sso`,
        method: "GET",
        expectStatus: 400,
      }),
  },
  {
    id: "api-health",
    name: "/api/health",
    category: "Internal APIs",
    visibility: "public",
    description: "Liveness probe. Returns deployment SHA + region.",
    run: () =>
      httpCheck({
        url: `${SELF_BASE}/api/health`,
        method: "GET",
        expectStatus: 200,
      }),
  },
  {
    id: "api-tts-auth",
    name: "/api/tts (auth gate)",
    category: "Internal APIs",
    visibility: "public",
    description:
      "Confirms the TTS endpoint rejects unauthenticated requests (401).",
    run: () =>
      httpCheck({
        url: `${SELF_BASE}/api/tts`,
        method: "GET",
        expectStatus: 401,
      }),
  },
  {
    id: "api-live-state-404",
    name: "/api/live/<id>/state (auth gate)",
    category: "Internal APIs",
    visibility: "public",
    description:
      "Live-round state endpoint. Unauthenticated request should 401.",
    run: () =>
      httpCheck({
        url: `${SELF_BASE}/api/live/__probe__/state`,
        method: "GET",
        expectStatus: 401,
      }),
  },
  {
    id: "api-qotd-cron-secret",
    name: "/api/qotd/cron (CRON_SECRET fail-closed)",
    category: "Internal APIs",
    visibility: "public",
    description: "Should reject requests without the cron secret.",
    run: () =>
      httpCheck({
        url: `${SELF_BASE}/api/qotd/cron`,
        method: "GET",
        expectStatus: 401,
      }),
  },
  {
    id: "api-newsletter-cron-secret",
    name: "/api/newsletter/cron (CRON_SECRET fail-closed)",
    category: "Internal APIs",
    visibility: "public",
    description: "Should reject requests without the cron secret.",
    run: () =>
      httpCheck({
        url: `${SELF_BASE}/api/newsletter/cron`,
        method: "GET",
        expectStatus: 401,
      }),
  },
  {
    id: "auth-issuer-player",
    name: "Auth0 player issuer",
    category: "Auth",
    visibility: "public",
    description: "OIDC discovery for the player Auth0 app.",
    run: () => {
      const issuer = process.env.AUTH_AUTH0_ISSUER;
      if (!issuer) {
        return Promise.resolve({
          status: "unknown" as const,
          latencyMs: null,
          message: "AUTH_AUTH0_ISSUER not set",
        });
      }
      return httpCheck({
        url: `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
        method: "GET",
        expectStatus: 200,
      });
    },
  },
  {
    id: "auth-issuer-staff",
    name: "Auth0 staff issuer",
    category: "Auth",
    visibility: "public",
    description: "OIDC discovery for the staff Auth0 app.",
    run: () => {
      const issuer = process.env.AUTH_AUTH0_STAFF_ISSUER;
      if (!issuer) {
        return Promise.resolve({
          status: "unknown" as const,
          latencyMs: null,
          message: "AUTH_AUTH0_STAFF_ISSUER not set",
        });
      }
      return httpCheck({
        url: `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
        method: "GET",
        expectStatus: 200,
      });
    },
  },
];

// ─── private (author-only) checks ────────────────────────────────

const PRIVATE_CHECKS: Check[] = [
  {
    id: "db-neon",
    name: "Neon Postgres",
    category: "Database",
    visibility: "private",
    description: "Round-trip a SELECT 1.",
    run: async () => {
      try {
        const { latencyMs } = await timed(async () => {
          await db.execute(sql`SELECT 1 AS ok`);
        });
        return {
          status: "operational",
          latencyMs,
          message: "SELECT 1 ok",
        };
      } catch (e) {
        return {
          status: "outage",
          latencyMs: null,
          message: e instanceof Error ? e.message : "db error",
        };
      }
    },
  },
  {
    id: "db-row-counts",
    name: "Database row counts",
    category: "Database",
    visibility: "private",
    description: "Snapshot of core tables — for sanity, not alerting.",
    run: async () => {
      try {
        const { latencyMs, value } = await timed(async () => {
          const [users] = await db
            .select({ n: sql<number>`COUNT(*)::int` })
            .from(schema.users);
          const [arts] = await db
            .select({ n: sql<number>`COUNT(*)::int` })
            .from(schema.articles);
          const [rounds] = await db
            .select({ n: sql<number>`COUNT(*)::int` })
            .from(schema.rounds);
          const [subs] = await db
            .select({ n: sql<number>`COUNT(*)::int` })
            .from(schema.newsletterSubscriptions);
          return {
            users: users?.n ?? 0,
            articles: arts?.n ?? 0,
            rounds: rounds?.n ?? 0,
            subscribers: subs?.n ?? 0,
          };
        });
        return {
          status: "operational",
          latencyMs,
          message: `${value.users} users · ${value.rounds} rounds · ${value.articles} articles · ${value.subscribers} subs`,
          details: value as Record<string, unknown>,
        };
      } catch (e) {
        return {
          status: "outage",
          latencyMs: null,
          message: e instanceof Error ? e.message : "db error",
        };
      }
    },
  },
  {
    id: "groq-models",
    name: "Groq API",
    category: "AI / TTS",
    visibility: "private",
    description:
      "List available models — verifies API key + service availability.",
    run: () => {
      const key = process.env.GROQ_API_KEY;
      if (!key) {
        return Promise.resolve({
          status: "unknown" as const,
          latencyMs: null,
          message: "GROQ_API_KEY not set",
        });
      }
      return httpCheck({
        url: "https://api.groq.com/openai/v1/models",
        method: "GET",
        headers: { authorization: `Bearer ${key}` },
        expectStatus: 200,
      });
    },
  },
  {
    id: "resend",
    name: "Resend",
    category: "Email",
    visibility: "private",
    description: "Authenticated GET /domains.",
    run: () => {
      const key = process.env.RESEND_API_KEY;
      if (!key) {
        return Promise.resolve({
          status: "unknown" as const,
          latencyMs: null,
          message: "RESEND_API_KEY not set",
        });
      }
      return httpCheck({
        url: "https://api.resend.com/domains",
        method: "GET",
        headers: { authorization: `Bearer ${key}` },
        expectStatus: 200,
      });
    },
  },
  {
    id: "brevo",
    name: "Brevo (Sendinblue)",
    category: "Email",
    visibility: "private",
    description: "Authenticated GET /v3/account.",
    run: () => {
      const key = process.env.BREVO_API_KEY;
      if (!key) {
        return Promise.resolve({
          status: "unknown" as const,
          latencyMs: null,
          message: "BREVO_API_KEY not set",
        });
      }
      return httpCheck({
        url: "https://api.brevo.com/v3/account",
        method: "GET",
        headers: { "api-key": key, accept: "application/json" },
        expectStatus: 200,
      });
    },
  },
  {
    id: "r2",
    name: "Cloudflare R2",
    category: "Storage",
    visibility: "private",
    description:
      "HEAD a known TTS cache object. Operational means the bucket is reachable + creds work.",
    run: async () => {
      if (!isR2Configured()) {
        return {
          status: "unknown",
          latencyMs: null,
          message: "R2 env vars not set",
        };
      }
      try {
        const { latencyMs } = await timed(async () => {
          // Probe a deterministic key. If it doesn't exist, R2 returns
          // a 404 — which still tells us the bucket + creds work.
          try {
            await headObject("tts/__probe__.wav");
          } catch (e) {
            const code =
              (e as { name?: string; Code?: string }).name ||
              (e as { Code?: string }).Code ||
              "";
            // 404/NoSuchKey is fine — bucket reached.
            if (
              code === "NotFound" ||
              code === "NoSuchKey" ||
              code === "404"
            ) {
              return;
            }
            throw e;
          }
        });
        return {
          status: "operational",
          latencyMs,
          message: "bucket reachable, creds valid",
        };
      } catch (e) {
        return {
          status: "outage",
          latencyMs: null,
          message: e instanceof Error ? e.message : "r2 error",
        };
      }
    },
  },
  {
    id: "cron-qotd-recent",
    name: "QOTD cron · last fired",
    category: "Crons",
    visibility: "private",
    description: "Daily at 11:00 UTC. Should be fresh today or yesterday.",
    run: async () => {
      try {
        const [latest] = await db
          .select({
            forDate: schema.qotdQuestions.forDate,
            createdAt: schema.qotdQuestions.createdAt,
          })
          .from(schema.qotdQuestions)
          .orderBy(desc(schema.qotdQuestions.createdAt))
          .limit(1);
        if (!latest) {
          return {
            status: "degraded",
            latencyMs: null,
            message: "no QOTD rows yet",
          };
        }
        const ageH =
          (Date.now() - latest.createdAt.getTime()) / (60 * 60 * 1000);
        const status: CheckStatus =
          ageH < 30 ? "operational" : ageH < 50 ? "degraded" : "outage";
        return {
          status,
          latencyMs: null,
          message: `latest ${latest.forDate} · ${ageH.toFixed(1)}h ago`,
        };
      } catch (e) {
        return {
          status: "unknown",
          latencyMs: null,
          message: e instanceof Error ? e.message : "db error",
        };
      }
    },
  },
  {
    id: "email-sends-recent",
    name: "Email sends · last 24h",
    category: "Email",
    visibility: "private",
    description: "Activity rollup — confirms the send pipeline ran recently.",
    run: async () => {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [row] = await db
          .select({ n: sql<number>`COUNT(*)::int` })
          .from(schema.emailSends)
          .where(gt(schema.emailSends.sentAt, since));
        const n = row?.n ?? 0;
        return {
          status: "operational",
          latencyMs: null,
          message: `${n} sent in 24h`,
        };
      } catch (e) {
        return {
          status: "unknown",
          latencyMs: null,
          message: e instanceof Error ? e.message : "db error",
        };
      }
    },
  },
  {
    id: "host-vercel",
    name: "Vercel hosting",
    category: "Hosting",
    visibility: "private",
    description: "Deployment region + build SHA.",
    run: async () => {
      const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev";
      const region = process.env.VERCEL_REGION ?? "local";
      const env = process.env.VERCEL_ENV ?? "development";
      return {
        status: "operational",
        latencyMs: 0,
        message: `${env} · ${region} · ${sha}`,
        details: { sha, region, env },
      };
    },
  },
];

// ─── runner ──────────────────────────────────────────────────────

export async function runChecks(args: {
  includePrivate: boolean;
}): Promise<{ check: Check; result: CheckResult }[]> {
  const checks = args.includePrivate
    ? [...PUBLIC_CHECKS, ...PRIVATE_CHECKS]
    : PUBLIC_CHECKS;
  const results = await Promise.all(
    checks.map(async (c) => {
      try {
        const result = await c.run();
        return { check: c, result };
      } catch (e) {
        return {
          check: c,
          result: {
            status: "outage" as CheckStatus,
            latencyMs: null,
            message: e instanceof Error ? e.message : "check failed",
          },
        };
      }
    })
  );
  return results;
}

export function summarize(
  results: { check: Check; result: CheckResult }[]
): { overall: CheckStatus; counts: Record<CheckStatus, number> } {
  const counts: Record<CheckStatus, number> = {
    operational: 0,
    degraded: 0,
    outage: 0,
    unknown: 0,
  };
  for (const r of results) counts[r.result.status]++;
  const overall: CheckStatus =
    counts.outage > 0
      ? "outage"
      : counts.degraded > 0
        ? "degraded"
        : counts.unknown > 0 && counts.operational === 0
          ? "unknown"
          : "operational";
  return { overall, counts };
}
