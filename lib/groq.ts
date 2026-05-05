// Groq client wrapper for the Question of the Day feature.
// Three model usages:
//   • openai/gpt-oss-120b           — generate the daily question + write
//                                     the prompt + 4 options
//   • openai/gpt-oss-safeguard-20b  — gate user-submitted free-text
//                                     responses ("Other") + recommendation
//                                     topics for safety/spam/age-fairness
//   • canopylabs/orpheus-v1-english — text-to-speech of the daily question
//
// All calls go through Groq's OpenAI-compatible REST API. We avoid the
// official `groq-sdk` package to keep the bundle slim and not couple to
// its types — Groq's chat-completions endpoint is a clean superset of
// OpenAI's, so a tiny fetch wrapper does the job.

const GROQ_BASE = "https://api.groq.com/openai/v1";

export const QOTD_MODEL_GENERATE = "openai/gpt-oss-120b";
export const QOTD_MODEL_SAFEGUARD = "openai/gpt-oss-safeguard-20b";
export const QOTD_MODEL_TTS = "canopylabs/orpheus-v1-english";

function key(): string {
  const k = process.env.GROQ_API_KEY;
  if (!k) throw new Error("GROQ_API_KEY not set");
  return k;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function chat(args: {
  model: string;
  messages: ChatMessage[];
  responseFormat?: "json_object" | "text";
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      temperature: args.temperature ?? 0.7,
      max_tokens: args.maxTokens ?? 1500,
      ...(args.responseFormat === "json_object"
        ? { response_format: { type: "json_object" } }
        : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq chat ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = j.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Groq returned empty content");
  return content;
}

// ─── question generation ───────────────────────────────────────────────

export type GeneratedQuestion = {
  prompt: string;
  options: { label: string; value: "A" | "B" | "C" | "D" }[];
  // 1-2 sentence explanation of why this question was picked. Used to fill
  // qotd_questions.context for debugging + display.
  rationale: string;
};

export async function generateDailyQuestion(args: {
  recommendation?: string | null;
  currentEventsContext?: string | null;
  recentQuestionPrompts?: string[];
}): Promise<GeneratedQuestion> {
  const recent = args.recentQuestionPrompts?.length
    ? `\n\nDon't repeat or closely echo these recent questions:\n- ${args.recentQuestionPrompts.slice(0, 14).join("\n- ")}`
    : "";
  const seed = args.recommendation
    ? `Suggested topic from a player: "${args.recommendation}".`
    : "No specific suggestion today — pick a fun, age-fair topic on your own.";
  const ctx = args.currentEventsContext
    ? `\n\nContext (recent news / cultural moments — use only if it fits naturally and stays family-friendly):\n${args.currentEventsContext.slice(0, 2000)}`
    : "";

  const system = [
    "You write a 'Question of the Day' for a small family quiz tournament. Players range from a 7-year-old (Mia) to grandparents in their 90s.",
    "Rules:",
    "• ONE multiple-choice question with EXACTLY four options labeled A/B/C/D.",
    "• Topics must be age-fair: no era-specific pop culture, no slang, no recent celebrities.",
    "• Tone: warm, curious, gentle humor. Picture-book vibe.",
    "• AVOID: politics, religion, anything sad or scary, anything that requires reading skill above ~5th grade.",
    "• PREFER: nature, food, geography, science, animals, simple history, riddles, comparisons.",
    "• You MUST output strict JSON: {\"prompt\":string,\"options\":[{\"label\":string,\"value\":\"A\"|\"B\"|\"C\"|\"D\"}],\"rationale\":string}",
    "• Don't mark a 'correct' answer — this is a fun discussion question, not a quiz; players should feel free to disagree.",
  ].join("\n");

  const user = `${seed}${ctx}${recent}\n\nGenerate today's Question of the Day as JSON.`;

  const raw = await chat({
    model: QOTD_MODEL_GENERATE,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    responseFormat: "json_object",
    temperature: 0.85,
    maxTokens: 800,
  });

  // Defensive parse — strip code fences if present.
  const cleaned = raw.replace(/^```(?:json)?/g, "").replace(/```$/g, "").trim();
  const parsed = JSON.parse(cleaned) as GeneratedQuestion;
  if (
    !parsed.prompt ||
    !Array.isArray(parsed.options) ||
    parsed.options.length !== 4
  ) {
    throw new Error("Groq returned malformed question");
  }
  return parsed;
}

// ─── safeguarding ─────────────────────────────────────────────────────

export type SafeguardVerdict = {
  // "safe"   = let it through as-is
  // "clean"  = let it through but use the cleaned text instead
  // "block"  = reject
  decision: "safe" | "clean" | "block";
  cleanText?: string;
  reason?: string;
};

export async function safeguardText(
  text: string,
  context: "recommendation" | "response"
): Promise<SafeguardVerdict> {
  const trimmed = text.trim();
  if (!trimmed) return { decision: "block", reason: "empty" };
  if (trimmed.length > 500) {
    return { decision: "block", reason: "too long" };
  }

  const system = [
    "You moderate text submitted by players in a family quiz tournament that includes a 7-year-old.",
    `Submission type: ${
      context === "recommendation"
        ? "a suggested topic for a future daily question"
        : "an 'Other' response to today's daily question"
    }.`,
    "Tasks:",
    "1. Decide one of: 'safe' (good as-is), 'clean' (remove or rephrase a small part — e.g. typos, light profanity, awkward phrasing — and return polished text), or 'block' (reject — hate, sexual content, threats, instructions for harm, age-inappropriate, spam, advertising, personal data of others).",
    "2. If 'clean', return polished text that keeps the player's intent but reads tidily and respectfully. Limit to 200 chars.",
    "3. Output strict JSON: {\"decision\":\"safe\"|\"clean\"|\"block\",\"cleanText\":string?,\"reason\":string?}",
    "When in doubt between safe/clean, prefer 'clean' and tidy. Only 'block' for clear violations.",
  ].join("\n");

  const raw = await chat({
    model: QOTD_MODEL_SAFEGUARD,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Submission:\n"""\n${trimmed}\n"""` },
    ],
    responseFormat: "json_object",
    temperature: 0.1,
    maxTokens: 400,
  });
  const cleaned = raw.replace(/^```(?:json)?/g, "").replace(/```$/g, "").trim();
  const parsed = JSON.parse(cleaned) as SafeguardVerdict;
  if (parsed.decision === "clean" && parsed.cleanText) {
    parsed.cleanText = parsed.cleanText.trim().slice(0, 200);
  }
  return parsed;
}

// ─── text-to-speech ───────────────────────────────────────────────────

// Returns audio bytes (Buffer/Uint8Array). Caller is expected to stream/
// store this — we don't write to R2 from here so the caller has full
// control of the destination (and lazy-loading semantics).
export async function generateSpeech(text: string): Promise<Uint8Array> {
  const res = await fetch(`${GROQ_BASE}/audio/speech`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: QOTD_MODEL_TTS,
      input: text.slice(0, 800),
      // Orpheus default voice; the API accepts an optional `voice` param
      // but we let the model decide for v1.
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq TTS ${res.status}: ${t.slice(0, 300)}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
