// Public step-by-step guide for finalists (and anyone else) on how
// to navigate Discourse — sign in, find the NDA PM, reply, then
// open the Finalist Briefing in Finals Room. Designed for readers
// who have never used a forum: big text, one-action-per-step,
// recreated UI mockups (SVG) showing exactly where to click.
//
// No auth required — finalists may not have signed in yet when
// they reach this page from the email.

import type { Metadata } from "next";
import Link from "next/link";
import { Stage } from "@/components/Stage";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Forum walkthrough · finalist guide",
  description:
    "Step-by-step guide to the forum: sign in, find your message, agree to the finals terms, and open the Finalist Briefing.",
  alternates: { canonical: `${SITE_URL}/finals-guide` },
  robots: { index: false, follow: false },
};

export const dynamic = "force-static";

export default function FinalsGuidePage() {
  return (
    <Stage scrollable>
      <article className="max-w-3xl mx-auto pt-6 px-4 pb-20 flex flex-col gap-8">
        {/* Cover */}
        <header className="text-center">
          <p className="font-display text-sm uppercase tracking-[0.2em] text-coral-deep">
            Finalist guide
          </p>
          <h1 className="font-display text-4xl md:text-6xl text-navy mt-2 drop-shadow-[3px_3px_0_var(--navy)]">
            How to use the forum
          </h1>
          <p className="font-body text-base md:text-lg text-navy-soft mt-4 max-w-2xl mx-auto">
            Ten simple steps. Read one, do it, come back for the next.
            Don&rsquo;t skip ahead. If something doesn&rsquo;t look like the
            picture, scroll down to <em>What if it didn&rsquo;t work?</em> at
            the bottom.
          </p>
          <a
            href="https://discuss.miaswebsites.art"
            className="pop pop-coral text-base bob inline-block mt-6"
          >
            🌐 Open the forum
          </a>
        </header>

        <Step
          n={1}
          title="Open the forum"
          body={
            <>
              <p>
                Click <strong>"Open the forum"</strong> above, OR open a new
                browser tab and go to:
              </p>
              <p className="font-mono bg-cloud border-3 border-navy rounded-xl px-3 py-2 mt-3 text-sm break-all">
                discuss.miaswebsites.art
              </p>
              <p className="mt-3">
                You&rsquo;ll land on a colourful page that looks like ours.
                Almost there.
              </p>
            </>
          }
          mock={<MockBrowser url="discuss.miaswebsites.art" highlightUrl />}
        />

        <Step
          n={2}
          title="Click Sign In (top right)"
          body={
            <>
              <p>
                Look at the <strong>top-right corner</strong> of the page. You
                will see two buttons. Click the one that says <strong>Sign In</strong>.
              </p>
              <p className="mt-3">
                This will bounce you over to the main quiz site for a second
                — that&rsquo;s normal — and bring you back signed in.
              </p>
              <Tip>
                If you&rsquo;re already signed into{" "}
                <strong>quiz.miaswebsites.art</strong>, this happens
                automatically and you won&rsquo;t see a login screen. If
                not, follow the on-screen prompt to sign in there first.
              </Tip>
            </>
          }
          mock={<MockHeader highlight="signin" />}
        />

        <Step
          n={3}
          title="Find the inbox icon"
          body={
            <>
              <p>
                Once you&rsquo;re signed in, look at the <strong>top-right</strong>{" "}
                again. Where it used to say <em>Sign In</em>, you now see{" "}
                <strong>your tiny avatar</strong> (a little circle with your
                initial or photo) and an <strong>envelope icon</strong> 📩.
              </p>
              <p className="mt-3">
                Click the <strong>envelope icon</strong>. That&rsquo;s your
                inbox. The forum will have already sent you a message.
              </p>
            </>
          }
          mock={<MockHeader highlight="inbox" />}
        />

        <Step
          n={4}
          title="Open the message"
          body={
            <>
              <p>
                A panel will open. You should see a message — the title
                will be ONE of these depending on whether you&rsquo;re a
                finalist or not:
              </p>
              <p className="font-display text-base text-coral-deep mt-2">
                🌞 Welcome — please agree to continue
              </p>
              <p className="font-display text-base text-coral-deep">
                🔒 Finals access — confidentiality required
              </p>
              <p className="mt-3">
                Either way, <strong>click on it</strong> to open the message.
              </p>
              <Tip>
                If the panel is full of other messages, scroll up — the
                most recent are at the top.
              </Tip>
            </>
          }
          mock={<MockInbox />}
        />

        <Step
          n={5}
          title="Read it. Then scroll all the way down."
          body={
            <>
              <p>
                The message has the finals confidentiality terms.{" "}
                <strong>Read it once carefully.</strong>
              </p>
              <p className="mt-3">
                When you reach the bottom, you will see a big <strong>blue Reply button</strong>. Click it.
              </p>
            </>
          }
          mock={<MockMessage highlight="reply" />}
        />

        <Step
          n={6}
          title='Type the words "yes I agree"'
          body={
            <>
              <p>
                A typing box will appear at the bottom of the screen. Type
                exactly:
              </p>
              <p className="font-mono bg-cloud border-3 border-navy rounded-xl px-3 py-2 mt-3 text-base">
                yes I agree
              </p>
              <p className="mt-3">
                You can type more if you want — questions, comments, "thanks
                Sam!" — but the words <strong>"yes"</strong> or{" "}
                <strong>"agree"</strong> need to be in there for the system
                to record your agreement.
              </p>
            </>
          }
          mock={<MockComposer text="yes I agree" />}
        />

        <Step
          n={7}
          title='Click the blue "Reply" button'
          body={
            <>
              <p>
                Just below your typing box, there&rsquo;s a big blue button
                that says <strong>Reply</strong>. Click it.
              </p>
              <p className="mt-3">
                Your message gets sent. The forum will confirm with{" "}
                <strong>"🔓 Agreed and recorded"</strong> within a few
                seconds.
              </p>
            </>
          }
          mock={<MockComposer text="yes I agree" highlight="submit" />}
        />

        <Step
          n={8}
          title="Open the Finals Room"
          body={
            <>
              <p>
                Now look at the left side of the screen. You should see a list
                of categories. Find the one called <strong>Finals Room</strong> with
                a 🟡 yellow dot next to it. Click it.
              </p>
              <Tip>
                On phones, the category list might be tucked behind a{" "}
                <strong>menu (≡)</strong> icon at the top-left. Tap that
                first to open the list.
              </Tip>
            </>
          }
          mock={<MockSidebar highlight="finals-room" />}
        />

        <Step
          n={9}
          title="Find the pinned briefing"
          body={
            <>
              <p>
                Inside Finals Room you&rsquo;ll see a list of topics. The
                very top one will have a 📌 little pin icon next to it. The
                title is:
              </p>
              <p className="font-display text-lg text-coral-deep mt-2">
                📋 Finalist Briefing — strict + vague (read this first)
              </p>
              <p className="mt-3">
                <strong>Click on it.</strong> Read the body. The PDF
                attachment at the top is the canonical briefing — click to
                download or read on screen.
              </p>
            </>
          }
          mock={<MockTopicList />}
        />

        <Step
          n={10}
          title="Drop a 👍 so we know you read it"
          body={
            <>
              <p>
                At the bottom of the briefing post, you&rsquo;ll see a row
                of icons: a 💬 reply button, a 🔗 link button, and a 🤍
                heart-shaped <strong>like</strong> button.
              </p>
              <p className="mt-3">
                Hover (or tap) the heart and pick the <strong>👍</strong> emoji.
                That&rsquo;s our signal that you&rsquo;ve read the briefing
                and you&rsquo;re ready for the show.
              </p>
              <p className="mt-3">
                You&rsquo;re done with the setup! From now on, all finals
                coordination happens in <strong>Finals Room</strong>.
              </p>
            </>
          }
          mock={<MockReactions />}
        />

        <section className="card px-6 py-6 mt-2 bg-coral-soft text-white border-3 border-navy rounded-2xl">
          <h2 className="font-display text-2xl">What if it didn&rsquo;t work?</h2>
          <ul className="font-body text-base mt-3 list-disc pl-5 flex flex-col gap-2">
            <li>
              <strong>I clicked Sign In and got an error.</strong> Try{" "}
              <a
                href="https://quiz.miaswebsites.art/signin"
                className="underline"
              >
                signing in to the main quiz site
              </a>{" "}
              first, then come back and try the forum.
            </li>
            <li>
              <strong>The envelope icon doesn&rsquo;t show a message.</strong>{" "}
              Refresh the page. If still empty, email Sam — there&rsquo;s a
              chance the auto-message didn&rsquo;t fire.
            </li>
            <li>
              <strong>I can&rsquo;t find Finals Room.</strong> That means the
              system didn&rsquo;t register your "yes I agree" reply yet.
              Wait 30 seconds, then refresh. Still nothing → email Sam.
            </li>
            <li>
              <strong>I&rsquo;m on a phone and everything looks tiny.</strong>{" "}
              Tap the <strong>≡</strong> icon at the top-left to open the
              category list. Tap your avatar at top-right for the inbox.
            </li>
            <li>
              <strong>None of this worked.</strong> Email Sam at{" "}
              <a href="mailto:appdev7710@gmail.com" className="underline">
                appdev7710@gmail.com
              </a>{" "}
              with the words "<em>finals walkthrough — stuck</em>" and a
              screenshot. He&rsquo;ll fix it for you.
            </li>
          </ul>
        </section>

        <p className="text-center font-body text-sm text-navy-soft">
          Questions? Reply to the welcome email and Sam will see it.
        </p>
        <div className="text-center">
          <Link
            href="/finals-guide.pdf"
            className="font-display text-sm uppercase tracking-[0.18em] text-coral-deep underline"
          >
            📥 Download as PDF
          </Link>
        </div>
      </article>
    </Stage>
  );
}

// ── Step shell ─────────────────────────────────────────────────────────
function Step({
  n,
  title,
  body,
  mock,
}: {
  n: number;
  title: string;
  body: React.ReactNode;
  mock: React.ReactNode;
}) {
  return (
    <section className="card px-5 md:px-7 py-6 flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <span
          className="inline-flex items-center justify-center w-12 h-12 rounded-full border-3 border-navy bg-sun text-navy font-display text-2xl shadow-pop-sm"
          aria-hidden
        >
          {n}
        </span>
        <h2 className="font-display text-2xl md:text-3xl text-navy">
          {title}
        </h2>
      </div>
      <div className="font-body text-base md:text-lg text-navy leading-relaxed">
        {body}
      </div>
      <div className="mt-2 rounded-2xl border-3 border-navy bg-cloud overflow-hidden">
        {mock}
      </div>
    </section>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 px-4 py-3 rounded-xl border-2 border-dashed border-coral-deep bg-sun/40 font-body text-sm">
      💡 <strong>Tip:</strong> {children}
    </div>
  );
}

// ── Recreated UI mockups (inline SVG) ───────────────────────────────────
// These don't try to be pixel-perfect Discourse — they're simplified
// wireframe-style illustrations with arrows pointing at the thing
// the reader needs to click. Big text, big arrows, picture-book vibe.

function MockBrowser({ url, highlightUrl }: { url: string; highlightUrl?: boolean }) {
  return (
    <svg viewBox="0 0 600 220" className="w-full h-auto" aria-hidden>
      <rect x="0" y="0" width="600" height="220" fill="#F4FAFF" />
      {/* browser chrome */}
      <rect x="20" y="20" width="560" height="34" rx="8" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="3" />
      <circle cx="40" cy="37" r="5" fill="#FF6B6B" />
      <circle cx="58" cy="37" r="5" fill="#FFD93D" />
      <circle cx="76" cy="37" r="5" fill="#4FB04F" />
      <rect
        x="100" y="26" width="460" height="22" rx="11"
        fill={highlightUrl ? "#FFD93D" : "#F0F0F0"}
        stroke={highlightUrl ? "#E94B7E" : "#1B2A4E"}
        strokeWidth={highlightUrl ? "3" : "2"}
      />
      <text x="120" y="42" fontFamily="Quicksand,sans-serif" fontSize="13" fill="#1B2A4E">{url}</text>
      {/* page body */}
      <rect x="20" y="64" width="560" height="140" rx="14" fill="#B7E5FF" stroke="#1B2A4E" strokeWidth="3" />
      <text x="300" y="120" textAnchor="middle" fontFamily="Fredoka,sans-serif" fontWeight="700" fontSize="22" fill="#1B2A4E">🌞 Mia&apos;s Quiz Discuss</text>
      <text x="300" y="150" textAnchor="middle" fontFamily="Quicksand,sans-serif" fontSize="14" fill="#3B4A7E">Welcome! Click Sign In (top right).</text>
      {highlightUrl && (
        <>
          <path d="M 90 90 Q 130 70 175 40" stroke="#E94B7E" strokeWidth="3" fill="none" markerEnd="url(#arr)" />
          <text x="40" y="100" fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#C9296A">type this</text>
        </>
      )}
      <Arrow />
    </svg>
  );
}

function MockHeader({ highlight }: { highlight: "signin" | "inbox" }) {
  return (
    <svg viewBox="0 0 600 220" className="w-full h-auto" aria-hidden>
      <rect x="0" y="0" width="600" height="220" fill="#F4FAFF" />
      {/* header strip */}
      <rect x="0" y="0" width="600" height="60" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="3" />
      <text x="20" y="38" fontFamily="Fredoka,sans-serif" fontWeight="700" fontSize="20" fill="#1B2A4E">🌞 Quiz Discuss</text>

      {/* signin variant: two buttons */}
      {highlight === "signin" ? (
        <>
          <rect x="430" y="14" width="70" height="32" rx="8"
            fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="2" />
          <text x="465" y="35" textAnchor="middle" fontFamily="Fredoka,sans-serif" fontSize="13" fill="#1B2A4E">Sign Up</text>
          <rect x="510" y="14" width="70" height="32" rx="8"
            fill="#FFD93D" stroke="#E94B7E" strokeWidth="3" />
          <text x="545" y="35" textAnchor="middle" fontFamily="Fredoka,sans-serif" fontSize="13" fontWeight="700" fill="#1B2A4E">Sign In</text>
          <path d="M 545 90 Q 540 75 545 50" stroke="#E94B7E" strokeWidth="3" fill="none" markerEnd="url(#arr)" />
          <text x="430" y="115" fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#C9296A">click this!</text>
        </>
      ) : (
        <>
          {/* search */}
          <rect x="380" y="14" width="100" height="32" rx="16" fill="#F0F0F0" stroke="#1B2A4E" strokeWidth="2" />
          <circle cx="396" cy="30" r="5" fill="none" stroke="#3B4A7E" strokeWidth="2" />
          <text x="410" y="34" fontFamily="Quicksand,sans-serif" fontSize="11" fill="#3B4A7E">search…</text>
          {/* envelope */}
          <rect x="492" y="16" width="34" height="28" rx="4"
            fill="#FFD93D" stroke="#E94B7E" strokeWidth="3" />
          <path d="M 494 20 L 509 32 L 524 20" fill="none" stroke="#1B2A4E" strokeWidth="2" />
          <circle cx="525" cy="14" r="6" fill="#E94B7E" stroke="#1B2A4E" strokeWidth="2" />
          <text x="525" y="18" textAnchor="middle" fontFamily="Fredoka,sans-serif" fontSize="9" fontWeight="700" fill="#FFFFFF">1</text>
          {/* avatar */}
          <circle cx="552" cy="30" r="14" fill="#87CEEB" stroke="#1B2A4E" strokeWidth="2" />
          <text x="552" y="35" textAnchor="middle" fontFamily="Fredoka,sans-serif" fontSize="13" fontWeight="700" fill="#1B2A4E">M</text>
          <path d="M 510 90 Q 510 75 510 50" stroke="#E94B7E" strokeWidth="3" fill="none" markerEnd="url(#arr)" />
          <text x="455" y="115" fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#C9296A">click the envelope!</text>
        </>
      )}
      {/* page body */}
      <rect x="0" y="60" width="600" height="160" fill="#B7E5FF" />
      <text x="300" y="160" textAnchor="middle" fontFamily="Quicksand,sans-serif" fontSize="14" fill="#3B4A7E">…rest of page…</text>
      <Arrow />
    </svg>
  );
}

function MockInbox() {
  return (
    <svg viewBox="0 0 600 280" className="w-full h-auto" aria-hidden>
      <rect x="0" y="0" width="600" height="280" fill="#F4FAFF" />
      {/* dropdown panel */}
      <rect x="270" y="20" width="310" height="240" rx="14" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="3" />
      <text x="290" y="50" fontFamily="Fredoka,sans-serif" fontWeight="700" fontSize="16" fill="#1B2A4E">Inbox</text>
      <line x1="280" y1="60" x2="570" y2="60" stroke="#B7E5FF" strokeWidth="2" />

      {/* highlighted message */}
      <rect x="280" y="68" width="290" height="56" rx="10" fill="#FFFAE0" stroke="#E94B7E" strokeWidth="3" />
      <circle cx="300" cy="96" r="11" fill="#FFD93D" stroke="#1B2A4E" strokeWidth="2" />
      <text x="300" y="100" textAnchor="middle" fontFamily="Fredoka,sans-serif" fontSize="11" fontWeight="700" fill="#1B2A4E">S</text>
      <text x="320" y="92" fontFamily="Fredoka,sans-serif" fontWeight="700" fontSize="13" fill="#1B2A4E">🔒 Finals access — confidentiality…</text>
      <text x="320" y="110" fontFamily="Quicksand,sans-serif" fontSize="11" fill="#3B4A7E">From system · just now</text>

      {/* other messages dimmed */}
      <rect x="280" y="132" width="290" height="40" rx="8" fill="#F0F0F0" stroke="#3B4A7E" strokeWidth="1" />
      <text x="295" y="156" fontFamily="Quicksand,sans-serif" fontSize="11" fill="#3B4A7E">(other older messages)</text>
      <rect x="280" y="180" width="290" height="40" rx="8" fill="#F0F0F0" stroke="#3B4A7E" strokeWidth="1" />
      <text x="295" y="204" fontFamily="Quicksand,sans-serif" fontSize="11" fill="#3B4A7E">…</text>

      {/* arrow */}
      <path d="M 240 95 Q 260 95 275 95" stroke="#E94B7E" strokeWidth="3" fill="none" markerEnd="url(#arr)" />
      <text x="100" y="80" fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#C9296A">click on this message →</text>

      <Arrow />
    </svg>
  );
}

function MockMessage({ highlight }: { highlight: "reply" }) {
  return (
    <svg viewBox="0 0 600 320" className="w-full h-auto" aria-hidden>
      <rect x="0" y="0" width="600" height="320" fill="#F4FAFF" />
      <rect x="20" y="14" width="560" height="290" rx="14" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="3" />
      <text x="40" y="44" fontFamily="Fredoka,sans-serif" fontWeight="700" fontSize="18" fill="#1B2A4E">🔒 Finals access — confidentiality required</text>
      <text x="40" y="68" fontFamily="Quicksand,sans-serif" fontSize="11" fill="#3B4A7E">from system · just now</text>
      <line x1="40" y1="80" x2="560" y2="80" stroke="#B7E5FF" strokeWidth="2" />
      <text x="40" y="105" fontFamily="Quicksand,sans-serif" fontSize="13" fill="#1B2A4E">Hi,</text>
      <text x="40" y="130" fontFamily="Quicksand,sans-serif" fontSize="13" fill="#1B2A4E">You&apos;re seeing this because the bracket has placed</text>
      <text x="40" y="148" fontFamily="Quicksand,sans-serif" fontSize="13" fill="#1B2A4E">you in the finals of Mia&apos;s Quiz Tournament.</text>
      <text x="40" y="172" fontFamily="Quicksand,sans-serif" fontSize="13" fill="#1B2A4E">…[the terms]…</text>
      <text x="40" y="208" fontFamily="Quicksand,sans-serif" fontSize="13" fontStyle="italic" fill="#3B4A7E">(scroll all the way down)</text>

      {/* reply button */}
      <rect x="40" y="240" width="86" height="40" rx="10"
        fill={highlight === "reply" ? "#E94B7E" : "#FFFFFF"}
        stroke="#1B2A4E" strokeWidth="3" />
      <text x="83" y="265" textAnchor="middle"
        fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700"
        fill={highlight === "reply" ? "#FFFFFF" : "#1B2A4E"}>↩ Reply</text>

      {/* other action buttons */}
      <rect x="138" y="240" width="80" height="40" rx="10" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="2" />
      <text x="178" y="265" textAnchor="middle" fontFamily="Fredoka,sans-serif" fontSize="13" fill="#1B2A4E">🔗 Share</text>
      <rect x="230" y="240" width="60" height="40" rx="10" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="2" />
      <text x="260" y="265" textAnchor="middle" fontFamily="Fredoka,sans-serif" fontSize="13" fill="#1B2A4E">🤍</text>

      <path d="M 30 300 Q 50 300 75 295" stroke="#E94B7E" strokeWidth="3" fill="none" markerEnd="url(#arr)" />
      <text x="430" y="300" fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#C9296A">click Reply →</text>
      <Arrow />
    </svg>
  );
}

function MockComposer({
  text,
  highlight,
}: {
  text: string;
  highlight?: "submit";
}) {
  return (
    <svg viewBox="0 0 600 240" className="w-full h-auto" aria-hidden>
      <rect x="0" y="0" width="600" height="240" fill="#F4FAFF" />
      <rect x="20" y="20" width="560" height="200" rx="14" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="3" />
      <text x="40" y="48" fontFamily="Fredoka,sans-serif" fontWeight="700" fontSize="14" fill="#1B2A4E">Reply to message</text>

      {/* textarea */}
      <rect x="40" y="60" width="520" height="100" rx="10"
        fill="#FFFAE0" stroke="#E94B7E" strokeWidth="3" />
      <text x="56" y="100" fontFamily="Quicksand,sans-serif" fontSize="20" fontWeight="700" fill="#1B2A4E">{text}</text>
      <line x1="56" y1="115" x2="56 + 200" y2="115" stroke="#E94B7E" strokeWidth="2" opacity="0.5" />

      {/* submit row */}
      <rect x="40" y="172" width="100" height="36" rx="8"
        fill={highlight === "submit" ? "#E94B7E" : "#4FB04F"}
        stroke="#1B2A4E" strokeWidth="3" />
      <text x="90" y="195" textAnchor="middle"
        fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#FFFFFF">↩ Reply</text>

      <text x="155" y="195" fontFamily="Quicksand,sans-serif" fontSize="11" fill="#3B4A7E">⌘+Enter also works</text>

      {highlight === "submit" && (
        <>
          <path d="M 100 220 Q 95 215 95 213" stroke="#E94B7E" strokeWidth="3" fill="none" markerEnd="url(#arr)" />
          <text x="170" y="225" fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#C9296A">click to send</text>
        </>
      )}
      <Arrow />
    </svg>
  );
}

function MockSidebar({ highlight }: { highlight: "finals-room" }) {
  return (
    <svg viewBox="0 0 600 280" className="w-full h-auto" aria-hidden>
      <rect x="0" y="0" width="600" height="280" fill="#F4FAFF" />
      {/* sidebar */}
      <rect x="20" y="20" width="200" height="240" rx="12" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="3" />
      <text x="40" y="48" fontFamily="Fredoka,sans-serif" fontSize="11" fontWeight="700" fill="#3B4A7E" letterSpacing="0.06em">CATEGORIES</text>
      <Row y={64} dot="#FFD93D" label="Welcome" />
      <Row y={92} dot="#87CEEB" label="Tournament Talk" />
      <Row y={120} dot="#E94B7E" label="Round Recaps" />

      {/* highlighted */}
      <rect x="32" y="142" width="176" height="32" rx="8" fill="#FFFAE0" stroke="#E94B7E" strokeWidth="3" />
      <circle cx="44" cy="158" r="6" fill="#FFD93D" stroke="#1B2A4E" strokeWidth="2" />
      <text x="60" y="163" fontFamily="Fredoka,sans-serif" fontSize="13" fontWeight="700" fill="#1B2A4E">🏆 Finals Room</text>

      <Row y={180} dot="#4FB04F" label="Off Topic" />
      <Row y={208} dot="#3B4A7E" label="Announcements" />

      {/* main area */}
      <rect x="240" y="20" width="340" height="240" rx="12" fill="#B7E5FF" stroke="#1B2A4E" strokeWidth="2" strokeDasharray="6 4" />
      <text x="410" y="148" textAnchor="middle" fontFamily="Quicksand,sans-serif" fontSize="14" fill="#3B4A7E">…content area…</text>

      <path d="M 232 158 Q 226 158 222 158" stroke="#E94B7E" strokeWidth="3" fill="none" markerEnd="url(#arr)" />
      <text x="380" y="80" fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#C9296A">click Finals Room ↑</text>
      <Arrow />
    </svg>
  );
}

function Row({ y, dot, label }: { y: number; dot: string; label: string }) {
  return (
    <g>
      <circle cx="44" cy={y + 14} r="6" fill={dot} stroke="#1B2A4E" strokeWidth="2" />
      <text x="60" y={y + 19} fontFamily="Quicksand,sans-serif" fontSize="13" fill="#1B2A4E">{label}</text>
    </g>
  );
}

function MockTopicList() {
  return (
    <svg viewBox="0 0 600 240" className="w-full h-auto" aria-hidden>
      <rect x="0" y="0" width="600" height="240" fill="#F4FAFF" />
      <rect x="20" y="14" width="560" height="210" rx="12" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="3" />
      <text x="40" y="42" fontFamily="Fredoka,sans-serif" fontWeight="700" fontSize="16" fill="#1B2A4E">Finals Room — topics</text>
      <line x1="40" y1="50" x2="560" y2="50" stroke="#B7E5FF" strokeWidth="2" />

      {/* pinned briefing */}
      <rect x="40" y="62" width="520" height="50" rx="10" fill="#FFFAE0" stroke="#E94B7E" strokeWidth="3" />
      <text x="58" y="86" fontFamily="Fredoka,sans-serif" fontSize="13" fill="#E94B7E" fontWeight="700">📌</text>
      <text x="80" y="86" fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#1B2A4E">📋 Finalist Briefing — strict + vague (read this first)</text>
      <text x="80" y="104" fontFamily="Quicksand,sans-serif" fontSize="11" fill="#3B4A7E">posted by support_bot · pinned</text>

      <rect x="40" y="124" width="520" height="40" rx="8" fill="#FFFFFF" stroke="#3B4A7E" strokeWidth="1" />
      <text x="60" y="148" fontFamily="Quicksand,sans-serif" fontSize="12" fill="#3B4A7E">…other topics…</text>
      <rect x="40" y="172" width="520" height="40" rx="8" fill="#FFFFFF" stroke="#3B4A7E" strokeWidth="1" />
      <text x="60" y="196" fontFamily="Quicksand,sans-serif" fontSize="12" fill="#3B4A7E">…</text>

      <path d="M 30 86 Q 36 86 38 86" stroke="#E94B7E" strokeWidth="3" fill="none" markerEnd="url(#arr)" />
      <text x="100" y="38" fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#C9296A">click the pinned one ↓</text>
      <Arrow />
    </svg>
  );
}

function MockReactions() {
  return (
    <svg viewBox="0 0 600 240" className="w-full h-auto" aria-hidden>
      <rect x="0" y="0" width="600" height="240" fill="#F4FAFF" />
      <rect x="20" y="20" width="560" height="180" rx="14" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="3" />
      <text x="40" y="50" fontFamily="Quicksand,sans-serif" fontSize="13" fill="#3B4A7E">…body of the briefing post…</text>
      <line x1="40" y1="60" x2="560" y2="60" stroke="#B7E5FF" strokeWidth="2" />

      {/* action row */}
      <rect x="40" y="80" width="60" height="36" rx="8" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="2" />
      <text x="70" y="103" textAnchor="middle" fontFamily="Fredoka,sans-serif" fontSize="13" fill="#1B2A4E">💬</text>

      <rect x="110" y="80" width="60" height="36" rx="8" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="2" />
      <text x="140" y="103" textAnchor="middle" fontFamily="Fredoka,sans-serif" fontSize="13" fill="#1B2A4E">🔗</text>

      {/* highlighted heart/like */}
      <rect x="180" y="80" width="60" height="36" rx="8" fill="#FFFAE0" stroke="#E94B7E" strokeWidth="3" />
      <text x="210" y="103" textAnchor="middle" fontFamily="Fredoka,sans-serif" fontSize="14" fill="#E94B7E">🤍</text>

      {/* reaction picker bubble */}
      <rect x="160" y="130" width="220" height="44" rx="12" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="3" />
      <text x="180" y="158" fontFamily="Fredoka,sans-serif" fontSize="20">❤️</text>
      <text x="206" y="158" fontFamily="Fredoka,sans-serif" fontSize="20">😂</text>
      <text x="232" y="158" fontFamily="Fredoka,sans-serif" fontSize="20">😮</text>
      {/* highlighted thumbs up */}
      <rect x="252" y="138" width="32" height="28" rx="6" fill="#FFFAE0" stroke="#E94B7E" strokeWidth="3" />
      <text x="268" y="158" textAnchor="middle" fontFamily="Fredoka,sans-serif" fontSize="20">👍</text>
      <text x="294" y="158" fontFamily="Fredoka,sans-serif" fontSize="20">🎉</text>
      <text x="320" y="158" fontFamily="Fredoka,sans-serif" fontSize="20">😢</text>
      <text x="346" y="158" fontFamily="Fredoka,sans-serif" fontSize="20">🤔</text>

      <path d="M 210 124 Q 220 130 268 134" stroke="#E94B7E" strokeWidth="3" fill="none" markerEnd="url(#arr)" />
      <text x="380" y="155" fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#C9296A">tap 🤍 then pick 👍</text>
      <Arrow />
    </svg>
  );
}

// One marker definition reused across all SVGs.
function Arrow() {
  return (
    <defs>
      <marker id="arr" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto" markerUnits="strokeWidth">
        <path d="M 0 0 L 12 6 L 0 12 L 4 6 Z" fill="#E94B7E" />
      </marker>
    </defs>
  );
}
