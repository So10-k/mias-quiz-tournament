"use client";

// Self-contained teleprompter + recorder. All client-side: no
// server roundtrip, no SSR. Webcam preview shows above the
// scrolling script so Mia can fix her framing before recording.

import { useEffect, useRef, useState } from "react";

type ScriptPhrase = { text: string; emphasis: boolean; time: number };

export function TeleprompterStudio({
  script,
  totalDurationSeconds,
}: {
  script: ScriptPhrase[];
  totalDurationSeconds: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const phraseRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const [hasPerm, setHasPerm] = useState<
    "unknown" | "granted" | "denied" | "skipped"
  >("unknown");
  const [permErr, setPermErr] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<
    "idle" | "countdown" | "recording" | "scrolling" | "stopped"
  >("idle");
  const [countdown, setCountdown] = useState(3);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  // 0.7..1.3 — multiplier on time. 1.0 = exact music sync; below 1
  // = give Mia more time per phrase; above 1 = make her sprint.
  const [tempo, setTempo] = useState<number>(1.0);
  const [fontSize, setFontSize] = useState<number>(56);
  const [mirror, setMirror] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // ── Get camera + mic ────────────────────────────────────────
  async function requestPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setHasPerm("granted");
      setPermErr(null);
    } catch (e) {
      setHasPerm("denied");
      setPermErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Time-aligned scroll loop ────────────────────────────────
  // Each phrase has a `time` (seconds) at which it should be
  // centered in the spotlight band. We measure each phrase's
  // y-position once, then on every frame compute scroll-top by
  // interpolating between the two phrases that bracket the current
  // elapsed time. Result: scroll continuously and the line in the
  // bright band is always the one Mia should be reading right now.
  function startScroll() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    startTimeRef.current = performance.now();

    // Measure phrase centers RELATIVE TO the scroll container's
    // content. offsetTop alone isn't enough because some phrases
    // have padding; use bounding rect math relative to scrollTop=0.
    const refs = phraseRefs.current.filter((r): r is HTMLParagraphElement => !!r);
    const containerTop = el.getBoundingClientRect().top + el.scrollTop;
    const centers = refs.map((p) => {
      const r = p.getBoundingClientRect();
      const centerInContent = r.top - containerTop + r.height / 2 + el.scrollTop;
      return centerInContent;
    });
    const viewportCenter = el.clientHeight / 2;

    const tick = (now: number) => {
      const start = startTimeRef.current ?? now;
      const t = ((now - start) / 1000) * tempo;
      setElapsed(t);

      // Find the bracketing phrases [i, i+1] for the current time.
      let i = 0;
      while (
        i < script.length - 1 &&
        t >= script[i + 1].time
      ) {
        i++;
      }
      setActiveIndex(i);

      // Interpolate between phrase[i] and phrase[i+1] centers based
      // on the local progress through the [time_i, time_{i+1}]
      // window. If we're past the last phrase, ease the scroll to
      // the post-script position so the END card flows up too.
      let centerY: number;
      const next = script[i + 1];
      if (next) {
        const span = next.time - script[i].time;
        const local = span > 0 ? Math.max(0, Math.min(1, (t - script[i].time) / span)) : 0;
        const a = centers[i] ?? 0;
        const b = centers[i + 1] ?? a;
        centerY = a + (b - a) * local;
      } else {
        // After the last phrase, drift downward at a steady pace
        // until the whole script has cleared the spotlight.
        const overflow = (t - script[i].time);
        const driftPerSec = (el.scrollHeight - (centers[i] ?? 0)) /
          Math.max(0.1, totalDurationSeconds - script[i].time);
        centerY = (centers[i] ?? 0) + overflow * driftPerSec;
      }

      el.scrollTop = Math.max(0, centerY - viewportCenter);

      // Stop when we've fully drifted past the last line.
      if (t < totalDurationSeconds + 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }

  function stopScroll() {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
  }

  // ── Recording lifecycle ─────────────────────────────────────
  async function beginRecording() {
    if (!streamRef.current) {
      await requestPermission();
      if (!streamRef.current) return;
    }
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    setRecordingState("countdown");
    for (let n = 3; n >= 1; n--) {
      setCountdown(n);
      await new Promise((r) => setTimeout(r, 1000));
    }

    chunksRef.current = [];
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      videoBitsPerSecond: 4_000_000,
      audioBitsPerSecond: 192_000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setRecordingState("stopped");
      stopScroll();
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecordingState("recording");
    startScroll();
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    stopScroll();
  }

  function reset() {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    setRecordingState("idle");
    setElapsed(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  // No-recording mode: useful when recording on a separate device
  // (phone) and just need the scrolling text on this screen.
  async function beginScrollOnly() {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
    setRecordingState("countdown");
    for (let n = 3; n >= 1; n--) {
      setCountdown(n);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setRecordingState("scrolling");
    startScroll();
  }
  function stopScrollOnly() {
    stopScroll();
    setRecordingState("idle");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Permission gate */}
      {hasPerm === "unknown" ? (
        <div className="card px-5 py-6 text-center">
          <p className="font-display text-lg text-navy">
            How are you recording?
          </p>
          <p className="font-body text-sm text-navy-soft mt-2 max-w-md mx-auto">
            Recording on this same computer? Enable the webcam. Recording on a
            phone or separate camera? Skip the webcam — you&rsquo;ll just use
            the scrolling text.
          </p>
          <div className="mt-4 flex gap-3 justify-center flex-wrap">
            <button
              onClick={requestPermission}
              className="pop pop-coral text-base inline-block"
            >
              🎥 Enable webcam (record here)
            </button>
            <button
              onClick={() => setHasPerm("skipped")}
              className="pop pop-navy text-base inline-block"
            >
              📱 Skip — recording on phone
            </button>
          </div>
        </div>
      ) : null}
      {hasPerm === "denied" ? (
        <div className="card px-5 py-6 bg-coral-soft text-white">
          <p className="font-display text-lg">⚠️ Camera blocked</p>
          <p className="font-body text-sm mt-2">{permErr}</p>
          <p className="font-body text-sm mt-2">
            Click the 🔒 in your address bar → Site settings → set Camera +
            Microphone to "Allow", then refresh.
          </p>
        </div>
      ) : null}

      {/* Live preview + script */}
      {hasPerm === "granted" || hasPerm === "skipped" ? (
        <div
          className={
            hasPerm === "skipped"
              ? "grid lg:grid-cols-[280px_1fr] gap-4 items-start"
              : "grid lg:grid-cols-[480px_1fr] gap-4 items-start"
          }
        >
          {/* Camera preview (or phone-mode placeholder) + controls */}
          <div className="card p-3 flex flex-col gap-3 sticky top-4 self-start">
            {hasPerm === "granted" ? (
              <div className="rounded-xl overflow-hidden border-3 border-navy bg-navy">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full aspect-video"
                  style={{
                    transform: mirror ? "scaleX(-1)" : "none",
                    background: "#1B2A4E",
                  }}
                />
              </div>
            ) : (
              <div className="rounded-xl border-3 border-navy bg-navy text-white p-4 text-center">
                <div className="text-4xl mb-1">📱</div>
                <p className="font-display text-sm">
                  Recording on phone
                </p>
                <p className="font-body text-xs text-white/70 mt-1">
                  Webcam disabled. Hit{" "}
                  <strong>Start scroll only</strong> below when you&rsquo;re
                  ready to read.
                </p>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {recordingState === "recording" ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm text-coral-deep">
                    ● REC · {Math.round(elapsed)}s
                  </span>
                  <button
                    onClick={stopRecording}
                    className="pop pop-navy text-sm"
                  >
                    ⏹ Stop recording
                  </button>
                </div>
              ) : recordingState === "scrolling" ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm text-coral-deep">
                    📜 SCROLLING · {Math.round(elapsed)}s
                  </span>
                  <button
                    onClick={stopScrollOnly}
                    className="pop pop-navy text-sm"
                  >
                    ⏹ Stop scroll
                  </button>
                </div>
              ) : recordingState === "countdown" ? (
                <span className="font-display text-5xl text-coral-deep w-full text-center py-2">
                  {countdown}
                </span>
              ) : recordingState === "stopped" ? (
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={downloadUrl ?? "#"}
                    download={`finals-intro-${Date.now()}.webm`}
                    className="pop pop-coral text-sm"
                  >
                    💾 Download
                  </a>
                  <button onClick={reset} className="pop pop-navy text-sm">
                    🔁 Re-record
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={beginScrollOnly}
                    className="pop pop-coral text-base w-full"
                  >
                    📜 Start scroll {hasPerm === "skipped" ? "(3-2-1)" : "only (recording on phone)"}
                  </button>
                  {hasPerm === "granted" ? (
                    <button
                      onClick={beginRecording}
                      className="pop pop-navy text-sm w-full"
                    >
                      🔴 Or record here too (webcam + mic)
                    </button>
                  ) : null}
                </>
              )}
            </div>

            {/* Settings */}
            <div className="border-t-2 border-dashed border-navy/30 pt-3 flex flex-col gap-3 text-sm font-body">
              <label className="flex items-center justify-between gap-3">
                <span className="font-display text-xs uppercase tracking-[0.1em]">
                  Tempo {(tempo * 100).toFixed(0)}%
                </span>
                <input
                  type="range"
                  min={0.7}
                  max={1.3}
                  step={0.05}
                  value={tempo}
                  onChange={(e) => setTempo(parseFloat(e.target.value))}
                  className="flex-1"
                  disabled={
                    recordingState === "recording" ||
                    recordingState === "countdown" ||
                    recordingState === "scrolling"
                  }
                />
              </label>
              <p className="font-body text-[10px] text-navy-soft -mt-1">
                100% = exact music sync. Slide left if Mia needs more time per phrase, right if she sprints.
              </p>
              <label className="flex items-center justify-between gap-3">
                <span className="font-display text-xs uppercase tracking-[0.1em]">Font size</span>
                <input
                  type="range"
                  min={32}
                  max={96}
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  className="flex-1"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="font-display text-xs uppercase tracking-[0.1em]">Mirror</span>
                <input
                  type="checkbox"
                  checked={mirror}
                  onChange={(e) => setMirror(e.target.checked)}
                />
              </label>
            </div>
          </div>

          {/* Scrolling script — wrapped in a relative container so
              the spotlight overlay can sit fixed-on-top regardless of
              scroll position. Top + bottom darken (still legible),
              center band stays bright on the line you're saying NOW.
              The middle has a subtle yellow halo to guide the eye. */}
          <div className="card p-0 overflow-hidden relative bg-cloud">
            <div
              ref={scrollRef}
              className="h-[60vh] md:h-[72vh] overflow-y-scroll px-6 md:px-12 py-12 text-navy"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: 1.4,
                fontFamily: "Fredoka, sans-serif",
                fontWeight: 600,
                transform: mirror ? "scaleX(-1)" : "none",
                scrollBehavior: "auto",
                background: "#FFFFFF",
              }}
            >
              <div style={{ height: "40vh" }} />
              {script.map((w, i) => (
                <p
                  key={i}
                  ref={(el) => {
                    phraseRefs.current[i] = el;
                  }}
                  className={
                    w.emphasis
                      ? "text-coral-deep font-display"
                      : "text-navy font-display"
                  }
                  style={{
                    textAlign: "center",
                    fontWeight: w.emphasis ? 700 : 600,
                    letterSpacing: w.emphasis ? "0.04em" : "normal",
                    margin: "0.6em 0",
                    // Highlight the active phrase with a gentle scale
                    // bump so it pops a bit more inside the spotlight.
                    transform:
                      activeIndex === i &&
                      (recordingState === "recording" ||
                        recordingState === "scrolling")
                        ? "scale(1.04)"
                        : "scale(1)",
                    transition: "transform 220ms ease-out",
                  }}
                >
                  {w.text}
                </p>
              ))}
              <div className="text-center font-body text-base text-navy-soft mt-12">
                — END —
              </div>
              <div style={{ height: "70vh" }} />
            </div>

            {/* Spotlight overlay — vertical fade. Eye's drawn to the
                middle band where the current line sits; upcoming +
                already-said lines fade dimmer but stay legible. */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(
                  to bottom,
                  rgba(15, 22, 45, 0.92) 0%,
                  rgba(15, 22, 45, 0.78) 12%,
                  rgba(15, 22, 45, 0.40) 28%,
                  rgba(15, 22, 45, 0.00) 45%,
                  rgba(15, 22, 45, 0.00) 55%,
                  rgba(15, 22, 45, 0.40) 72%,
                  rgba(15, 22, 45, 0.78) 88%,
                  rgba(15, 22, 45, 0.92) 100%
                )`,
              }}
            />
            {/* Subtle warm halo behind the active band */}
            <div
              className="absolute inset-x-0 pointer-events-none"
              style={{
                top: "44%",
                bottom: "44%",
                background:
                  "radial-gradient(ellipse at center, rgba(255,217,61,0.18) 0%, rgba(255,217,61,0.00) 70%)",
              }}
            />
            {/* Centerline tick marks at the edges so the host can
                eyeball the "speak this now" zone */}
            <div
              className="absolute left-0 pointer-events-none"
              style={{
                top: "50%",
                width: 16,
                height: 4,
                background: "#E94B7E",
                borderRadius: 2,
                transform: "translateY(-50%)",
              }}
            />
            <div
              className="absolute right-0 pointer-events-none"
              style={{
                top: "50%",
                width: 16,
                height: 4,
                background: "#E94B7E",
                borderRadius: 2,
                transform: "translateY(-50%)",
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function pickMimeType(): string {
  // Prefer VP9 in webm — better quality for Remotion to ingest.
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return "video/webm";
}
