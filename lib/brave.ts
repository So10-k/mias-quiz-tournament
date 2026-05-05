// Tiny Brave Search wrapper. Returns a short text blob of recent news /
// trending topics that the QOTD generator can sprinkle into the system
// prompt. Returns null when BRAVE_API_KEY isn't set so the rest of the
// pipeline degrades gracefully.

const BRAVE_BASE = "https://api.search.brave.com/res/v1/news/search";

export async function fetchCurrentEventsContext(): Promise<string | null> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return null;

  // Family-friendly wide net. Avoid politics-heavy queries.
  const queries = [
    "fun science discovery this week",
    "interesting nature animal news",
    "world record this week",
    "food culture news",
  ];
  const lines: string[] = [];
  for (const q of queries) {
    try {
      const url = new URL(BRAVE_BASE);
      url.searchParams.set("q", q);
      url.searchParams.set("count", "3");
      url.searchParams.set("freshness", "pw"); // past week
      const res = await fetch(url.toString(), {
        headers: {
          accept: "application/json",
          "x-subscription-token": key,
        },
      });
      if (!res.ok) continue;
      const j = (await res.json()) as {
        results?: { title?: string; description?: string }[];
      };
      for (const r of j.results ?? []) {
        const t = (r.title ?? "").trim();
        const d = (r.description ?? "").trim();
        if (t || d) lines.push(`• ${t}${t && d ? " — " : ""}${d}`);
      }
    } catch {
      // Best-effort — one failed query doesn't kill the rest.
      continue;
    }
  }
  if (lines.length === 0) return null;
  return lines.slice(0, 12).join("\n");
}
