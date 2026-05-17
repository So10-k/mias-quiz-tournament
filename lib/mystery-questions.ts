// Misc-mode question generator for the championship round.
//
// The championship is a grab-bag of HARD miscellaneous trivia — every
// question on a different subject, no single theme to study for. Sam
// might be a finalist, so the editor + live HUD blind these prompts
// from him too (see app/host/finals-control/round/[slot]/page.tsx).

const GROQ_BASE = "https://api.groq.com/openai/v1";
const MODEL = "openai/gpt-oss-120b";

export type MysteryOption = {
  label: string;
  isCorrect: boolean;
};
export type MysteryQuestion = {
  prompt: string;
  options: MysteryOption[];
};

function key(): string {
  const k = process.env.GROQ_API_KEY;
  if (!k) throw new Error("GROQ_API_KEY not set");
  return k;
}

const SYSTEM_PROMPT = `You are drafting the championship round of a family quiz tournament — a MISCELLANEOUS round. Every question is on a DIFFERENT subject; the whole point is no one can study a single topic. Difficulty is HARD across the board (graduate-level pub-quiz hard — not "obscure trivia for trivia's sake" but genuinely difficult facts that a sharp adult would have to think about).

Cover a wide spread across questions. Pull from things like: world geography, science (physics/chem/bio), history (multiple regions + eras), literature, classical & pop music, film, art, math, sports, mythology, languages & etymology, food & cooking, technology history, astronomy, animal kingdom, board games, currencies, architecture, philosophy, medicine. Each question should sit in a different subject from its neighbors — no two consecutive questions on the same theme.

Each question must have exactly four options; exactly one is correct.

Hard rules:
• Output a JSON object matching the schema below exactly. No markdown fence, no commentary.
• Each option label is 1 to 80 characters.
• Each prompt is 1 to 240 characters.
• The correct option must be factually true — no jokes, no trick answers, no "all of the above".
• Distractors must be plausible (real, related, wrong) — not obviously absurd.
• Vary the question shape: some "Which…", some "What…", some "How many…", some "In which year…", some "Who…", etc.
• Aim for HARD difficulty — questions a casual player would miss, a well-read adult would get half of, and a true generalist might run.

Schema:
{ "questions": [ { "prompt": "string", "options": [ { "label": "string", "isCorrect": boolean }, ... 4 total ... ] } ] }`;

export async function generateMysteryQuestions(args: {
  count?: number;
}): Promise<MysteryQuestion[]> {
  const count = Math.max(5, Math.min(30, args.count ?? 15));
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 6000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Draft ${count} hard miscellaneous championship questions per the system instructions. Spread across as many different subject categories as possible. Return only the JSON object.`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq mystery generation ${res.status}: ${t.slice(0, 400)}`);
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
      `Groq returned non-JSON: ${(err as Error).message}`
    );
  }
  return validate(parsed, count);
}

function validate(input: unknown, expectedCount: number): MysteryQuestion[] {
  if (!input || typeof input !== "object") {
    throw new Error("generator output: not an object");
  }
  const obj = input as Record<string, unknown>;
  const questions = Array.isArray(obj.questions) ? obj.questions : [];
  if (questions.length === 0) {
    throw new Error("generator output: no questions");
  }
  const out: MysteryQuestion[] = [];
  for (const qRaw of questions) {
    if (!qRaw || typeof qRaw !== "object") continue;
    const q = qRaw as Record<string, unknown>;
    const prompt = typeof q.prompt === "string" ? q.prompt.trim() : "";
    if (!prompt) continue;
    if (prompt.length > 240) continue;
    const optsRaw = Array.isArray(q.options) ? q.options : [];
    const opts: MysteryOption[] = [];
    let correctCount = 0;
    for (const oRaw of optsRaw) {
      if (!oRaw || typeof oRaw !== "object") continue;
      const o = oRaw as Record<string, unknown>;
      const label = typeof o.label === "string" ? o.label.trim() : "";
      if (!label || label.length > 80) continue;
      const isCorrect = o.isCorrect === true;
      if (isCorrect) correctCount++;
      opts.push({ label, isCorrect });
    }
    if (opts.length !== 4) continue;
    if (correctCount !== 1) continue;
    out.push({ prompt, options: opts });
  }
  if (out.length < Math.min(5, expectedCount)) {
    throw new Error(
      `generator output: only ${out.length} usable questions after validation`
    );
  }
  return out;
}
