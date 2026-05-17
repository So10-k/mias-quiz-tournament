// Transcribe Mia's recording via Groq's Whisper endpoint to get
// word-level timestamps. The Remotion composition reads the output
// JSON and animates each word as Mia says it.
//
// Output: public/data/finals-intro-words.json
//   {
//     "duration": 15.25,
//     "words": [
//       { "word": "After", "start": 0.12, "end": 0.44 },
//       ...
//     ]
//   }

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

function loadDotenv() {
  for (const f of [".env.local", ".env.production.local"]) {
    const p = resolve(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      const k = t.slice(0, eq).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
loadDotenv();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error("GROQ_API_KEY missing");
  process.exit(1);
}

// Use the mp3-extracted audio (smaller than the 4k mp4) — Groq's
// Whisper endpoint has a 25 MB upload limit and the full
// recording video clocks in around 80 MB.
const INPUT = "/tmp/finalsrec.mp3";
const OUTPUT_DIR = resolve(process.cwd(), "public/data");
const OUTPUT = resolve(OUTPUT_DIR, "finals-intro-words.json");

if (!existsSync(INPUT)) {
  console.error(`Missing input: ${INPUT}`);
  process.exit(1);
}
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

async function main() {
  const fileBuffer = readFileSync(INPUT);
  const form = new FormData();
  form.append(
    "file",
    new Blob([fileBuffer], { type: "audio/mpeg" }),
    "finalsrec.mp3"
  );
  form.append("model", "whisper-large-v3");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("language", "en");

  console.log("→ uploading to Groq Whisper…");
  const res = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: form as any,
    }
  );
  if (!res.ok) {
    console.error(`Groq ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = (await res.json()) as {
    text: string;
    duration: number;
    words: Array<{ word: string; start: number; end: number }>;
  };

  const out = {
    text: data.text,
    duration: data.duration,
    words: data.words.map((w) => ({
      word: w.word,
      start: Number(w.start.toFixed(3)),
      end: Number(w.end.toFixed(3)),
    })),
  };
  writeFileSync(OUTPUT, JSON.stringify(out, null, 2));
  console.log(
    `✓ wrote ${OUTPUT} — ${out.words.length} words, ${out.duration.toFixed(2)}s`
  );
  console.log("\nFull transcript:");
  console.log(`"${out.text}"`);
  console.log("\nFirst 5 words:");
  for (const w of out.words.slice(0, 5))
    console.log(`  ${w.start.toFixed(2)}–${w.end.toFixed(2)}s  "${w.word}"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
