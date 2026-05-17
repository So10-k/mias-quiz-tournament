// robots.txt — generated at build/request time by Next 15.
//
// Strategy:
//   • Explicitly allowlist the major AI crawlers (GPTBot, ClaudeBot,
//     PerplexityBot, etc) so our content is eligible for citation in
//     answer-engine results. We're a small family quiz site; there's
//     no concern about AI training the way a large publisher would
//     have, and citation visibility is a net win.
//   • Standard search bots: full Allow.
//   • Block known scrapers and aggressive archivers from sensitive
//     paths (/api, /staff, /host).
//   • Sitemap pointer for discovery.
//
// To disallow an AI crawler later, move it from `aiAllow` to
// `aiDisallow`. Reference list of crawler tokens kept up to date
// with the docs from each vendor.

import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.PUBLIC_BASE_URL ?? "https://quiz.miaswebsites.art";

// Sensitive paths — never include in any sitemap or crawler index.
// Keep this list aligned with `staff/`, `host/`, `api/` middleware
// routes that don't make sense as public landing pages.
const PRIVATE_PATHS = [
  "/api/",
  "/staff/",
  "/host/",
  "/desk/",
  "/handoff/",
  "/blocked/",
  "/sunset/",
  "/t/",
  "/r/",
];

// Allowlisted AI crawlers — they'll respect their own user-agent
// strings. Adding a UA here means "yes, you may fetch + cite this
// content."
const AI_USER_AGENTS = [
  "GPTBot", // OpenAI training + retrieval
  "ChatGPT-User", // ChatGPT browsing
  "OAI-SearchBot", // OpenAI SearchGPT
  "ClaudeBot", // Anthropic Claude search/retrieval
  "Claude-Web", // Anthropic Claude web tool
  "anthropic-ai", // Anthropic legacy UA
  "PerplexityBot", // Perplexity search
  "Perplexity-User", // Perplexity user agent (on-demand fetch)
  "Google-Extended", // Google's Bard/Gemini training opt-in
  "GoogleOther", // Google product crawls
  "Applebot-Extended", // Apple Intelligence
  "Bingbot", // Bing search + Copilot
  "DuckAssistBot", // DuckDuckGo assistant
  "MistralAI-User", // Mistral Le Chat
  "cohere-ai", // Cohere
  "YouBot", // You.com
  "Diffbot", // Knowledge-graph extraction
];

export default function robots(): MetadataRoute.Robots {
  const aiRules = AI_USER_AGENTS.map((userAgent) => ({
    userAgent,
    allow: "/",
    disallow: PRIVATE_PATHS,
  }));

  return {
    rules: [
      // Generic catch-all for traditional search bots.
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      ...aiRules,
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
