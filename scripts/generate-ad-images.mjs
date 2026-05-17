#!/usr/bin/env node
// Generate hero images for each parody ad.
//
// Backend is chosen by IMAGE_BACKEND env var (or auto-detected from
// which API key is present in .env.local). Options:
//
//   • replicate-flux-dev  — Replicate Flux Dev (no top-up minimum; ~$0.025/image)
//   • replicate-flux-pro  — Replicate Flux 1.1 Pro (no minimum; ~$0.04/image)
//   • fal-flux-dev      — fal.ai Flux Dev (~$0.025/image, $10 minimum top-up)
//   • fal-flux-schnell  — fal.ai Flux Schnell (~$0.003/image)
//   • fal-flux-pro      — fal.ai Flux 1.1 Pro (~$0.04/image)
//   • openai-dalle3     — DALL-E 3 (~$0.04/image)
//   • openai-gpt-image  — gpt-image-1 medium (~$0.07/image)
//   • bfl-flux-pro      — black forest labs direct (~$0.06/image)
//   • pollinations      — FREE no-auth, Flux Schnell, lowest quality
//
// Usage:
//   IMAGE_BACKEND=fal-flux-dev node scripts/generate-ad-images.mjs
//   node scripts/generate-ad-images.mjs --force AdBracketInsurance

import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "images", "ads");

function loadEnv() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const BACKEND = (process.env.IMAGE_BACKEND || autoDetectBackend()).toLowerCase();
function autoDetectBackend() {
  if (process.env.REPLICATE_API_TOKEN) return "replicate-flux-dev";
  if (process.env.FAL_KEY) return "fal-flux-dev";
  if (process.env.OPENAI_API_KEY) return "openai-dalle3";
  if (process.env.BFL_API_KEY) return "bfl-flux-pro";
  return "pollinations";
}

console.log(`Using backend: ${BACKEND}`);

// ─── Prompts ────────────────────────────────────────────────────────

const ADS = [
  {
    id: "AdBracketInsurance",
    prompt:
      "Vintage 1970s insurance commercial illustration, children's picture book style. A friendly cartoon clipboard mascot holding a striped umbrella over a paper tournament bracket. Warm cream + sun-yellow + navy palette. Thick navy outlines, gouache paint texture, hand-drawn feel. Studio Ghibli meets editorial illustration. Highly detailed, polished. No text or letters anywhere.",
  },
  {
    id: "AdTriviaPillow",
    prompt:
      "Cozy bedroom scene in editorial illustration style. A plush pastel pink question-mark-shaped throw pillow on a tiny bed at golden-hour, tiny stars floating above. Soft pink + cream + navy palette, thick navy outlines, gouache texture, picture book composition, highly polished. No text or letters.",
  },
  {
    id: "AdHotTakeHotline",
    prompt:
      "Retro 1980s commercial illustration, picture-book paint style. A vintage red rotary telephone receiver wrapped in cartoon flames on a deep magenta backdrop, sun-yellow lightning bolts radiating. Bold navy outlines, dramatic lighting, polished editorial illustration. No text or numbers.",
  },
  {
    id: "AdStrikeCream",
    prompt:
      "Cheerful product mascot illustration, picture book style. A glowing green tube of healing ointment with a polka-dot bandage wrapped around the middle, surrounded by little sparkles and stars. Sun-yellow + grass-green + navy palette, thick navy outlines, gouache texture, highly polished editorial style. No text.",
  },
  {
    id: "AdMiasSchool",
    prompt:
      "Whimsical children's picture book illustration. A tiny graduation cap floats above an open storybook glowing softly. A friendly sun mascot with a face peeks in from the corner. Warm yellow + coral + navy palette, thick navy outlines, hand-painted gouache texture, polished Studio Ghibli vibe. No text or letters on the book.",
  },
  {
    id: "AdBracketMate",
    prompt:
      "Retro friendly robot mascot in picture book illustration style. A chunky teal robot with big round eyes holding a clipboard with squiggly doodles. Pastel teal body, soft navy + cream background, thick outlines, gouache texture, polished editorial illustration. No text.",
  },
  {
    id: "AdQuizVitamins",
    prompt:
      "Picture book product illustration. An oversized translucent orange gummy bear with a glowing lightbulb visible inside its tummy, surrounded by sparkles. Warm orange + magenta gradient backdrop, thick navy outlines, gouache texture, polished editorial style. No text or letters.",
  },
  {
    id: "AdBuzzerApp",
    prompt:
      "Game-show illustration in picture-book style. A giant red buzzer dome glowing with sun-yellow lightning bolts, a cartoon finger poised just above it. Bright navy + sun-yellow palette, thick outlines, hand-painted texture, dramatic shadows. Editorial illustration quality. No text or numbers.",
  },
  {
    id: "AdDiscourseCat",
    prompt:
      "Children's picture book illustration. A haughty cream-and-orange tabby cat sitting on the keyboard of an open laptop, looking at the camera disapprovingly. Warm cream + amber + navy palette, thick navy outlines, gouache texture, polished editorial illustration. No text on the screen.",
  },
  {
    id: "AdRewriteHistory",
    prompt:
      "Whimsical illustration of a giant pink pencil with a chunky eraser end smudging out circles on a sheet of paper. Sky-blue background, picture book gouache paint texture, thick navy outlines, soft pastel palette, polished editorial style. No text on the paper.",
  },
  {
    id: "AdWrongAnswerInsurance",
    prompt:
      "Picture book illustration of a friendly cartoon shield mascot with a question mark on it, deflecting a falling red X. Grass-green + sun-yellow palette, thick navy outlines, sparkles in the air, dramatic poster pose, editorial illustration quality. No text.",
  },
  {
    id: "AdInternalMonologue",
    prompt:
      "Cozy children's picture book illustration. A floating thought bubble containing a swirling tangle of yarn-like thoughts above a softly-lit reading chair. Warm cream + navy palette, thick navy outlines, lamplight glow, gouache texture, polished editorial style. No text inside the bubble.",
  },
  {
    id: "AdSamMiaAftershow",
    prompt:
      "Theater stage children's picture book illustration. Two cartoon microphones standing center-stage with deep red curtains framing the scene, confetti raining down, a tiny friendly sun mascot peeking in. Sun-yellow + coral + navy palette, thick navy outlines, hand-painted gouache texture, polished editorial style. No text.",
  },
];

const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyIds = args.filter((a) => !a.startsWith("--"));
const filter = onlyIds.length > 0 ? new Set(onlyIds) : null;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ─── Backend implementations ────────────────────────────────────────

// Rate-limit defense: backoff + retry on 429. Each attempt waits the
// number of seconds the server asks for (Replicate sends `retry_after`).
async function generateWithRetry(adId, prompt, maxAttempts = 6) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await generate(adId, prompt);
    } catch (err) {
      lastErr = err;
      const msg = String(err.message || err);
      const m = /retry_after"?:\s*(\d+)/.exec(msg);
      const wait = m ? Math.max(2, parseInt(m[1], 10) + 1) : null;
      if (!msg.includes("429") || attempt === maxAttempts) throw err;
      console.log(`   … rate-limited, waiting ${wait ?? 12}s (attempt ${attempt}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, (wait ?? 12) * 1000));
    }
  }
  throw lastErr;
}

async function generate(adId, prompt) {
  switch (BACKEND) {
    case "replicate-flux-dev":
      return await replicateGenerate("black-forest-labs/flux-dev", prompt);
    case "replicate-flux-pro":
      return await replicateGenerate("black-forest-labs/flux-1.1-pro", prompt);
    case "fal-flux-dev":
      return await falGenerate("fal-ai/flux/dev", prompt);
    case "fal-flux-schnell":
      return await falGenerate("fal-ai/flux/schnell", prompt);
    case "fal-flux-pro":
      return await falGenerate("fal-ai/flux-pro/v1.1", prompt);
    case "openai-dalle3":
      return await openaiGenerate("dall-e-3", prompt, "hd");
    case "openai-gpt-image":
      return await openaiGenerate("gpt-image-1", prompt, "medium");
    case "bfl-flux-pro":
      return await bflGenerate(prompt);
    case "pollinations":
      return await pollinationsGenerate(adId, prompt);
    default:
      throw new Error(`unknown backend: ${BACKEND}`);
  }
}

async function replicateGenerate(modelPath, prompt) {
  const key = process.env.REPLICATE_API_TOKEN;
  if (!key)
    throw new Error(
      "REPLICATE_API_TOKEN not set — get one at https://replicate.com/account/api-tokens"
    );
  // Replicate's `Prefer: wait` header makes the prediction endpoint
  // block until the result is ready, so we don't have to poll.
  const res = await fetch(
    `https://api.replicate.com/v1/models/${modelPath}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: "16:9",
          output_format: "png",
          output_quality: 95,
          num_inference_steps: 28,
          guidance: 3.5,
          safety_tolerance: 2,
        },
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`replicate HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  // `output` may be a string URL, an array of URLs, or sometimes a base64
  // data URL. Handle all three.
  const out = Array.isArray(j?.output) ? j.output[0] : j?.output;
  if (typeof out === "string") {
    if (out.startsWith("data:")) {
      const comma = out.indexOf(",");
      return Buffer.from(out.slice(comma + 1), "base64");
    }
    const imgRes = await fetch(out);
    if (!imgRes.ok) throw new Error(`replicate image fetch HTTP ${imgRes.status}`);
    return Buffer.from(await imgRes.arrayBuffer());
  }
  throw new Error(`replicate: unexpected output ${JSON.stringify(j).slice(0, 300)}`);
}

async function falGenerate(modelPath, prompt) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not set — get one at https://fal.ai/dashboard/keys");
  const res = await fetch(`https://fal.run/${modelPath}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: "landscape_16_9",
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`fal HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  const url = j?.images?.[0]?.url;
  if (!url) throw new Error(`fal: no image URL in ${JSON.stringify(j).slice(0, 300)}`);
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`fal image fetch HTTP ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}

async function openaiGenerate(model, prompt, quality) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const body =
    model === "dall-e-3"
      ? { model, prompt, size: "1792x1024", quality, n: 1, response_format: "b64_json" }
      : { model, prompt, size: "1536x1024", quality, n: 1 };
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`openai HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (b64) return Buffer.from(b64, "base64");
  const url = j?.data?.[0]?.url;
  if (url) {
    const imgRes = await fetch(url);
    return Buffer.from(await imgRes.arrayBuffer());
  }
  throw new Error(`openai: no image in ${JSON.stringify(j).slice(0, 300)}`);
}

async function bflGenerate(prompt) {
  const key = process.env.BFL_API_KEY;
  if (!key) throw new Error("BFL_API_KEY not set");
  // BFL is async — submit then poll.
  const submit = await fetch("https://api.bfl.ai/v1/flux-pro-1.1", {
    method: "POST",
    headers: { "x-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      width: 1920,
      height: 1080,
      output_format: "png",
      safety_tolerance: 2,
    }),
  });
  if (!submit.ok) {
    const t = await submit.text().catch(() => "");
    throw new Error(`bfl submit HTTP ${submit.status}: ${t.slice(0, 300)}`);
  }
  const { id, polling_url } = await submit.json();
  if (!id) throw new Error(`bfl: missing id`);
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(polling_url ?? `https://api.bfl.ai/v1/get_result?id=${id}`, {
      headers: { "x-key": key },
    });
    const pj = await poll.json();
    if (pj?.status === "Ready") {
      const url = pj?.result?.sample;
      if (!url) throw new Error("bfl: ready but no sample url");
      const imgRes = await fetch(url);
      return Buffer.from(await imgRes.arrayBuffer());
    }
    if (pj?.status === "Error") throw new Error(`bfl error: ${JSON.stringify(pj)}`);
  }
  throw new Error("bfl: timed out polling");
}

async function pollinationsGenerate(adId, prompt) {
  const seed = hash(adId);
  const encoded = encodeURIComponent(prompt);
  const url =
    `https://image.pollinations.ai/prompt/${encoded}` +
    `?width=1920&height=1080&nologo=true&model=flux&seed=${seed}&safe=true`;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`pollinations HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 8 * 1024) {
    throw new Error(`pollinations: too small (${buf.length} bytes)`);
  }
  return buf;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── Run ────────────────────────────────────────────────────────────

let ok = 0;
let failed = 0;
let firstRequest = true;
// Replicate free-tier rate limit is 6/min. Pace ourselves at 11s
// between requests so we never hit it. Cheap, predictable.
const INTER_REQUEST_DELAY_MS =
  BACKEND.startsWith("replicate-") && !process.env.REPLICATE_PAID ? 11000 : 0;
for (const ad of ADS) {
  if (filter && !filter.has(ad.id)) continue;
  const outPath = join(OUT_DIR, `${ad.id}.png`);
  if (existsSync(outPath) && !force) {
    console.log(`= Skipping ${ad.id} (exists, pass --force to overwrite)`);
    ok++;
    continue;
  }
  if (!firstRequest && INTER_REQUEST_DELAY_MS > 0) {
    await new Promise((r) => setTimeout(r, INTER_REQUEST_DELAY_MS));
  }
  firstRequest = false;
  console.log(`▶ Generating ${ad.id}…`);
  try {
    const buf = await generateWithRetry(ad.id, ad.prompt);
    writeFileSync(outPath, buf);
    console.log(`✓ Saved ${outPath} (${(buf.length / 1024).toFixed(0)} KB)`);
    ok++;
  } catch (err) {
    console.error(`✗ ${ad.id}: ${err.message}`);
    failed++;
  }
}

console.log(`\nDone — ${ok} ok, ${failed} failed.`);
if (failed > 0) process.exit(1);
