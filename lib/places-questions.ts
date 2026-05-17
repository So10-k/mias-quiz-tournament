// Famous-places question generator for the winners' and losers'
// bracket finals. Both rounds use the same topic (famous places /
// landmarks) at EXTREME difficulty, but each round gets its own
// freshly-generated set so the two rounds never share prompts.
//
// "Extreme" here means: obscure facts about real places — not just
// "what country is the Eiffel Tower in" — think geological records,
// historical firsts, specific architects, unusual statistics.

const GROQ_BASE = "https://api.groq.com/openai/v1";
const MODEL = "openai/gpt-oss-120b";

export type PlacesOption = {
  label: string;
  isCorrect: boolean;
};
export type PlacesQuestion = {
  prompt: string;
  options: PlacesOption[];
};

function key(): string {
  const k = process.env.GROQ_API_KEY;
  if (!k) throw new Error("GROQ_API_KEY not set");
  return k;
}

const SYSTEM_PROMPT = `You are drafting one of the two bracket-final rounds of a family quiz tournament. Topic: FAMOUS PLACES — landmarks, cities, geography, monuments, natural wonders, architectural marvels, world heritage sites. Difficulty: EXTREME — these are the bracket finals, only the strongest two players from each side reach this point. Questions should make a well-traveled, well-read adult genuinely pause.

Spread across the whole topic so it doesn't feel like one subcategory:
• Iconic urban landmarks (Eiffel Tower, Petronas Towers, Burj Khalifa, etc.) but obscure facts about them.
• Natural wonders (waterfalls, canyons, deserts, caves, mountains).
• Lesser-known capitals + their notable features.
• UNESCO sites + their designations.
• Bridges, dams, observatories, lighthouses, monuments.
• Ancient ruins + archeological sites.
• Specific geographical superlatives (deepest lake, longest river, etc.).
• Buildings by specific architects.
• Records: tallest, longest, oldest, first, smallest.

Each question is multiple-choice with EXACTLY four options and EXACTLY one correct answer.

Hard rules:
• Output a JSON object matching the schema below exactly. No markdown fence, no commentary.
• Each option label is 1 to 80 characters.
• Each prompt is 1 to 240 characters.
• The correct option must be factually true and verifiable.
• Distractors must be plausible real places — not made-up — but clearly wrong on close inspection.
• No "all of the above" / "none of the above" options.
• Vary question shape: "Which…", "In what country is…", "How tall is…", "What is the only…", "Who designed…".
• EXTREME difficulty. Aim for questions a casual quiz player would miss, but a geography enthusiast might still get half. No cheap-trick questions.
• When the user asks for an exclusion list of already-drafted prompts, do NOT reuse, paraphrase, or substantially overlap any of them. Different places, different facts.

Schema:
{ "questions": [ { "prompt": "string", "options": [ { "label": "string", "isCorrect": boolean }, ... 4 total ... ] } ] }`;

export async function generatePlacesQuestions(args: {
  count?: number;
  // Exclusion list — prompts already drafted for the OTHER bracket
  // final, so this set won't overlap. We pass them as a "do not
  // repeat these" list rather than as inputs to dedupe against.
  excludePrompts?: string[];
}): Promise<PlacesQuestion[]> {
  const count = Math.max(5, Math.min(30, args.count ?? 15));
  const excludes = (args.excludePrompts ?? []).slice(0, 60);

  const excludeBlock =
    excludes.length > 0
      ? `\n\nDO NOT draft any question on the same place or fact as these (already used for the other bracket):\n${excludes.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\nPick entirely different places + different facts.`
      : "";

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
          content:
            `Draft ${count} EXTREME-difficulty famous-places questions per the system instructions.${excludeBlock}\n\nReturn only the JSON object.`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq places generation ${res.status}: ${t.slice(0, 400)}`);
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

function validate(input: unknown, expectedCount: number): PlacesQuestion[] {
  if (!input || typeof input !== "object") {
    throw new Error("generator output: not an object");
  }
  const obj = input as Record<string, unknown>;
  const questions = Array.isArray(obj.questions) ? obj.questions : [];
  if (questions.length === 0) {
    throw new Error("generator output: no questions");
  }
  const out: PlacesQuestion[] = [];
  for (const qRaw of questions) {
    if (!qRaw || typeof qRaw !== "object") continue;
    const q = qRaw as Record<string, unknown>;
    const prompt = typeof q.prompt === "string" ? q.prompt.trim() : "";
    if (!prompt) continue;
    if (prompt.length > 240) continue;
    const optsRaw = Array.isArray(q.options) ? q.options : [];
    const opts: PlacesOption[] = [];
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
