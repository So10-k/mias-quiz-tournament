"use client";

// Client renderer for /watch.
//
// Polling discipline (these are the things that made the page jitter
// when /watch was first built):
//   • One poll in flight at a time. New polls are skipped, not
//     aborted — aborting mid-flight + immediately restarting causes
//     "ResponseAborted" log spam and occasional rendered-stale frames.
//   • Polling pauses when the tab is hidden. Comes back on visibility
//     change.
//   • Snapshots are deduped via a cheap content hash before setState
//     — identical snapshots no longer cascade re-renders into the
//     Remotion Player.
//   • The question timer ticks LOCALLY at 100ms (smooth) and only
//     resyncs from the server poll. Previously it stepped 1s/poll,
//     giving the "stuttery countdown" look.
//   • Scene transitions get a CSS fade so a host switching scenes
//     doesn't cause a layout-shifting hard cut.

import { useEffect, useMemo, useRef, useState } from "react";
import type { WatchScene as Scene } from "@/lib/watch-scene";
import type {
  BracketRound,
  Matchup,
} from "@/lib/bracket";
import type { LiveRoundView } from "@/lib/live";
import { LiveSlide } from "./LiveSlide";

type BracketUser = { id: string; name: string | null; email: string | null };

type Snapshot = {
  ok: boolean;
  scene: Scene;
  live: LiveRoundView | null;
  mainBracket: BracketRound[];
  losersBracket: BracketRound[];
  bracketUsers: BracketUser[];
  ts: number;
};

const POLL_MS = 1500;

// Cheap structural hash for dedup. Stringify only the fields that the
// renderer actually consumes — bracket arrays + scene + live state.
// Stable property ordering doesn't matter for our schema; JSON.stringify
// is deterministic enough for change detection.
function hashSnap(s: Snapshot): string {
  const live = s.live;
  return JSON.stringify({
    scene: s.scene,
    live: live
      ? {
          rid: live.roundId,
          ls: live.liveStatus,
          ci: live.currentQuestionIndex,
          // We DON'T include secondsLeft here — that would force a
          // re-render every poll even when nothing else changed.
          // The local countdown handles smoothness.
          q: live.currentQuestion?.id ?? null,
          locked: live.locked,
          fin: live.finalists.map((f) => [f.userId, f.currentPickOptionId, f.scoreSoFar]),
          opt: live.currentQuestion?.options.map((o) => [o.id, o.isCorrect ?? null]),
        }
      : null,
    bk: s.mainBracket.map((r) => r.matchups.map((m) => [m.id, m.winnerUserId])),
    lb: s.losersBracket.map((r) => r.matchups.map((m) => [m.id, m.winnerUserId])),
    bu: s.bracketUsers.map((u) => [u.id, u.name]),
  });
}

export function WatchScene({ initial }: { initial: Snapshot }) {
  const [snap, setSnap] = useState<Snapshot>(initial);
  const lastHash = useRef<string>(hashSnap(initial));
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (inFlight.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      inFlight.current = true;
      try {
        const r = await fetch("/api/watch/snapshot", { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as Snapshot;
        if (cancelled || !data.ok) return;
        const h = hashSnap(data);
        if (h === lastHash.current) {
          // BUT — refresh secondsLeft on the snap object since the
          // hash deliberately excluded it. The local timer pulls from
          // server snap when the question rolls over.
          setSnap((prev) => ({ ...prev, live: data.live, ts: data.ts }));
          return;
        }
        lastHash.current = h;
        setSnap(data);
      } catch {
        /* swallow — next tick retries */
      } finally {
        inFlight.current = false;
      }
    }
    const id = setInterval(tick, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const { scene, live } = snap;
  const usersById = useMemo(
    () => new Map(snap.bracketUsers.map((u) => [u.id, u])),
    [snap.bracketUsers]
  );

  return (
    <div
      className="relative w-full"
      style={{
        height: "100vh",
        background:
          "linear-gradient(180deg, #B7E5FF 0%, #DDEFFF 50%, #FFFAE0 100%)",
        overflow: "hidden",
      }}
    >
      {/* Force the page to fit one viewport (TV broadcast / b-roll
          cutaway). No scrolling — every scene must size itself to
          the available area. The top banner + Intercom launcher are
          hidden globally by HideOnWatch in app/layout.tsx. */}
      <style>{`
        html, body { overflow: hidden !important; height: 100vh; }
      `}</style>

      {/* Primary scene */}
      <div
        // Re-key on the active scene kind so React unmounts the
        // previous subtree and remounts the next one — that lets
        // the fade-in animation re-fire on every host scene switch,
        // and avoids stale state hanging around between scene kinds.
        key={`scene-${scene.primary}-${scene.slideId ?? ""}`}
        className="relative z-10 px-10 pt-8 pb-8 h-full flex flex-col mia-scene-fade"
      >
        {renderPrimary({ scene, live, snap, usersById })}
        <style>{`
          @keyframes mia-scene-fade {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .mia-scene-fade { animation: mia-scene-fade 360ms ease-out both; }
          @media (prefers-reduced-motion: reduce) {
            .mia-scene-fade { animation: none; }
          }
        `}</style>
      </div>

      {/* Lower-third finalist strip */}
      {scene.showLowerThird && live && live.finalists.length > 0 ? (
        <LowerThird live={live} />
      ) : null}

      {/* Question overlay (small, lower-left, for cutaway scenes) */}
      {scene.showQuestionOverlay && scene.primary !== "question" && live ? (
        <QuestionOverlay live={live} />
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Primary-scene dispatch
// ────────────────────────────────────────────────────────────────────

function renderPrimary({
  scene,
  live,
  snap,
  usersById,
}: {
  scene: Scene;
  live: LiveRoundView | null;
  snap: Snapshot;
  usersById: Map<string, BracketUser>;
}) {
  switch (scene.primary) {
    case "question":
      return live ? (
        <QuestionScene live={live} />
      ) : (
        <Placeholder
          emoji="⏳"
          title="No live question yet"
          body="The host hasn't started a round."
        />
      );
    case "players":
      return live ? (
        <PlayersScene live={live} />
      ) : (
        <Placeholder
          emoji="👥"
          title="No live players yet"
          body="The host hasn't started a round."
        />
      );
    case "bracket-main":
      return (
        <BracketScene
          title="Winners' Bracket"
          rounds={snap.mainBracket}
          usersById={usersById}
        />
      );
    case "bracket-losers":
      return (
        <BracketScene
          title="Losers' Bracket"
          rounds={snap.losersBracket}
          usersById={usersById}
        />
      );
    case "both-brackets":
      return (
        <div className="grid md:grid-cols-2 gap-8 flex-1">
          <BracketScene
            title="Winners"
            rounds={snap.mainBracket}
            usersById={usersById}
            compact
          />
          <BracketScene
            title="Losers"
            rounds={snap.losersBracket}
            usersById={usersById}
            compact
          />
        </div>
      );
    case "video":
      return <VideoScene url={scene.videoUrl} />;
    case "image":
      return <ImageScene url={scene.imageUrl} />;
    case "slide":
      return (
        <LiveSlide
          slideId={scene.slideId}
          bannerOverride={scene.bannerText}
          bodyOverride={scene.bodyText}
        />
      );
    case "text":
      return <TextScene scene={scene} />;
    case "intermission":
    default:
      return <IntermissionScene />;
  }
}

// ────────────────────────────────────────────────────────────────────
// Question scene — the headliner. Big prompt, big options, timer, and
// per-finalist "answered" lights. NEVER reveals the correct answer
// before the host locks the question (we trust the API to omit
// isCorrect until the reveal moment).
// ────────────────────────────────────────────────────────────────────

function QuestionScene({ live }: { live: LiveRoundView }) {
  const q = live.currentQuestion;
  // Local-tick countdown — resyncs from server `live.secondsLeft`
  // whenever the question changes or the lock toggles. Between
  // resyncs it ticks every 100ms so the timer feels smooth instead
  // of stepping in 1s jumps with each poll.
  const [localSeconds, setLocalSeconds] = useState<number>(live.secondsLeft);
  const lastSyncKey = useRef<string>(
    `${q?.id ?? "none"}-${live.locked}-${live.secondsLeft}`
  );
  useEffect(() => {
    const key = `${q?.id ?? "none"}-${live.locked}-${live.secondsLeft}`;
    // Resync the local timer whenever the question id flips, the
    // lock state flips, OR the server reports a value that diverges
    // by more than 1 second (drift correction).
    const drift = Math.abs(localSeconds - live.secondsLeft);
    if (key !== lastSyncKey.current || drift > 1) {
      lastSyncKey.current = key;
      setLocalSeconds(live.secondsLeft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id, live.locked, live.secondsLeft]);
  useEffect(() => {
    if (live.locked) return;
    if (localSeconds <= 0) return;
    const id = setInterval(() => {
      setLocalSeconds((s) => Math.max(0, s - 0.1));
    }, 100);
    return () => clearInterval(id);
  }, [live.locked, localSeconds <= 0]);

  if (!q) {
    return (
      <Placeholder
        emoji="🎙️"
        title="Get ready…"
        body={`Round: ${live.title}`}
      />
    );
  }
  const idx = (live.currentQuestionIndex ?? 0) + 1;
  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <p
          style={{
            fontFamily: "Fredoka, sans-serif",
            fontWeight: 700,
            color: "#C9296A",
            fontSize: 22,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          Question {idx} of {live.totalQuestions}
        </p>
        <TimerPill
          secondsLeft={Math.ceil(localSeconds)}
          locked={live.locked}
        />
      </div>
      <div
        className="px-10 py-8 rounded-3xl border-4"
        style={{
          background: "#FFFFFF",
          borderColor: "#1B2A4E",
          boxShadow: "12px 12px 0 #1B2A4E",
        }}
      >
        <p
          style={{
            fontFamily: "Fredoka, sans-serif",
            fontWeight: 700,
            color: "#1B2A4E",
            fontSize: 60,
            lineHeight: 1.15,
          }}
        >
          {q.prompt}
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-5 mt-2">
        {q.options.map((o, i) => (
          <OptionTile
            key={o.id}
            letter={String.fromCharCode(65 + i)}
            label={o.label}
            revealed={live.locked && o.isCorrect != null}
            isCorrect={o.isCorrect === true}
          />
        ))}
      </div>
      <PicksRow live={live} />
    </div>
  );
}

function OptionTile({
  letter,
  label,
  revealed,
  isCorrect,
}: {
  letter: string;
  label: string;
  revealed: boolean;
  isCorrect: boolean;
}) {
  // Pre-reveal: all options white. Post-reveal: correct = green +
  // sparkles, wrong = grey + struck-through.
  const correctStyle = revealed && isCorrect;
  const wrongStyle = revealed && !isCorrect;
  return (
    <div
      className="rounded-2xl border-4 px-6 py-5 flex items-center gap-4"
      style={{
        borderColor: "#1B2A4E",
        background: correctStyle
          ? "#5BCE7A"
          : wrongStyle
            ? "#E6E0CC"
            : "#FFFFFF",
        color: correctStyle ? "#FFFFFF" : "#1B2A4E",
        boxShadow: correctStyle
          ? "0 0 0 6px #FFD93D, 8px 8px 0 #1B2A4E"
          : "8px 8px 0 #1B2A4E",
        opacity: wrongStyle ? 0.55 : 1,
        transition: "background 0.4s ease, opacity 0.4s ease",
      }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          background: correctStyle ? "#FFD93D" : "#1B2A4E",
          color: correctStyle ? "#1B2A4E" : "#FFD93D",
          borderRadius: 14,
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: 30,
        }}
      >
        {letter}
      </span>
      <span
        style={{
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: 32,
          lineHeight: 1.15,
          textDecoration: wrongStyle ? "line-through" : "none",
        }}
      >
        {label}
      </span>
      {correctStyle ? (
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "Fredoka, sans-serif",
            fontWeight: 700,
            fontSize: 26,
          }}
        >
          ✓ correct
        </span>
      ) : null}
    </div>
  );
}

function PicksRow({ live }: { live: LiveRoundView }) {
  if (live.finalists.length === 0) return null;
  return (
    <div
      className="px-6 py-3 rounded-2xl border-3 flex items-center gap-6 flex-wrap"
      style={{
        background: "#FFFFFF",
        borderColor: "#1B2A4E",
        boxShadow: "6px 6px 0 #FFD93D",
      }}
    >
      <span
        style={{
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          color: "#C9296A",
          fontSize: 14,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        Picks
      </span>
      {live.finalists.map((f) => {
        const answered = !!f.currentPickOptionId;
        return (
          <span
            key={f.userId}
            className="inline-flex items-center gap-2"
            style={{
              fontFamily: "Fredoka, sans-serif",
              fontWeight: 700,
              fontSize: 24,
              color: "#1B2A4E",
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                background: answered ? "#5BCE7A" : "#E0D8C3",
                borderRadius: "50%",
                border: "2px solid #1B2A4E",
              }}
            />
            {f.name ?? "Player"}
            {answered ? (
              <span style={{ fontSize: 18, color: "#5BCE7A" }}>locked in</span>
            ) : (
              <span style={{ fontSize: 18, color: "#999" }}>thinking…</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function TimerPill({
  secondsLeft,
  locked,
}: {
  secondsLeft: number;
  locked: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-3 px-6 py-3 rounded-full border-4"
      style={{
        borderColor: "#1B2A4E",
        background: locked ? "#1B2A4E" : "#FFD93D",
        color: locked ? "#FFD93D" : "#1B2A4E",
        fontFamily: "Fredoka, sans-serif",
        fontWeight: 700,
        fontSize: 32,
        boxShadow: "6px 6px 0 #1B2A4E",
      }}
    >
      {locked ? "🔒 LOCKED" : `⏱ ${secondsLeft}s`}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────
// Players scene — big finalist cards with running score + status.
// ────────────────────────────────────────────────────────────────────

function PlayersScene({ live }: { live: LiveRoundView }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <h2
        style={{
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: 56,
          color: "#1B2A4E",
          textShadow: "4px 4px 0 #FFD93D",
        }}
      >
        🏆 {live.title}
      </h2>
      <div className="grid md:grid-cols-2 gap-8 w-full max-w-5xl">
        {live.finalists.map((f) => (
          <div
            key={f.userId}
            className="px-8 py-8 rounded-3xl border-4 text-center"
            style={{
              background: "#FFFFFF",
              borderColor: "#1B2A4E",
              boxShadow: "10px 10px 0 #1B2A4E",
            }}
          >
            <p
              style={{
                fontFamily: "Fredoka, sans-serif",
                fontWeight: 700,
                color: "#C9296A",
                fontSize: 22,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Finalist
            </p>
            <p
              style={{
                fontFamily: "Fredoka, sans-serif",
                fontWeight: 700,
                fontSize: 64,
                color: "#1B2A4E",
                lineHeight: 1.1,
                marginTop: 8,
              }}
            >
              {f.name ?? "Player"}
            </p>
            <div
              className="mt-5 px-5 py-3 inline-block rounded-2xl border-3"
              style={{
                background: "#FFD93D",
                borderColor: "#1B2A4E",
              }}
            >
              <span
                style={{
                  fontFamily: "Fredoka, sans-serif",
                  fontWeight: 700,
                  fontSize: 28,
                  color: "#1B2A4E",
                }}
              >
                Score: {f.scoreSoFar ?? 0}
              </span>
            </div>
            <p
              style={{
                marginTop: 16,
                fontFamily: "Fredoka, sans-serif",
                fontWeight: 700,
                fontSize: 20,
                color: f.currentPickOptionId ? "#5BCE7A" : "#C9296A",
              }}
            >
              {f.currentPickOptionId ? "✓ Answered" : "⏳ Thinking…"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Bracket scene — list-style display, broadcast-friendly. (We don't
// reuse <BracketView> because that component is tuned for the host
// editor; here we want big legible cards.)
// ────────────────────────────────────────────────────────────────────

function BracketScene({
  title,
  rounds,
  usersById,
  compact = false,
}: {
  title: string;
  rounds: BracketRound[];
  usersById: Map<string, BracketUser>;
  compact?: boolean;
}) {
  const cardPad = compact ? "px-3 py-2" : "px-5 py-3";
  const nameSize = compact ? 22 : 30;
  return (
    <div className="flex-1 flex flex-col gap-4">
      <h2
        style={{
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: compact ? 40 : 56,
          color: "#1B2A4E",
          textShadow: "4px 4px 0 #FFD93D",
        }}
      >
        {title}
      </h2>
      <div className={`grid gap-4 ${compact ? "" : "md:grid-cols-2"}`}>
        {rounds.map((r) => (
          <div key={r.roundIndex} className="flex flex-col gap-2">
            <p
              style={{
                fontFamily: "Fredoka, sans-serif",
                fontWeight: 700,
                color: "#C9296A",
                fontSize: 16,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Round {r.roundIndex}
            </p>
            {r.matchups.map((m) => (
              <MatchupCard
                key={m.id}
                m={m}
                usersById={usersById}
                pad={cardPad}
                nameSize={nameSize}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchupCard({
  m,
  usersById,
  pad,
  nameSize,
}: {
  m: Matchup;
  usersById: Map<string, BracketUser>;
  pad: string;
  nameSize: number;
}) {
  const a = m.playerAUserId ? usersById.get(m.playerAUserId) : null;
  const b = m.playerBUserId ? usersById.get(m.playerBUserId) : null;
  const winA = !!m.winnerUserId && m.winnerUserId === m.playerAUserId;
  const winB = !!m.winnerUserId && m.winnerUserId === m.playerBUserId;
  return (
    <div
      className={`${pad} rounded-2xl border-3 flex flex-col gap-1`}
      style={{
        background: "#FFFFFF",
        borderColor: "#1B2A4E",
        boxShadow: "4px 4px 0 #1B2A4E",
      }}
    >
      <PlayerRow
        name={a?.name ?? a?.email ?? null}
        winner={winA}
        loser={!!m.winnerUserId && !winA}
        nameSize={nameSize}
      />
      <PlayerRow
        name={b?.name ?? b?.email ?? null}
        winner={winB}
        loser={!!m.winnerUserId && !winB}
        nameSize={nameSize}
      />
    </div>
  );
}

function PlayerRow({
  name,
  winner,
  loser,
  nameSize,
}: {
  name: string | null;
  winner: boolean;
  loser: boolean;
  nameSize: number;
}) {
  return (
    <div
      className="flex items-center gap-2"
      style={{
        fontFamily: "Fredoka, sans-serif",
        fontWeight: 700,
        fontSize: nameSize,
        lineHeight: 1.1,
        color: winner ? "#1B2A4E" : loser ? "#999" : "#1B2A4E",
        opacity: loser ? 0.65 : 1,
        textDecoration: loser ? "line-through" : "none",
      }}
    >
      {winner ? "🏆 " : ""}
      {name ?? "—"}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Video / image / text scenes
// ────────────────────────────────────────────────────────────────────

function VideoScene({ url }: { url: string }) {
  if (!url) {
    return (
      <Placeholder
        emoji="🎬"
        title="No video selected"
        body="Pick a video in /host/finals-control → Scene Director."
      />
    );
  }
  return (
    <div className="flex-1 flex items-center justify-center">
      <video
        key={url}
        src={url}
        controls
        autoPlay
        playsInline
        className="rounded-3xl border-4 max-h-[80vh]"
        style={{
          borderColor: "#1B2A4E",
          boxShadow: "12px 12px 0 #1B2A4E",
          background: "#1B2A4E",
        }}
      />
    </div>
  );
}

function ImageScene({ url }: { url: string }) {
  if (!url) {
    return (
      <Placeholder
        emoji="🖼️"
        title="No image selected"
        body="Pick an image in /host/finals-control → Scene Director."
      />
    );
  }
  return (
    <div className="flex-1 flex items-center justify-center">
      <img
        src={url}
        alt=""
        className="rounded-3xl border-4 max-h-[80vh]"
        style={{
          borderColor: "#1B2A4E",
          boxShadow: "12px 12px 0 #1B2A4E",
          background: "#1B2A4E",
        }}
      />
    </div>
  );
}

function TextScene({ scene }: { scene: Scene }) {
  const headline = scene.bannerText || "Mia's Quiz Tournament";
  const body =
    scene.bodyText ||
    "The host hasn't pasted body text yet.";
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 max-w-5xl mx-auto">
      <h1
        style={{
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: 96,
          color: "#1B2A4E",
          textShadow: "6px 6px 0 #FFD93D",
          lineHeight: 1.05,
        }}
      >
        {headline}
      </h1>
      <p
        style={{
          fontFamily: "Quicksand, sans-serif",
          fontWeight: 500,
          fontSize: 36,
          color: "#1B2A4E",
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
        }}
      >
        {body}
      </p>
    </div>
  );
}

function IntermissionScene() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
      <div className="text-[12rem] leading-none bob inline-block">🌞</div>
      <h1
        style={{
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: 96,
          color: "#1B2A4E",
          textShadow: "6px 6px 0 #FFD93D",
        }}
      >
        Be right back!
      </h1>
      <p
        style={{
          fontFamily: "Quicksand, sans-serif",
          fontWeight: 500,
          fontSize: 36,
          color: "#1B2A4E",
        }}
      >
        Mia&rsquo;s Quiz Tournament · Live Finals
      </p>
    </div>
  );
}

function Placeholder({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
      <div className="text-[10rem] leading-none">{emoji}</div>
      <h2
        style={{
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: 64,
          color: "#1B2A4E",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: "Quicksand, sans-serif",
          fontSize: 28,
          color: "#1B2A4E",
        }}
      >
        {body}
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Persistent overlays — finalist lower-third + small question card
// ────────────────────────────────────────────────────────────────────

function LowerThird({ live }: { live: LiveRoundView }) {
  return (
    <div
      className="absolute left-0 right-0 bottom-0 z-20 px-8 py-3 flex items-center gap-8"
      style={{
        background: "rgba(27,42,78,0.92)",
        borderTop: "4px solid #FFD93D",
      }}
    >
      <span
        style={{
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: 16,
          color: "#FFD93D",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        {live.title}
      </span>
      <div className="flex items-center gap-8 ml-auto">
        {live.finalists.map((f) => (
          <span
            key={f.userId}
            style={{
              fontFamily: "Fredoka, sans-serif",
              fontWeight: 700,
              fontSize: 22,
              color: "#FFFFFF",
            }}
          >
            {f.name ?? "Player"}{" "}
            <span style={{ color: "#FFD93D" }}>{f.scoreSoFar ?? 0}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function QuestionOverlay({ live }: { live: LiveRoundView }) {
  const q = live.currentQuestion;
  if (!q) return null;
  return (
    <div
      className="absolute left-6 bottom-20 z-20 px-5 py-4 rounded-2xl border-3 max-w-[40vw]"
      style={{
        background: "rgba(255,255,255,0.96)",
        borderColor: "#1B2A4E",
        boxShadow: "6px 6px 0 #1B2A4E",
      }}
    >
      <p
        style={{
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: 13,
          color: "#C9296A",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        Q{(live.currentQuestionIndex ?? 0) + 1} · {live.locked ? "🔒" : `⏱ ${live.secondsLeft}s`}
      </p>
      <p
        style={{
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: 22,
          color: "#1B2A4E",
          marginTop: 4,
          lineHeight: 1.2,
        }}
      >
        {q.prompt}
      </p>
    </div>
  );
}
