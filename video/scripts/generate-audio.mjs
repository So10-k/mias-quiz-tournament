// Synthesize the music + SFX bank as 16-bit PCM WAV files.
//
// Music: chord progression I–V–vi–IV in C major, 5s per chord, 20s loop,
// 6 loops = 120s. Soft sine pad with subtle bell shimmer on alt beats.
// SFX: 7 short cues (pop, ding, swoosh, tick, alarm, success, thud) — all
// synthesised so the bundle has zero binary deps.
//
// All files are written into ../public/{music,sfx/...}.wav.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "..", "public");
const SFX_DIR = resolve(OUT_DIR, "sfx");
mkdirSync(SFX_DIR, { recursive: true });

const SR = 44100;

function writeWav(path, samples, sampleRate = SR) {
  const numSamples = samples.length;
  const blockAlign = 2; // mono, 16-bit
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buf = Buffer.alloc(44 + dataSize);
  let p = 0;
  buf.write("RIFF", p); p += 4;
  buf.writeUInt32LE(36 + dataSize, p); p += 4;
  buf.write("WAVE", p); p += 4;
  buf.write("fmt ", p); p += 4;
  buf.writeUInt32LE(16, p); p += 4; // PCM chunk size
  buf.writeUInt16LE(1, p); p += 2; // PCM format
  buf.writeUInt16LE(1, p); p += 2; // mono
  buf.writeUInt32LE(sampleRate, p); p += 4;
  buf.writeUInt32LE(byteRate, p); p += 4;
  buf.writeUInt16LE(blockAlign, p); p += 2;
  buf.writeUInt16LE(16, p); p += 2;
  buf.write("data", p); p += 4;
  buf.writeUInt32LE(dataSize, p); p += 4;
  for (let i = 0; i < numSamples; i++) {
    let s = samples[i];
    if (s > 1) s = 1;
    if (s < -1) s = -1;
    buf.writeInt16LE(Math.round(s * 32767), p);
    p += 2;
  }
  writeFileSync(path, buf);
  console.log(`  wrote ${path} (${(dataSize / 1024).toFixed(1)} KB, ${(numSamples / sampleRate).toFixed(2)}s)`);
}

// ─── helpers ────────────────────────────────────────────────────────────
const sin = (t, f) => Math.sin(2 * Math.PI * f * t);
const noise = () => Math.random() * 2 - 1;

// ADSR envelope, durations in seconds.
function adsr(tInPhase, dur, attack, decay, sustain, release) {
  if (tInPhase < attack) return tInPhase / attack;
  if (tInPhase < attack + decay) {
    const x = (tInPhase - attack) / decay;
    return 1 - x * (1 - sustain);
  }
  const sustainEnd = dur - release;
  if (tInPhase < sustainEnd) return sustain;
  if (tInPhase < dur) return sustain * (1 - (tInPhase - sustainEnd) / release);
  return 0;
}

// One-pole low-pass for taking the harshness off saws/noise.
function lpfStream(samples, cutoff) {
  const dt = 1 / SR;
  const rc = 1 / (2 * Math.PI * cutoff);
  const a = dt / (rc + dt);
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    prev = prev + a * (samples[i] - prev);
    samples[i] = prev;
  }
  return samples;
}

// ─── MUSIC ─────────────────────────────────────────────────────────────
function generateMusic() {
  const dur = 120;
  const N = Math.floor(SR * dur);
  const out = new Float32Array(N);

  // C major: I (C E G), V (G B D), vi (A C E), IV (F A C). Octaves chosen
  // so the bass hovers around C3 and the top doesn't get tinny.
  const chords = [
    { bass: 130.81, mid: [261.63, 329.63, 392.00] }, // C
    { bass: 98.00, mid: [196.00, 246.94, 293.66] },  // G
    { bass: 110.00, mid: [220.00, 261.63, 329.63] }, // Am
    { bass: 87.31, mid: [174.61, 220.00, 261.63] },  // F
  ];
  const chordDur = 5; // seconds
  const loopDur = chordDur * chords.length; // 20

  // Pentatonic top-line that lands on the off-beats — gives the pad some
  // narrative motion without competing with imagined narration.
  const melody = [
    { t: 1.5, f: 523.25, dur: 1.0 }, // C5
    { t: 3.0, f: 659.25, dur: 1.0 }, // E5
    { t: 7.0, f: 587.33, dur: 1.2 }, // D5
    { t: 11.5, f: 440.00, dur: 1.2 }, // A4
    { t: 16.0, f: 523.25, dur: 1.5 }, // C5
  ];

  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const inLoop = t % loopDur;
    const chordIdx = Math.floor(inLoop / chordDur);
    const ch = chords[chordIdx];
    const tInChord = inLoop - chordIdx * chordDur;

    // Per-chord soft swell envelope (slow attack, slow release into the
    // crossfade with the next chord).
    const env =
      Math.min(1, tInChord / 0.6) *
      Math.min(1, (chordDur - tInChord) / 0.9);

    // Pad: triad sines + 2nd harmonic for warmth. Detune slightly per voice
    // so the layer feels chorused.
    let s = 0;
    for (let v = 0; v < ch.mid.length; v++) {
      const f = ch.mid[v];
      const detune = 1 + (v - 1) * 0.0015;
      s += sin(t, f * detune) * 0.13;
      s += sin(t, f * 2 * detune) * 0.025;
    }
    // Bass — sine + sub for body.
    s += sin(t, ch.bass) * 0.12;
    s += sin(t, ch.bass * 0.5) * 0.05;

    s *= env;

    // Bell shimmer on beats 2 and 4 of every chord.
    for (const beat of [2, 4]) {
      const beatT = beat - 0.5; // mid-beat
      const phase = tInChord - beatT;
      if (phase >= 0 && phase < 0.6) {
        const bellEnv = Math.exp(-phase * 6);
        const bellF = chordIdx % 2 === 0 ? 1046.5 : 1318.5; // C6 / E6
        s += Math.sin(2 * Math.PI * bellF * t) * 0.04 * bellEnv;
        s += Math.sin(2 * Math.PI * bellF * 2 * t) * 0.012 * bellEnv;
      }
    }

    // Pentatonic melody line — uses absolute time-in-loop.
    for (const note of melody) {
      const phase = inLoop - note.t;
      if (phase >= 0 && phase < note.dur) {
        const e = adsr(phase, note.dur, 0.05, 0.2, 0.6, 0.6);
        s += Math.sin(2 * Math.PI * note.f * t) * 0.06 * e;
        s += Math.sin(2 * Math.PI * note.f * 2 * t) * 0.015 * e;
      }
    }

    // Master gain + soft saturation
    s *= 0.85;
    s = Math.tanh(s);
    out[i] = s;
  }

  // Whole-track fade-in (1.5s) and fade-out (3.5s) so the start/end of the
  // mp4 don't pop.
  const fadeIn = Math.floor(1.5 * SR);
  const fadeOut = Math.floor(3.5 * SR);
  for (let i = 0; i < fadeIn; i++) out[i] *= i / fadeIn;
  for (let i = 0; i < fadeOut; i++) {
    const idx = N - 1 - i;
    out[idx] *= i / fadeOut;
  }

  writeWav(resolve(OUT_DIR, "music.wav"), out);
}

// ─── SFX ───────────────────────────────────────────────────────────────
function tone(dur, fn) {
  const N = Math.floor(SR * dur);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = fn(i / SR, i, N);
  return out;
}

function sfxPop() {
  const dur = 0.12;
  return tone(dur, (t) => {
    const f = 700 + 600 * Math.exp(-t * 30);
    const env = Math.exp(-t * 22);
    return Math.sin(2 * Math.PI * f * t) * env * 0.7;
  });
}

function sfxDing() {
  const dur = 0.6;
  return tone(dur, (t) => {
    const env = Math.exp(-t * 4.5);
    let s = 0;
    s += Math.sin(2 * Math.PI * 880 * t) * env * 0.45;
    s += Math.sin(2 * Math.PI * 1320 * t) * env * 0.25;
    s += Math.sin(2 * Math.PI * 1760 * t) * env * 0.12;
    return s;
  });
}

function sfxSwoosh() {
  const dur = 0.42;
  const out = tone(dur, (t, _i, N) => {
    const env = Math.sin((Math.PI * t) / dur);
    return noise() * env * 0.35;
  });
  return lpfStream(out, 1800);
}

function sfxTick() {
  const dur = 0.05;
  return tone(dur, (t) => {
    const env = Math.exp(-t * 80);
    return (noise() * 0.3 + Math.sin(2 * Math.PI * 1800 * t) * 0.5) * env;
  });
}

function sfxAlarm() {
  // Two short urgent beeps with a small gap.
  const dur = 0.7;
  return tone(dur, (t) => {
    const beat1 = t < 0.18 ? Math.sin(2 * Math.PI * 720 * t) * Math.exp(-t * 6) : 0;
    const t2 = t - 0.28;
    const beat2 = t2 > 0 && t2 < 0.18 ? Math.sin(2 * Math.PI * 720 * t2) * Math.exp(-t2 * 6) : 0;
    return (beat1 + beat2) * 0.55;
  });
}

function sfxSuccess() {
  // Ascending C-major arpeggio with bell envelopes.
  const notes = [
    { t: 0.0, f: 523.25 }, // C5
    { t: 0.12, f: 659.25 }, // E5
    { t: 0.24, f: 783.99 }, // G5
    { t: 0.4, f: 1046.5 }, // C6
  ];
  const dur = 1.0;
  return tone(dur, (t) => {
    let s = 0;
    for (const n of notes) {
      const ph = t - n.t;
      if (ph >= 0 && ph < 0.6) {
        const env = Math.exp(-ph * 5);
        s += Math.sin(2 * Math.PI * n.f * (t)) * env * 0.35;
        s += Math.sin(2 * Math.PI * n.f * 2 * (t)) * env * 0.1;
      }
    }
    return s;
  });
}

function sfxThud() {
  const dur = 0.45;
  const out = tone(dur, (t) => {
    const env = Math.exp(-t * 9);
    return (Math.sin(2 * Math.PI * 70 * t) + Math.sin(2 * Math.PI * 110 * t) * 0.6) * env * 0.7;
  });
  return lpfStream(out, 400);
}

const SFX = {
  pop: sfxPop,
  ding: sfxDing,
  swoosh: sfxSwoosh,
  tick: sfxTick,
  alarm: sfxAlarm,
  success: sfxSuccess,
  thud: sfxThud,
};

console.log("Generating music…");
generateMusic();

console.log("Generating SFX…");
for (const [name, fn] of Object.entries(SFX)) {
  writeWav(resolve(SFX_DIR, `${name}.wav`), fn());
}

console.log("Done.");
