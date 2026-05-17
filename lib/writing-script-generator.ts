// AI script generator for "The Writing Session" workflow.
//
// Calls Groq (llama3-style large model) with a strict system prompt
// that forbids jokes — the host (Sam) will add their own. The model
// returns structured JSON we validate and persist to writing_scripts /
// writing_script_parts / writing_script_lines.
//
// On a fresh script the typical output is 8-14 parts, each with 4-10
// lines. Total ~80-120 lines. Lines are intentionally short so the
// human editors have room to flesh them out.

const GROQ_BASE = "https://api.groq.com/openai/v1";
const MODEL = "openai/gpt-oss-120b";

export type GeneratedCharacter =
  | "narrator"
  | "host"
  | "cohost"
  | "sam"
  | "mia"
  | "juliette"
  | "both";

export type GeneratedLine = {
  character: GeneratedCharacter;
  text: string;
  cue?: string | null;
};

export type GeneratedPart = {
  title: string;
  description?: string | null;
  lines: GeneratedLine[];
};

export type GeneratedScript = {
  title: string;
  parts: GeneratedPart[];
};

const CHARACTERS: GeneratedCharacter[] = [
  "narrator",
  "host",
  "cohost",
  "sam",
  "mia",
  "juliette",
  "both",
];

const SYSTEM_PROMPT = `You are a professional broadcast script writer for a PRE-TAPED family quiz tournament finals — recorded round-by-round and edited together into a watch-anytime video. Your job is to draft a clean, serious, professionally-structured show script.

CONSTRAINTS (absolute):
• Tone is serious, polished, sincere. Think network broadcast or sports finals — not sitcom, not parody.
• Absolutely NO jokes, puns, wordplay, sarcasm, ironic asides, or "wink at the camera" lines. The hosts will add their own inside-jokes later. Your jokes are not their jokes; resist the urge.
• No advertising language, no exclamation marks unless quoting a literal cheer.
• Lines are short and speakable — 1 to 2 sentences each. Conversational, never lecture-y.
• Two co-hosts share lines: "mia" (a 7-year-old) and "juliette" (a teen). Until the host (Sam) decides otherwise, write hosting lines using the generic role "host" — Mia will reassign them during the delegation phase.
• Use "narrator" sparingly for off-camera VO. Use "sam" only for technical director cues that won't be spoken on air (camera switch directions, etc.) — these are rare.
• Cues describe what is happening physically/visually (e.g. "video roll", "applaud", "wait for confetti to clear"). Do not write cues as comedic asides.

STRUCTURE you must follow (in this order, named exactly):
1. "Cold open" — short pre-recorded tease, narrator + b-roll.
2. "Welcome + Hosts" — first words from the hosts. They introduce themselves by saying their own names.
3. "Tournament recap" — recap of the season's journey. Names: Karen, Marc, Grandpa, Sam, and the eliminated players.
4. "Bracket reveal" — point at the bracket; explain the night's format.
5. "Losers' bracket final intro" — preview Grandpa vs Sam.
6. "Losers' bracket final" — short interstitials between questions; mostly stage cues. The actual questions are run by the platform, so the hosts only frame and react.
7. "Losers' bracket final scoreboard"
8. "Winners' bracket final intro" — preview Karen vs Marc.
9. "Winners' bracket final" — same shape as the losers' bracket final.
10. "Winners' bracket final scoreboard"
11. "Championship tease"
12. "Championship round"
13. "Champion ceremony"
14. "Closing credits"

OUTPUT: a single JSON object matching exactly this shape — no markdown fence, no commentary:
{
  "title": "string",
  "parts": [
    {
      "title": "string",
      "description": "string | null",
      "lines": [
        { "character": "narrator|host|cohost|sam|mia|juliette|both", "text": "string", "cue": "string | null" }
      ]
    }
  ]
}

Aim for 8 to 14 parts and 4 to 10 lines per part. Total ~100 lines. Brevity beats length.`;

function key(): string {
  const k = process.env.GROQ_API_KEY;
  if (!k) throw new Error("GROQ_API_KEY not set");
  return k;
}

export async function generateScript(args: {
  brief?: string | null;
}): Promise<GeneratedScript> {
  const userPrompt = `Brief from the host:
${args.brief?.trim() || "(no brief — use sensible defaults)"}

Please draft the script now per the system instructions.`;

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.45, // serious tone — keep it disciplined
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq script generation ${res.status}: ${t.slice(0, 400)}`);
  }
  const j = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = j.choices?.[0]?.message?.content ?? "";
  if (!raw) throw new Error("Groq returned empty content");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Groq returned non-JSON: ${(err as Error).message}\n---\n${raw.slice(0, 400)}`
    );
  }
  return validateScript(parsed);
}

function validateScript(input: unknown): GeneratedScript {
  if (!input || typeof input !== "object") {
    throw new Error("generator output: not an object");
  }
  const obj = input as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  if (!title) throw new Error("generator output: missing title");
  if (!Array.isArray(obj.parts) || obj.parts.length === 0) {
    throw new Error("generator output: missing parts[]");
  }
  const parts: GeneratedPart[] = [];
  for (const partRaw of obj.parts) {
    if (!partRaw || typeof partRaw !== "object") continue;
    const part = partRaw as Record<string, unknown>;
    const partTitle = typeof part.title === "string" ? part.title.trim() : "";
    if (!partTitle) continue;
    const partDesc =
      typeof part.description === "string" ? part.description.trim() : null;
    const linesRaw = Array.isArray(part.lines) ? part.lines : [];
    const lines: GeneratedLine[] = [];
    for (const lineRaw of linesRaw) {
      if (!lineRaw || typeof lineRaw !== "object") continue;
      const line = lineRaw as Record<string, unknown>;
      const text = typeof line.text === "string" ? line.text.trim() : "";
      if (!text) continue;
      let character = (line.character ?? "host") as GeneratedCharacter;
      if (!CHARACTERS.includes(character)) character = "host";
      const cue = typeof line.cue === "string" ? line.cue.trim() : null;
      lines.push({ character, text, cue: cue || null });
    }
    parts.push({ title: partTitle, description: partDesc, lines });
  }
  if (parts.length === 0) {
    throw new Error("generator output: zero usable parts after validation");
  }
  return { title, parts };
}
