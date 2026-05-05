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

// Hard blocklist — obvious sexual / profane / slur terms. Belt-and-
// suspenders before the LLM safeguard call so even if the model is
// squishy or the API errors, the worst stuff doesn't reach a 7-year-old.
const HARD_BLOCKLIST: string[] = [
  // sexual / anatomical (explicit)
  "penis",
  "vagina",
  "dick",
  "cock",
  "pussy",
  "boob",
  "tit",
  "cum",
  "jizz",
  "horny",
  "sexy",
  "porn",
  "blowjob",
  "handjob",
  // profanity
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "bastard",
  // slurs (any)
  "retard",
  " fag",
  "faggot",
  "n-word",
  // self-harm
  "kill myself",
  "kms",
  "suicid",
];

function hardBlockHit(text: string): string | null {
  // Normalise: lowercase, strip zero-width, collapse common letter-spacing
  // tricks (p e n i s), basic leetspeak (p3n1s), and punctuation between
  // letters (p.e.n.i.s).
  const t = text
    .toLowerCase()
    .replace(/[​-‍﻿]/g, "")
    .replace(/[*_\-.\s]+(?=\w)/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/@/g, "a")
    .replace(/\$/g, "s");
  for (const term of HARD_BLOCKLIST) {
    const needle = term.toLowerCase().replace(/\s/g, "");
    if (t.includes(needle)) return term.trim();
  }
  return null;
}

export async function safeguardText(
  text: string,
  context: "recommendation" | "response"
): Promise<SafeguardVerdict> {
  const trimmed = text.trim();
  if (!trimmed) return { decision: "block", reason: "empty" };
  if (trimmed.length > 500) {
    return { decision: "block", reason: "too long" };
  }

  // Hard blocklist FIRST — if it hits, never even ask the LLM. Catches
  // cases where the model returns "safe" on borderline-explicit slang.
  const hit = hardBlockHit(trimmed);
  if (hit) {
    return {
      decision: "block",
      reason: `contains blocked term (${hit})`,
    };
  }

  const system = [
    "You moderate text submitted by players in a SMALL FAMILY quiz tournament that INCLUDES A 7-YEAR-OLD CHILD.",
    "Audience age range: 7 to 90. Treat this like moderating a children's-book comment section.",
    `Submission type: ${
      context === "recommendation"
        ? "a suggested topic for a future daily question"
        : "an 'Other' response to today's daily question"
    }.`,
    "",
    "Decide one of three outcomes:",
    "  • 'safe'  — fine as-is. Tidy, family-friendly, on-topic, no concerns.",
    "  • 'clean' — INTENT is fine but text needs minor tidying (typos, slang spelling like 'lowk' / 'tbh', awkwardness). Return polished text under 200 chars.",
    "  • 'block' — REJECT. Use this whenever ANY of the following apply:",
    "      - sexual references of any kind, including jokes, euphemisms, body parts (penis, breasts, etc.), sex acts, hooking up, naked, kinks",
    "      - profanity (fuck, shit, ass as profanity, bitch, damn as profanity, piss, hell as profanity) including censored or slang variants ('fk', 'sht', 'wtf', 'af')",
    "      - slurs of any kind",
    "      - drugs, alcohol consumption, smoking, vaping",
    "      - violence, self-harm, threats, weapons (beyond age-appropriate context)",
    "      - bathroom humor more graphic than 'poop'/'fart'",
    "      - personal info about real people (full names + contact, addresses)",
    "      - advertising, spam, links, phone numbers",
    "      - hateful or mean-spirited content directed at people",
    "      - clearly off-topic 'lol test' / 'asdfgh' / keyboard mash garbage",
    "",
    "Default behavior: when uncertain, choose 'block'. NEVER use 'safe' or 'clean' for sexual content, profanity, or slurs even when framed as a joke. The framings 'lol', 'lowk', 'jk', 'as a joke' are RED FLAGS, not softeners.",
    "",
    "Output strict JSON: {\"decision\":\"safe\"|\"clean\"|\"block\",\"cleanText\":string?,\"reason\":string?}",
    "Always include a short `reason` when blocking.",
  ].join("\n");

  let raw: string;
  try {
    raw = await chat({
      model: QOTD_MODEL_SAFEGUARD,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Submission:\n"""\n${trimmed}\n"""` },
      ],
      responseFormat: "json_object",
      temperature: 0,
      maxTokens: 400,
    });
  } catch (e) {
    // Fail CLOSED: if the safeguard API is unavailable, block rather
    // than let questionable text through. Caller can surface "try a
    // different wording" to the player.
    return {
      decision: "block",
      reason: `safeguard unavailable: ${
        e instanceof Error ? e.message : "unknown"
      }`,
    };
  }
  const cleaned = raw.replace(/^```(?:json)?/g, "").replace(/```$/g, "").trim();
  let parsed: SafeguardVerdict;
  try {
    parsed = JSON.parse(cleaned) as SafeguardVerdict;
  } catch {
    return { decision: "block", reason: "safeguard parse error" };
  }
  if (parsed.decision === "clean" && parsed.cleanText) {
    parsed.cleanText = parsed.cleanText.trim().slice(0, 200);
    // Re-run the cleaned text through the hard blocklist — the model
    // could rephrase to keep something graphic.
    const cleanHit = hardBlockHit(parsed.cleanText);
    if (cleanHit) {
      return {
        decision: "block",
        reason: `cleaned text tripped blocklist (${cleanHit})`,
      };
    }
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
