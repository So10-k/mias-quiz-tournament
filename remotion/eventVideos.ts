// Manifest of every "show" video — 8 round/transition slides + 12
// parody ads. Each entry is a Remotion composition id, its props,
// and the public filename it would render to if exported.
//
// Pre-taped season: ads are turned OFF. The full list is kept below
// (and re-exported as PARODY_ADS) so we can flip them back on later
// by changing the EVENT_VIDEOS filter. For now, EVENT_VIDEOS only
// surfaces the slides — Scene Director won't show ads in its picker
// and the runbook won't auto-cue them.
//
// Visuals: every ad references an AI-generated PNG under
// /public/images/ads/<id>.png (Replicate Flux Dev, via
// scripts/generate-ad-images.mjs). The ParodyAd component composes
// the image with one of three layouts (classic / split / infomercial).

// IMPORTANT: keep this file free of any non-type imports from
// remotion/EventSlide.tsx, remotion/ParodyAd.tsx, or the "remotion"
// package itself. The host control panel (an RSC) imports
// EVENT_VIDEOS to populate the slide-picker dropdown; pulling in the
// Remotion runtime crashes the server bundle with "Remotion requires
// React.createContext". Inline the timing constants below instead.
import type { EventSlideProps } from "./EventSlide";
import type { ParodyAdProps } from "./ParodyAd";

const EVENT_SLIDE_FPS = 30;
const EVENT_SLIDE_DURATION_FRAMES = EVENT_SLIDE_FPS * 12; // 12s (broadcast pacing)
const PARODY_AD_FPS = 30;
const PARODY_AD_DURATION_FRAMES = PARODY_AD_FPS * 20; // 20s

export type SlideEntry = {
  kind: "slide";
  id: string;
  outputName: string;
  durationInFrames: number;
  fps: number;
  props: EventSlideProps;
};

export type AdEntry = {
  kind: "ad";
  id: string;
  outputName: string;
  durationInFrames: number;
  fps: number;
  props: ParodyAdProps;
};

export type EventVideoEntry = SlideEntry | AdEntry;

const slide = (
  id: string,
  outputName: string,
  props: EventSlideProps
): SlideEntry => ({
  kind: "slide",
  id,
  outputName,
  durationInFrames: EVENT_SLIDE_DURATION_FRAMES,
  fps: EVENT_SLIDE_FPS,
  props,
});

// Every ad gets an imageUrl pointing at the generated PNG + an
// artworkId fallback (used if the PNG is missing).
const ad = (
  id: string,
  outputName: string,
  props: Omit<ParodyAdProps, "artworkId" | "imageUrl">
): AdEntry => ({
  kind: "ad",
  id,
  outputName,
  durationInFrames: PARODY_AD_DURATION_FRAMES,
  fps: PARODY_AD_FPS,
  props: {
    ...props,
    artworkId: id,
    imageUrl: `/images/ads/${id}.png`,
  },
});

const ALL_EVENT_VIDEOS: EventVideoEntry[] = [
  // ─── 8 round / transition slides ─────────────────────────────────
  // 1 — Cold open / show open. Sets the brand + the night.
  slide("EventWelcomeIntro", "event-welcome-intro.mp4", {
    chapter: "📺 SHOW OPEN",
    kicker: "The Grand Final",
    title: "Mia's Quiz Tournament",
    subtitle: "Eight weeks · eleven players · one champion",
    emoji: "🌞",
    accent: "#E94B7E",
    bg: "#FFD93D",
    bg2: "#FF8C42",
    lowerThird: "Tonight — we crown a champion.",
  }),
  // 2 — Recap + bracket reveal beat.
  slide("EventTournamentRecap", "event-tournament-recap.mp4", {
    chapter: "🪜 THE ROAD SO FAR",
    kicker: "Recap",
    title: "How we got here",
    subtitle: "From eleven players to four finalists.",
    emoji: "🪜",
    accent: "#1B2A4E",
    bg: "#B7E5FF",
    bg2: "#87CEEB",
    bullets: [
      "11 players · 1 first-week bye",
      "Three eliminations, one comeback",
      "Four finalists left tonight",
    ],
    lowerThird: "Up next · the losers' bracket final.",
  }),
  // 3 — Losers' Bracket Final intro.
  slide("IntroLosersFinal", "intro-losers-final.mp4", {
    chapter: "🥈 ROUND 1 · LOSERS' BRACKET FINAL",
    kicker: "First match of the night",
    title: "The Losers' Bracket Final",
    subtitle: "Fifteen questions · thirty seconds each · winner advances.",
    emoji: "🥈",
    accent: "#C9296A",
    bg: "#FFE8EE",
    bg2: "#FF9EBA",
    matchup: { left: "Grandpa", right: "Sam" },
    lowerThird: "Winner advances to the championship.",
  }),
  // 4 — Winners' Bracket Final intro.
  slide("IntroWinnersFinal", "intro-winners-final.mp4", {
    chapter: "🏆 ROUND 2 · WINNERS' BRACKET FINAL",
    kicker: "Second match of the night",
    title: "The Winners' Bracket Final",
    subtitle: "Fifteen questions · thirty seconds each · winner advances.",
    emoji: "🏆",
    accent: "#1B2A4E",
    bg: "#FFD93D",
    bg2: "#FFB347",
    matchup: { left: "Karen", right: "Marc" },
    lowerThird: "Winner advances to the championship.",
  }),
  // 5 — Championship tease.
  slide("ChampionshipTease", "championship-tease.mp4", {
    chapter: "👑 THE CHAMPIONSHIP",
    kicker: "Final match of the night",
    title: "Two finals. One crown.",
    subtitle:
      "Winners' bracket champion · vs · losers' bracket champion.",
    emoji: "👑",
    accent: "#FFD93D",
    bg: "#1B2A4E",
    bg2: "#3B4A7E",
    bullets: ["First to 5 of 8 wins", "Sudden death if tied"],
    lowerThird: "The Mia's Quiz Tournament Season 1 champion.",
  }),
  // 6 — Champion ceremony. {Champion} gets swapped at render time by
  // the runbook stage that sets the text scene.
  slide("ChampionCeremony", "champion-ceremony.mp4", {
    chapter: "👑 SEASON 1 CHAMPION",
    kicker: "The champion is…",
    title: "{Champion}",
    subtitle: "Mia's Quiz Tournament · Season 1 winner",
    emoji: "🏆",
    accent: "#1B2A4E",
    bg: "#FFE873",
    bg2: "#FF8C42",
    lowerThird: "Trophy ceremony.",
  }),
  // 7 — "Hot takes" forum interlude. Optional b-roll; kept for future
  // use, no longer auto-cued in the pre-taped runbook.
  slide("HotTakesInterlude", "hot-takes-interlude.mp4", {
    chapter: "🔥 FROM THE FORUM",
    kicker: "Hot takes",
    title: "What the Discourse said",
    subtitle: "Pulled from Tournament Talk this week.",
    emoji: "🔥",
    accent: "#FFD93D",
    bg: "#1B2A4E",
    bg2: "#3B4A7E",
    bullets: [
      "“Karen's peaking too early — Marc by 2.”",
      "“Grandpa is the dark horse. Calling it.”",
      "“Sam doesn't read the questions, just vibes.”",
    ],
  }),
  // 8 — Closing credits / outro.
  slide("EventOutro", "event-outro.mp4", {
    chapter: "🌞 CLOSING CREDITS",
    kicker: "Thanks for watching",
    title: "See you next season",
    subtitle: "Forum stays open · standings at quiz.miaswebsites.art",
    emoji: "🌞",
    accent: "#E94B7E",
    bg: "#B7E5FF",
    bg2: "#DDEFFF",
    lowerThird: "Mia's Quiz Tournament · Season 1 · Fin.",
  }),

  // ─── 12 parody ads ────────────────────────────────────────────────
  // Layouts spread roughly: 4 classic, 4 split, 4 infomercial — so
  // back-to-back ads in the runbook never share their layout.
  ad("AdBracketInsurance", "ad-bracket-insurance.mp4", {
    preroll: "Brought to you by",
    brand: "Bracket Insurance",
    emoji: "📋",
    tagline:
      "Did your bracket pick get bounced in round one? Sleep through round two — Bracket Insurance has you covered.",
    testimonial:
      "I picked Grandpa to win it all. He won it all. I'm still suing because the journey hurt me emotionally.",
    testimonialAuthor: "A satisfied customer",
    finePrint:
      "BRACKET INSURANCE, INC. IS A FAKE COMPANY. NOT A REAL COMPANY. CLAIMS ARE PAID IN HUGS. RESULTS NOT TYPICAL. YOUR FEELINGS ARE VALID BUT NON-COMPENSABLE. ELIGIBILITY VOIDED BY ACTUALLY READING THIS FINE PRINT. SIDE EFFECTS INCLUDE INCREASED ATTACHMENT TO TOTAL STRANGERS AND THE URGE TO YELL AT A SCOREBOARD.",
    bg: "#1B2A4E",
    bg2: "#3B4A7E",
    accent: "#FFD93D",
    layout: "split",
    transitionPack: "slam",
  }),
  ad("AdTriviaPillow", "ad-trivia-pillow.mp4", {
    preroll: "Tonight's sponsor",
    brand: "Trivia Pillow",
    emoji: "🛏️",
    tagline:
      "Sleep on the answers. Wake up knowing. The pillow with 10,000 facts stitched inside (mostly capitals).",
    testimonial: "I dreamed in Wonders of the World and now I can't stop.",
    testimonialAuthor: "Definitely a real person",
    finePrint:
      "TRIVIA PILLOW IS A FAKE PRODUCT. DOES NOT CONTAIN ACTUAL FACTS. MAY CAUSE NECK PAIN, MILD WISDOM, OR THE URGE TO EXPLAIN THINGS AT BRUNCH. NOT MACHINE WASHABLE. NOT DISHWASHER SAFE. NOT BRAIN SAFE.",
    bg: "#E94B7E",
    bg2: "#FF8C42",
    accent: "#FFD93D",
    layout: "classic",
    transitionPack: "drift",
  }),
  ad("AdHotTakeHotline", "ad-hot-take-hotline.mp4", {
    preroll: "Call us now",
    brand: "Hot Take Hotline",
    emoji: "📞",
    tagline:
      "1-800-HOT-TAKE. Operators standing by 24/7 to validate your worst opinions about the bracket.",
    testimonial:
      "I called to complain that Karen is overrated. They agreed before I finished my sentence. Worth every fake cent.",
    testimonialAuthor: "Tony, North Carolina",
    finePrint:
      "HOTLINE IS A FAKE NUMBER. PLEASE DO NOT CALL THIS NUMBER. SERIOUSLY. $9.99/MINUTE IMAGINARY DOLLARS. OPERATORS ARE ACTUALLY JUST ECHOING WHAT YOU SAID. NO REFUNDS ON HOT TAKES.",
    bg: "#C9296A",
    bg2: "#8B1538",
    accent: "#FFD93D",
    layout: "infomercial",
    transitionPack: "glitch",
    bullets: ["✓ Validates", "✓ Echoes back", "✓ Never disagrees"],
  }),
  ad("AdStrikeCream", "ad-strike-cream.mp4", {
    preroll: "Doctors hate this",
    brand: "Strike Cream",
    emoji: "🩹",
    tagline:
      "Lost a chapter? Got that second strike? Rub Strike Cream on the affected bracket. Results in 4-6 rounds.",
    testimonial:
      "I had a strike. Now I have a champion's mindset and a very greasy bracket.",
    testimonialAuthor: "Rhonda, eliminated week 3",
    finePrint:
      "STRIKE CREAM IS NOT FDA APPROVED. IT IS ALSO NOT A REAL CREAM. DO NOT APPLY TO SKIN, BRACKETS, OR ANY OTHER SURFACE. ACTIVE INGREDIENT: HOPE. INACTIVE INGREDIENT: ALSO HOPE.",
    bg: "#5BCE7A",
    bg2: "#2E7D32",
    accent: "#FFD93D",
    layout: "classic",
    transitionPack: "pulse",
  }),
  ad("AdMiasSchool", "ad-mias-school.mp4", {
    preroll: "Enroll today",
    brand: "Mia's School of Quiz",
    emoji: "🎓",
    tagline:
      "Learn from the only certified seven-year-old champion-in-residence. New cohorts every nap.",
    testimonial:
      "Mia taught me what a peninsula is. I won my first round the next morning.",
    testimonialAuthor: "An actual unnamed finalist",
    finePrint:
      "MIA'S SCHOOL OF QUIZ IS NOT AN ACCREDITED INSTITUTION. CURRICULUM CHANGES BASED ON WHAT MIA WANTS FOR LUNCH. TUITION PAYABLE IN STICKERS. NO REFUNDS, NO ALUMNI BLAZERS.",
    bg: "#FFD93D",
    bg2: "#FF8C42",
    accent: "#C9296A",
    layout: "split",
    transitionPack: "bounce",
  }),
  ad("AdBracketMate", "ad-bracket-mate.mp4", {
    preroll: "Now in beta",
    brand: "BracketMate",
    emoji: "🤖",
    tagline:
      "The AI assistant that will lose for you, gently, and explain at length why your loss is statistically interesting.",
    testimonial:
      "BracketMate told me I had a 2% chance to win. I lost. I have never felt more validated.",
    testimonialAuthor: "Marc, finalist",
    finePrint:
      "BRACKETMATE IS A SATIRE OF A PRODUCT. NO LLM WAS HARMED. RESULTS ARE A LINEAR INTERPOLATION OF VIBES. NOT A LICENSED ADVISOR. NOT A LICENSED ANYTHING. TRAINED ON OUR DISCOURSE FORUM, WHICH SHOULD WORRY YOU.",
    bg: "#1B2A4E",
    bg2: "#5BCE7A",
    accent: "#FFD93D",
    layout: "infomercial",
    transitionPack: "glitch",
    bullets: ["⚙ Always wrong", "📊 Statistically", "💸 Free-ish"],
  }),
  ad("AdQuizVitamins", "ad-quiz-vitamins.mp4", {
    preroll: "Daily supplement",
    brand: "Quiz Vitamins",
    emoji: "💊",
    tagline:
      "Three gummies a day. By round four, you'll know capitals you've never heard of in countries that no longer exist.",
    testimonial:
      "I took two and immediately remembered the difference between geography and cartography.",
    testimonialAuthor: "Karen, also a finalist",
    finePrint:
      "QUIZ VITAMINS CONTAIN NO ACTUAL VITAMINS. OR FACTS. JUST SUGAR AND ENCOURAGEMENT. NOT TESTED ON ANIMALS, OR ANYONE. DO NOT EXCEED ONE GUMMY (DOSE TBD). KEEP AWAY FROM PETS, BRACKETS.",
    bg: "#FF8C42",
    bg2: "#E94B7E",
    accent: "#FFD93D",
    layout: "split",
    transitionPack: "bounce",
  }),
  ad("AdBuzzerApp", "ad-buzzer-app.mp4", {
    preroll: "Free in the App Store (fake)",
    brand: "The Buzzer App",
    emoji: "🔔",
    tagline:
      "Train your finger speed with 200 calibrated buzz patterns. Compete with strangers. Lose to a 7-year-old named Mia.",
    testimonial:
      "I got my buzz time under 80ms. My family has not spoken to me in weeks.",
    testimonialAuthor: "Pre-finals beta tester",
    finePrint:
      "BUZZER APP IS NOT A REAL APP. THE FAKE APP HAS A 4.0-STAR RATING. PREMIUM TIER (3.99 IMAGINARY) UNLOCKS PHRASES LIKE 'BOLD BUZZ' AND 'THAT WAS A MISCLICK'. CAUSES THUMB PAIN.",
    bg: "#3B4A7E",
    bg2: "#1B2A4E",
    accent: "#FFD93D",
    layout: "classic",
    transitionPack: "slam",
  }),
  ad("AdDiscourseCat", "ad-discourse-cat.mp4", {
    preroll: "From the makers of Bracket Insurance",
    brand: "Discourse Cat",
    emoji: "🐈",
    tagline:
      "She doesn't care about your hot take. She doesn't care at all. That's why we love her. Adopt today.",
    testimonial:
      "I posted a 1,200-word manifesto. Discourse Cat sat on the keyboard. Manifesto improved.",
    testimonialAuthor: "Forum power user @samseen",
    finePrint:
      "DISCOURSE CAT IS A METAPHOR. WE DO NOT ACTUALLY HAVE A CAT. PLEASE DO NOT ADOPT A CAT BASED ON THIS AD. PLEASE DO ADOPT A CAT THOUGH. JUST NOT BECAUSE OF US.",
    bg: "#FFD93D",
    bg2: "#C9296A",
    accent: "#1B2A4E",
    fg: "#1B2A4E",
    layout: "split",
    transitionPack: "drift",
  }),
  ad("AdRewriteHistory", "ad-rewrite-history.mp4", {
    preroll: "Now legal in most timelines",
    brand: "Rewrite History",
    emoji: "📝",
    tagline:
      "Undo a wrong answer with our patented Erase-O-Matic™. Works on questions, regrets, and most family dinners.",
    testimonial:
      "I went back and answered 'Mount Everest' on every question. I am now a finalist.",
    testimonialAuthor: "Anonymous, definitely not Sam",
    finePrint:
      "REWRITE HISTORY DOES NOT REWRITE ACTUAL HISTORY. THAT'S YOUR JOB. RESULTS NOT TYPICAL. SIDE EFFECTS: DÉJÀ VU, MILD UNDERSTANDING OF QUANTUM MECHANICS, NEED TO TELL EVERYONE WHAT YOU LEARNED.",
    bg: "#B7E5FF",
    bg2: "#5BCE7A",
    accent: "#1B2A4E",
    fg: "#1B2A4E",
    layout: "infomercial",
    transitionPack: "flash",
    bullets: ["✓ Undoes", "✓ Redoes", "✓ Mostly works"],
  }),
  ad("AdWrongAnswerInsurance", "ad-wrong-answer-insurance.mp4", {
    preroll: "Underwritten by The Quiz Book™",
    brand: "Wrong Answer Insurance",
    emoji: "🛡️",
    tagline:
      "Cover yourself for up to two wrong answers per round. Coverage doubles if the question contains the word 'penultimate'.",
    testimonial:
      "I selected 'C' confidently. It was wrong. WAI gave me a check and a hug. Mostly the hug.",
    testimonialAuthor: "Howie (Grandpa)",
    finePrint:
      "WRONG ANSWER INSURANCE IS, OBVIOUSLY, FAKE. PREMIUMS PAYABLE IN HOT TAKES. DOES NOT COVER: GUESSING, VIBES-BASED REASONING, ANSWERS RECEIVED FROM A RELATIVE WITH A WIKIPEDIA TAB OPEN.",
    bg: "#2E7D32",
    bg2: "#5BCE7A",
    accent: "#FFD93D",
    layout: "classic",
    transitionPack: "spin",
  }),
  ad("AdInternalMonologue", "ad-internal-monologue.mp4", {
    preroll: "Limited time",
    brand: "Internal Monologue Insurance",
    emoji: "💭",
    tagline:
      "Covers up to 47 reruns of 'why did I pick C' per round. Bundle with Wrong Answer Insurance for the full mental health package.",
    testimonial:
      "I used to lie awake at 3am replaying round 2. Now I lie awake replaying ALL of them. Different problem.",
    testimonialAuthor: "Most finalists, probably",
    finePrint:
      "INTERNAL MONOLOGUE INSURANCE DOES NOT COVER YOUR EXTERNAL MONOLOGUE — THAT'S WHAT THE HOT TAKE HOTLINE IS FOR. CALL 1-800-HOT-TAKE. STILL NOT REAL.",
    bg: "#3B4A7E",
    bg2: "#1B2A4E",
    accent: "#FFD93D",
    layout: "infomercial",
    transitionPack: "wobble",
    bullets: ["✓ 47 reruns", "✓ 3am calls", "✓ Yes you again"],
  }),
  ad("AdSamMiaAftershow", "ad-sam-mia-aftershow.mp4", {
    preroll: "Tonight, only on the forum",
    brand: "Sam & Mia: The Aftershow",
    emoji: "🎙️",
    tagline:
      "Live recap, hot takes, and Mia's official rankings of every contestant by how good their name sounds.",
    testimonial:
      "Mia said my name 'sounds like a swing set' and that's now my whole personality.",
    testimonialAuthor: "Marc, finalist",
    finePrint:
      "AFTERSHOW IS A REAL THING. SORT OF. IT'S A FORUM THREAD. MIA WILL POST AT MOST THREE EMOJIS. BEDTIME TAKES PRECEDENCE. STAY TUNED FOR SEASON 2.",
    bg: "#FFE873",
    bg2: "#FF8C42",
    accent: "#C9296A",
    fg: "#1B2A4E",
    layout: "split",
    transitionPack: "pulse",
  }),
];

// Pre-taped season: ads are off. EVENT_VIDEOS only exposes slides
// to the Scene Director + runbook. To turn ads back on, swap the
// filter for the raw `ALL_EVENT_VIDEOS` array.
export const EVENT_VIDEOS: EventVideoEntry[] = ALL_EVENT_VIDEOS.filter(
  (v) => v.kind !== "ad"
);

// Kept as a separate export so the ad data is still reachable for
// future use / archive without hitting the runbook.
export const PARODY_ADS: AdEntry[] = ALL_EVENT_VIDEOS.filter(
  (v): v is AdEntry => v.kind === "ad"
);
