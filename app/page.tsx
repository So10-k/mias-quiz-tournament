import Link from "next/link";
import { Stage } from "@/components/Stage";
import { MeetMiaPlayer } from "@/components/MeetMiaPlayer";
import { CountdownCard } from "@/components/CountdownCard";
import { HypeVideoHero } from "@/components/HypeVideoHero";
import { ThemeSongPlayer } from "@/components/ThemeSongPlayer";
import { AUTHOR_NAME, AUTHOR_AGE, PRIZE } from "@/lib/author";
import { getActiveTournament, getLatestTournament, getCast } from "@/lib/engine";
import { getCountdown } from "@/lib/countdown-settings";
import { getTodayQuestion } from "@/lib/qotd";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const active = await getActiveTournament();
  const latest = active ?? (await getLatestTournament());

  let winnerName: string | null = null;
  if (latest?.status === "complete" && latest.winnerUserId) {
    const [w] = await db
      .select({ name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, latest.winnerUserId))
      .limit(1);
    winnerName = w?.name ?? null;
  }

  let activeRoundNumber: number | null = null;
  if (latest?.status === "in_progress") {
    const [r] = await db
      .select({ n: schema.rounds.chapterNumber })
      .from(schema.rounds)
      .where(
        and(
          eq(schema.rounds.tournamentId, latest.id),
          eq(schema.rounds.status, "active")
        )
      )
      .limit(1);
    if (r) activeRoundNumber = r.n;
  }

  const cast = latest ? await getCast(latest.id) : [];
  const playersIn = cast.filter((c) => !c.enrollment.eliminatedAt).length;
  const countdown = await getCountdown();
  const todayQ = await getTodayQuestion();

  const subtitle = latest?.subtitle ?? "Quizzes! Friends! Adventure!";

  const cta =
    !latest || (latest.status === "registration" && latest.registrationOpen)
      ? { text: "Join the tournament! 🎈", href: "/join", color: "pop-coral" }
      : latest.status === "registration"
      ? { text: "Sign-ups closed", href: null, color: "" }
      : latest.status === "in_progress"
      ? { text: `Play Round ${activeRoundNumber ?? "—"} 🎯`, href: "/play", color: "pop-grass" }
      : { text: "See the standings →", href: "/standings", color: "pop-yellow" };

  const showHypeBanner =
    latest?.status === "in_progress" && playersIn >= 2 && playersIn <= 4;

  return (
    <Stage scrollable>
      <div className="max-w-6xl mx-auto px-4 pt-5 pb-10">
        {/* ── Header strip ──────────────────────────────────────── */}
        <header className="flex flex-col items-center text-center gap-3 mb-5">
          <span className="font-display text-sm md:text-base text-navy bg-sun px-4 py-1 rounded-full border-3 border-navy shadow-pop-sm">
            🏆 HOSTED BY {AUTHOR_NAME.toUpperCase()}, AGE {AUTHOR_AGE}
          </span>
          {countdown.visible ? (
            <CountdownCard
              label={countdown.label}
              targetIso={countdown.targetIso}
            />
          ) : null}
          <h1
            className="font-display text-navy leading-none drop-shadow-[3px_3px_0_var(--navy)]"
            style={{ fontSize: "clamp(40px, 7vw, 80px)", color: "white" }}
          >
            {AUTHOR_NAME}&rsquo;s Quiz Tournament
          </h1>
          <p className="font-display text-lg md:text-2xl text-navy max-w-2xl">
            {subtitle}
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-coral text-white border-3 border-navy rounded-full shadow-pop-sm font-display text-sm md:text-base -rotate-1">
            🏆 The prize: {PRIZE}
          </div>

          {/* ── Finals invitation hero banner ─────────────────────
              Featured for one week leading up to the broadcast. Big
              envelope + countdown that links to /finals where the
              full opening animation lives. */}
          <Link
            href="/finals"
            className="block w-full max-w-3xl mt-3 group"
            style={{ textDecoration: "none" }}
          >
            <div
              className="relative px-5 md:px-7 py-4 md:py-5 border-4 border-navy rounded-2xl shadow-pop overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, #1B2A4E 0%, #2C3E6D 55%, #C9296A 100%)",
              }}
            >
              {/* Floating envelope */}
              <div
                className="absolute -top-3 -right-3 text-5xl md:text-6xl select-none bob"
                aria-hidden
                style={{ filter: "drop-shadow(2px 2px 0 #1B2A4E)" }}
              >
                ✉️
              </div>
              <p className="font-display text-[11px] md:text-xs uppercase tracking-[0.28em] text-sun">
                You&rsquo;re invited
              </p>
              <p className="font-display text-2xl md:text-4xl text-white leading-tight mt-1 drop-shadow-[3px_3px_0_var(--navy)]">
                📼 The Grand Final — now pre-taped
              </p>
              <p className="font-body text-sm md:text-base text-white/85 mt-1">
                Plans changed: instead of a live Saturday broadcast,
                we&rsquo;re recording the finals and sending out the
                video. Tap for the details.
              </p>
              <span className="inline-block mt-2 font-display text-xs uppercase tracking-[0.2em] text-sun group-hover:translate-x-1 transition-transform">
                Open the envelope →
              </span>
            </div>
          </Link>
        </header>

        {/* ── Main grid ─────────────────────────────────────────── */}
        <div className="home-grid">
          {/* Hype video — hero of the page. */}
          <div className="area-video">
            <HypeVideoHero
              videoSrc="/videos/finals-hype.mp4"
              posterSrc="/videos/finals-hype-poster.jpg"
              audioFallbackSrc="/audio/theme.mp3"
            />
          </div>

          {/* Right-column sidebar: hype banner (when applicable),
              the actionable status card, and the QOTD card stacked.
              On mobile this sits below the video; on lg+ it pins to
              the right of the video. */}
          <aside className="area-sidebar flex flex-col gap-3">
            {showHypeBanner ? (
              <div className="hype-banner relative px-4 py-3 text-center overflow-hidden">
                <div
                  className="hype-flames absolute inset-0 pointer-events-none"
                  aria-hidden
                />
                <div className="relative">
                  <p className="font-display text-[10px] uppercase tracking-[0.3em] text-white/95">
                    Recording soon · pre-taped
                  </p>
                  <h2 className="font-display text-2xl md:text-3xl text-white leading-none mt-1 drop-shadow-[2px_2px_0_var(--navy)]">
                    {playersIn === 2
                      ? "🏆 GRAND FINAL"
                      : "🔥 SEMI-FINALS"}
                  </h2>
                  <p className="font-body text-xs text-white mt-1.5">
                    {playersIn === 2
                      ? "Two left. Video coming once we tape it."
                      : `${playersIn} players still standing.`}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="card px-5 py-4">
              {winnerName ? (
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="text-3xl bob">🏆</span>
                  <p className="font-display text-xl md:text-2xl text-navy">
                    Champion:{" "}
                    <span className="text-coral-deep">{winnerName}</span>
                  </p>
                  <p className="font-body text-sm text-navy-soft">
                    Wins: {PRIZE.toLowerCase()}
                  </p>
                </div>
              ) : latest?.status === "in_progress" ? (
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="text-3xl">🎯</span>
                  <p className="font-display text-xl md:text-2xl text-navy">
                    Round {activeRoundNumber ?? "—"} is on!
                  </p>
                  <p className="font-body text-sm text-navy-soft">
                    {playersIn} player{playersIn === 1 ? "" : "s"} still in.
                  </p>
                </div>
              ) : !latest?.registrationOpen &&
                latest?.status === "registration" ? (
                <p className="font-display text-xl md:text-2xl text-navy text-center">
                  Sign-ups closed.
                  <br />
                  <span className="text-coral-deep">First round drops soon!</span>
                </p>
              ) : (
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="text-3xl bob">🎈</span>
                  <p className="font-display text-xl md:text-2xl text-navy">
                    Sign-ups are open!
                  </p>
                </div>
              )}

              {cta.href ? (
                <div className="mt-3 flex justify-center">
                  <Link
                    href={cta.href}
                    className={`pop ${cta.color} text-base md:text-lg px-5 py-2 rounded-xl bob`}
                  >
                    {cta.text}
                  </Link>
                </div>
              ) : null}
            </div>

            {/* QOTD spotlight — slimmer in the sidebar than its
                old full-width form. Hides itself when no question
                is up. */}
            {todayQ ? (
              <Link
                href="/qotd"
                className="qotd-spotlight relative text-left flex flex-col gap-2 px-4 py-4"
                style={{ textDecoration: "none" }}
              >
                <span
                  aria-hidden
                  className="absolute -top-2 -right-2 bob font-display text-[10px] px-2 py-0.5 rounded-full border-2 border-navy bg-coral text-white shadow-pop-sm rotate-6"
                >
                  ✨ NEW
                </span>
                <p className="font-display text-[11px] uppercase tracking-[0.2em] text-coral-deep">
                  💡 Question of the Day
                </p>
                <p className="font-display text-base md:text-lg text-navy leading-snug line-clamp-3">
                  {todayQ.prompt}
                </p>
                <p className="font-body text-[11px] text-navy-soft">
                  Tap to answer →
                </p>
              </Link>
            ) : null}

            {/* Discuss feature card — newly launched forum at
                discuss.miaswebsites.art. External link, opens in a
                new tab. Same picture-book pop styling, sky-blue +
                grass gradient so it doesn't compete with the QOTD's
                yellow spotlight. NEW ribbon to drive first clicks. */}
            <a
              href="https://discuss.miaswebsites.art"
              target="_blank"
              rel="noopener noreferrer"
              className="discuss-feature relative text-left flex flex-col gap-2 px-4 py-4"
              style={{ textDecoration: "none" }}
            >
              <span
                aria-hidden
                className="absolute -top-2 -right-2 bob font-display text-[10px] px-2 py-0.5 rounded-full border-2 border-navy bg-coral text-white shadow-pop-sm rotate-6"
              >
                ✨ NEW
              </span>
              <p className="font-display text-[11px] uppercase tracking-[0.2em] text-coral-deep">
                💬 The Discuss page
              </p>
              <p className="font-display text-base md:text-lg text-navy leading-snug">
                Predictions, recaps, snack reviews. The room next door.
              </p>
              <p className="font-body text-[11px] text-navy-soft">
                Same sign-in. Tap to open →
              </p>
            </a>
          </aside>

          {/* Theme song player below the video, paired horizontally
              with the QOTD card on lg+. */}
          <div className="area-song">
            <ThemeSongPlayer
              src="/audio/theme.mp3"
              title="Quiz Book Theme"
              artist="By Sam · for Mia"
              variant="compact"
            />
          </div>

          {/* Bottom link row spans full grid. */}
          <div className="area-links flex flex-wrap items-center justify-center gap-2">
            {!latest || latest.status === "registration" ? (
              <MeetMiaPlayer src="/videos/mia-intro.mp4" />
            ) : null}
            <Link href="/players" className="pop pop-sky text-sm">
              👥 Players
            </Link>
            <Link href="/standings" className="pop pop-yellow text-sm">
              🏅 Standings
            </Link>
            <Link href="/listen" className="pop pop-coral text-sm">
              🎵 Theme Song
            </Link>
            <Link href="/blog" className="pop pop-white text-sm">
              📝 Blog
            </Link>
          </div>
        </div>

        <style>{`
          /* CSS Grid layout — single column on mobile, 2-col with a
             sticky-feel sidebar on lg+. The 'sidebar' cell spans two
             rows of the right column so it sits next to both the
             video AND the song player without becoming its own row. */
          .home-grid {
            display: grid;
            grid-template-columns: 1fr;
            grid-template-areas:
              "video"
              "sidebar"
              "song"
              "links";
            gap: 0.85rem;
          }
          @media (min-width: 1024px) {
            .home-grid {
              grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
              grid-template-areas:
                "video   sidebar"
                "song    sidebar"
                "links   links";
              gap: 1rem;
            }
          }
          .area-video   { grid-area: video; }
          .area-sidebar { grid-area: sidebar; }
          .area-song    { grid-area: song; }
          .area-links   { grid-area: links; margin-top: 0.5rem; }

          /* Hype banner — slim sidebar variant of the old full-width
             coral→gold gradient card. */
          .hype-banner {
            background: linear-gradient(135deg, #FF6B9D 0%, #FF4D6D 35%, #FF8C42 70%, #FFB627 100%);
            background-size: 220% 220%;
            border: 3px solid var(--navy);
            border-radius: 16px;
            box-shadow: 4px 4px 0 0 var(--navy);
            animation: hype-pan 6s ease-in-out infinite;
          }
          @keyframes hype-pan {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          .hype-flames {
            background:
              radial-gradient(circle at 15% 110%, rgba(255,200,80,0.6), transparent 35%),
              radial-gradient(circle at 85% 110%, rgba(255,107,157,0.55), transparent 35%);
            opacity: 0.8;
          }

          /* Discuss feature card — sibling to QOTD spotlight.
             Sky-blue → grass gradient (so QOTD's yellow stays the
             eye magnet), same pop pattern. */
          .discuss-feature {
            background: linear-gradient(135deg, #B7E5FF 0%, #87CEEB 60%, #7DD87D 100%);
            border: 3px solid var(--navy);
            border-radius: 18px;
            box-shadow: 4px 4px 0 0 var(--navy);
            transition: transform 0.18s ease-out, box-shadow 0.18s ease-out;
          }
          .discuss-feature:hover {
            transform: translate(-2px, -2px);
            box-shadow: 6px 6px 0 0 var(--navy);
          }

          /* QOTD sidebar card — same sun-gradient personality, tighter
             padding to fit the column. */
          .qotd-spotlight {
            background: linear-gradient(135deg, #FFE873 0%, #FFD93D 60%, #FFC100 100%);
            border: 3px solid var(--navy);
            border-radius: 18px;
            box-shadow: 4px 4px 0 0 var(--navy);
            transition: transform 0.18s ease-out, box-shadow 0.18s ease-out;
            animation: qotd-pulse 3.4s ease-in-out infinite;
          }
          .qotd-spotlight:hover {
            transform: translate(-2px, -2px);
            box-shadow: 6px 6px 0 0 var(--navy);
            animation: none;
          }
          @keyframes qotd-pulse {
            0%, 100% { box-shadow: 4px 4px 0 0 var(--navy); }
            50% { box-shadow: 7px 7px 0 0 var(--navy); }
          }
        `}</style>
      </div>
    </Stage>
  );
}
