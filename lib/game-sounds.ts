"use client";

// Synthesized gameshow sounds via Web Audio. Zero asset bundle, plays
// instantly. Browsers gate audio behind a user gesture, so the first
// click on the spectator/host page primes the AudioContext via
// `ensureAudio()`. After that everything plays freely.
//
// All voices are short and percussive — tick/ding/buzzer/fanfare/etc —
// nothing that needs a real sample. Quality is "1980s arcade", which is
// the right vibe for this site anyway.

let ctx: AudioContext | null = null;
let enabled = true;

export function ensureAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (on) ensureAudio();
}

export function isSoundEnabled() {
  return enabled;
}

function gate(): AudioContext | null {
  if (!enabled) return null;
  return ensureAudio();
}

// Short percussive tick — used for the last-5-seconds countdown.
export function playTick() {
  const c = gate();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.value = 1200;
  g.gain.setValueAtTime(0.18, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.06);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.07);
}

// Pleasant high tone — correct answer feedback.
export function playDing() {
  const c = gate();
  if (!c) return;
  for (const [freq, delay] of [
    [880, 0],
    [1320, 0.08],
  ] as const) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    const start = c.currentTime + delay;
    g.gain.setValueAtTime(0.0, start);
    g.gain.linearRampToValueAtTime(0.3, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    o.connect(g).connect(c.destination);
    o.start(start);
    o.stop(start + 0.55);
  }
}

// Low harsh sawtooth — wrong answer.
export function playBuzzer() {
  const c = gate();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(180, c.currentTime);
  o.frequency.linearRampToValueAtTime(80, c.currentTime + 0.5);
  g.gain.setValueAtTime(0.25, c.currentTime);
  g.gain.linearRampToValueAtTime(0.0, c.currentTime + 0.6);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.65);
}

// Fast triplet on a snare-ish noise — drumroll.
export function playDrumroll() {
  const c = gate();
  if (!c) return;
  const dur = 1.6;
  const buffer = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buffer.getChannelData(0);
  // Pulsed white noise — slow at first, accelerating.
  const beats = 28;
  for (let b = 0; b < beats; b++) {
    const t = (b / beats) ** 0.6 * dur;
    const sample = Math.floor(t * c.sampleRate);
    const len = Math.floor(0.05 * c.sampleRate);
    for (let i = 0; i < len; i++) {
      const idx = sample + i;
      if (idx >= data.length) break;
      const env = 1 - i / len;
      data[idx] += (Math.random() * 2 - 1) * env * 0.4;
    }
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 600;
  src.connect(filter).connect(c.destination);
  src.start();
}

// Four-note ascending fanfare — round start / fanfare effect.
export function playFanfare() {
  const c = gate();
  if (!c) return;
  // C5 E5 G5 C6
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "square";
    o.frequency.value = freq;
    const start = c.currentTime + i * 0.13;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.18, start + 0.02);
    g.gain.linearRampToValueAtTime(0, start + 0.28);
    o.connect(g).connect(c.destination);
    o.start(start);
    o.stop(start + 0.3);
  });
}

// Highpass-filtered noise burst — applause / champion ceremony.
export function playApplause() {
  const c = gate();
  if (!c) return;
  const dur = 2.5;
  const buffer = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    // Crackle: random amplitude, decays away.
    const env = i < c.sampleRate * 0.3
      ? i / (c.sampleRate * 0.3) // attack
      : Math.exp(-(i - c.sampleRate * 0.3) / (c.sampleRate * 0.8));
    data[i] = (Math.random() * 2 - 1) * env * 0.7;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1500;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 6000;
  const g = c.createGain();
  g.gain.value = 0.4;
  src.connect(hp).connect(lp).connect(g).connect(c.destination);
  src.start();
}

// Whoosh transition — between questions.
export function playWhoosh() {
  const c = gate();
  if (!c) return;
  const dur = 0.4;
  const buffer = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = Math.sin((i / data.length) * Math.PI);
    data[i] = (Math.random() * 2 - 1) * env * 0.4;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(800, c.currentTime);
  filter.frequency.exponentialRampToValueAtTime(2400, c.currentTime + dur);
  filter.Q.value = 4;
  src.connect(filter).connect(c.destination);
  src.start();
}

// Big "BOOM" hit — for the boom effect.
export function playBoom() {
  const c = gate();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(140, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.4);
  g.gain.setValueAtTime(0.6, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.55);
}
