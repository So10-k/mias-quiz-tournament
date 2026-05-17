"use client";

// /finals envelope theatre — drives the page reveal.
//
// Animation: handed off to a frame-perfect Remotion composition
// (remotion/EnvelopeReveal.tsx) playing live in the browser via
// @remotion/player. The Framer-Motion implementation that lived here
// got the geometry wrong (wax seal sandwiched between flap + pocket,
// card hero scale clipping); the Remotion comp lays everything out
// once per frame so timing + z-stacking are deterministic.
//
// State machine — minimal:
//   "poster"   → player armed, "Click to open" button overlay
//   "playing"  → Remotion sequence runs (~5s)
//   "revealed" → EventDetails slides in below
//
// The transition is triggered by the player wrapper at the end of
// its sequence.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { EnvelopeRevealPlayer } from "./EnvelopeRevealPlayer";

const DETAILS_FADE_MS = 800;

export function EnvelopeStage() {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative w-full">
      {/* Theatre — wood-grain table for the closed envelope */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          minHeight: revealed ? 720 : "100vh",
          transition: `min-height ${DETAILS_FADE_MS}ms ease-out`,
          background: revealed
            ? "linear-gradient(180deg, #B7E5FF 0%, #DDEFFF 100%)"
            : `
              radial-gradient(ellipse at center bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 60%),
              repeating-linear-gradient(
                120deg,
                #8B5E3C 0px,
                #8B5E3C 16px,
                #76502F 16px,
                #76502F 18px
              )`,
        }}
      >
        <div
          className="flex items-center justify-center px-4"
          style={{
            minHeight: revealed ? 600 : "100vh",
            paddingTop: revealed ? 40 : 0,
            paddingBottom: revealed ? 40 : 0,
            transition: `min-height ${DETAILS_FADE_MS}ms ease-out, padding ${DETAILS_FADE_MS}ms ease-out`,
          }}
        >
          <div className="w-full max-w-3xl">
            <EnvelopeRevealPlayer onRevealed={() => setRevealed(true)} />
          </div>
        </div>
      </div>

      {/* Details panel — fades in after the reveal sequence finishes. */}
      <AnimatePresence>
        {revealed ? (
          <motion.section
            key="details"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="bg-sky1"
          >
            <EventDetails />
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function EventDetails() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
      <div className="text-center mb-10">
        <p className="font-display text-sm uppercase tracking-[0.28em] text-coral-deep">
          The Grand Final · change of plans
        </p>
        <h1 className="font-display text-4xl md:text-7xl text-navy mt-2 drop-shadow-[4px_4px_0_var(--navy)]">
          Now pre-taped
        </h1>
        <p className="font-display text-2xl md:text-3xl text-navy mt-3">
          📼 Recording soon <span className="text-coral-deep">·</span>{" "}
          watch the video on your own time
        </p>
        <p className="font-body text-base md:text-lg text-navy-soft mt-3 max-w-2xl mx-auto">
          The live Saturday broadcast has been cancelled. Mia and I
          are recording all three rounds and emailing everyone a
          watch-anytime video link instead. Sorry for the late change
          — full apology in your inbox.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-10">
        <FinalistCard
          bracket="Winners' Bracket Final"
          a="Karen"
          b="Marc"
          accentBg="#FFD93D"
          accentText="#1B2A4E"
        />
        <FinalistCard
          bracket="Losers' Bracket Final"
          a="Grandpa"
          b="Sam"
          accentBg="#C9296A"
          accentText="#FFFFFF"
        />
      </div>

      <section className="card px-6 py-8 mt-10 text-center">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-coral-deep">
          Watch the teaser
        </p>
        <h2 className="font-display text-2xl text-navy mt-1 mb-4">
          🎬 20-second hype reel
        </h2>
        <video
          controls
          poster="/images/finals-invite.png"
          className="w-full max-w-2xl mx-auto rounded-2xl border-3 border-navy shadow-pop"
          style={{ background: "#1B2A4E" }}
        >
          <source src="/videos/finals-intro.mp4" type="video/mp4" />
        </video>
      </section>

      <section className="card px-6 py-8 mt-6 bg-sun text-navy">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-coral-deep">
          No registration needed
        </p>
        <h2 className="font-display text-2xl text-navy mt-1">
          📬 You&rsquo;ll get the video by email
        </h2>
        <p className="font-body text-base md:text-lg mt-3">
          Since we&rsquo;re going pre-taped, there&rsquo;s no live
          broadcast to register for. Everyone already on the
          tournament list will be emailed the watch-anytime video link
          when it&rsquo;s ready. Aiming for Sat May 23 — I&rsquo;ll
          send a new ETA if that slips.
        </p>
      </section>

      <section className="card px-6 py-8 mt-6">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-coral-deep">
          What to expect
        </p>
        <h2 className="font-display text-2xl text-navy mt-1 mb-3">
          🏆 Two finals. Four players. One champion.
        </h2>
        <ul className="font-body text-base text-navy leading-relaxed list-disc pl-5 flex flex-col gap-2">
          <li>
            <strong>15-question multiple-choice rounds</strong> — famous-places
            trivia for both bracket finals; the championship is a mystery
            misc round.
          </li>
          <li>
            <strong>On camera:</strong> Sam hosts, all four finalists play
            their rounds against the same questions you would have watched
            live.
          </li>
          <li>
            <strong>Edited together</strong> into one watch-anytime video so
            you can pause, rewind, and yell at your screen on your own time.
          </li>
          <li>
            <strong>Side commentary in the forum chat</strong> —{" "}
            <a
              href="https://discuss.miaswebsites.art/c/tournament-talk"
              className="text-coral-deep underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Tournament Talk
            </a>
          </li>
        </ul>
      </section>

      <div className="text-center mt-10">
        <Link
          href="/standings"
          className="pop pop-coral text-base bob inline-block"
        >
          📊 See the bracket
        </Link>
      </div>
    </div>
  );
}

function Countdown({ targetIso }: { targetIso: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const target = new Date(targetIso).getTime();
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <div className="flex justify-center gap-3 md:gap-5">
      <CountBox label="Days" value={d} />
      <CountBox label="Hours" value={h} />
      <CountBox label="Min" value={m} />
      <CountBox label="Sec" value={s} />
    </div>
  );
}

function CountBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-4 py-3 min-w-[88px] text-center">
      <div className="font-display text-3xl md:text-4xl text-navy">
        {String(value).padStart(2, "0")}
      </div>
      <div className="font-display text-[10px] uppercase tracking-[0.18em] text-coral-deep mt-1">
        {label}
      </div>
    </div>
  );
}

function FinalistCard({
  bracket,
  a,
  b,
  accentBg,
  accentText,
}: {
  bracket: string;
  a: string;
  b: string;
  accentBg: string;
  accentText: string;
}) {
  // White card body for legibility, with a colored stripe + ribbon
  // tying the card to its bracket. Navy text everywhere.
  return (
    <div
      className="card px-0 py-0 overflow-hidden"
      style={{ background: "#FFFFFF", borderColor: "#1B2A4E" }}
    >
      <div
        style={{
          background: accentBg,
          color: accentText,
          padding: "10px 20px",
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
        }}
      >
        {bracket}
      </div>
      <p className="font-display text-3xl md:text-4xl text-navy leading-tight px-5 py-5">
        {a}{" "}
        <span className="italic font-body opacity-70 mx-1 text-xl">vs</span>{" "}
        {b}
      </p>
    </div>
  );
}
