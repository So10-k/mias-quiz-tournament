// Public step-by-step guide for signing in to the quiz site (the
// step BEFORE getting to the forum). Same picture-book style as
// /finals-guide and /forum-guide. Designed for "I'm at this page,
// what do I do?" not "what is this site about?"
//
// No auth required — the whole point is to help users who can't
// figure out how to get IN.

import type { Metadata } from "next";
import Link from "next/link";
import { Stage } from "@/components/Stage";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "How to sign in",
  description:
    "Step-by-step guide for signing in to Mia's Quiz Tournament. Five steps, big pictures, no jargon.",
  alternates: { canonical: `${SITE_URL}/how-to-sign-in` },
  robots: { index: true, follow: true },
};

export const dynamic = "force-static";

export default function HowToSignInPage() {
  return (
    <Stage scrollable>
      <article className="max-w-3xl mx-auto pt-6 px-4 pb-20 flex flex-col gap-8">
        <header className="text-center">
          <p className="font-display text-sm uppercase tracking-[0.2em] text-coral-deep">
            Stuck signing in?
          </p>
          <h1 className="font-display text-4xl md:text-6xl text-navy mt-2 drop-shadow-[3px_3px_0_var(--navy)]">
            How to sign in
          </h1>
          <p className="font-body text-base md:text-lg text-navy-soft mt-4 max-w-2xl mx-auto">
            Five steps. No passwords to remember — we send you a one-time
            code in email. Read each step, do it, then come back for the
            next.
          </p>
          <Link
            href="/signin"
            className="pop pop-coral text-base bob inline-block mt-6"
          >
            🔐 Start signing in
          </Link>
        </header>

        <Step
          n={1}
          title="Click the big Sign In button"
          body={
            <>
              <p>
                On the home page (or wherever you got the link from), find a
                bright pink/coral button that says <strong>Sign in</strong>.
                Click it.
              </p>
              <p className="mt-3">
                It might be at the top of the page or in the middle. Look
                for the words.
              </p>
            </>
          }
          mock={<MockSignInButton />}
        />

        <Step
          n={2}
          title="A new screen will load — type your email"
          body={
            <>
              <p>
                You&rsquo;ll see a clean white screen with a small box that
                says <strong>Email address</strong>. Type the email you used
                when Sam invited you to the tournament.
              </p>
              <Tip>
                If you have multiple emails, use the one Sam sent the
                invite to. We can&rsquo;t look up your account by name.
              </Tip>
              <p className="mt-3">
                Then click the big button under it that says{" "}
                <strong>Continue</strong> or <strong>Send code</strong>.
              </p>
            </>
          }
          mock={<MockEmailEntry />}
        />

        <Step
          n={3}
          title="Check your email — there's a 6-digit code"
          body={
            <>
              <p>
                Open your email. Within a minute, there will be a new
                message from <strong>"MiaAuth"</strong>. Open it.
              </p>
              <p className="mt-3">
                Inside, you&rsquo;ll see a <strong>6-digit number</strong>{" "}
                like <span className="font-mono bg-cloud border-2 border-navy rounded px-2 py-1">529 047</span>.
                That&rsquo;s your code.
              </p>
              <Tip>
                Can&rsquo;t find the email? Check your <strong>Spam</strong>{" "}
                or <strong>Junk</strong> folder. It&rsquo;s safe to mark it
                "Not Spam" so future codes go to your inbox.
              </Tip>
            </>
          }
          mock={<MockEmailInbox />}
        />

        <Step
          n={4}
          title="Type the code on the sign-in screen"
          body={
            <>
              <p>
                Go back to the browser tab where you typed your email. There
                will now be six little boxes asking for the code.
              </p>
              <p className="mt-3">
                Type the 6 digits into the boxes. They&rsquo;ll auto-advance
                — after each digit, the cursor jumps to the next box.
              </p>
              <p className="mt-3">
                <strong>You don&rsquo;t need to press Enter</strong> — once
                all 6 are typed, the system signs you in automatically.
              </p>
            </>
          }
          mock={<MockCodeEntry />}
        />

        <Step
          n={5}
          title="You're in!"
          body={
            <>
              <p>
                You&rsquo;ll bounce back to the quiz site, signed in. Your
                name should show in the top-right corner.
              </p>
              <p className="mt-3">
                If you came from the forum (discuss.miaswebsites.art), it
                will automatically take you back there with you signed in.
              </p>
              <p className="mt-3">
                If you came from an email link, the page you wanted should
                load. If not, click the <strong>Mia&rsquo;s Quiz</strong>{" "}
                logo in the top-left to go to the home page.
              </p>
            </>
          }
          mock={<MockSignedIn />}
        />

        <section className="card px-6 py-6 bg-coral-soft text-white border-3 border-navy rounded-2xl">
          <h2 className="font-display text-2xl">What if it didn&rsquo;t work?</h2>
          <ul className="font-body text-base mt-3 list-disc pl-5 flex flex-col gap-2">
            <li>
              <strong>"Registration is closed for new players."</strong>{" "}
              The email you typed isn&rsquo;t in our system. Try a different
              email — Sam sent the invite to a specific one. If you only
              have one email, email Sam at{" "}
              <a href="mailto:appdev7710@gmail.com" className="underline">
                appdev7710@gmail.com
              </a>{" "}
              and he&rsquo;ll add it.
            </li>
            <li>
              <strong>The email never arrives.</strong> Check your spam.
              Then wait two minutes — sometimes there&rsquo;s a small delay.
              Then click <strong>Resend</strong> on the sign-in screen.
            </li>
            <li>
              <strong>"Code expired"</strong> — codes only last 5 minutes.
              Go back, type your email again, get a fresh code.
            </li>
            <li>
              <strong>"Wrong code"</strong> — be sure you copied all 6
              digits without spaces. The most common error is missing the
              last digit.
            </li>
            <li>
              <strong>Stuck on the Auth0 / MiaAuth screen.</strong> Don&rsquo;t
              type anything fancy. Just your email, then the code. If a
              "Sign up" prompt shows, that means we don&rsquo;t have your
              email — see the first bullet.
            </li>
            <li>
              <strong>None of this is working.</strong> Email Sam at{" "}
              <a href="mailto:appdev7710@gmail.com" className="underline">
                appdev7710@gmail.com
              </a>{" "}
              with the words "<em>can&rsquo;t sign in</em>" and a screenshot.
              He&rsquo;ll fix it for you.
            </li>
          </ul>
        </section>

        <div className="card px-5 py-4 bg-sky1 text-navy">
          <p className="font-display text-sm uppercase tracking-[0.18em]">
            Once you&rsquo;re signed in
          </p>
          <p className="font-body text-base mt-2">
            If you&rsquo;re trying to use the discussion forum, head over to{" "}
            <Link href="/forum-guide" className="text-coral-deep underline">
              the forum walkthrough
            </Link>{" "}
            for the next 10 steps.
          </p>
        </div>
      </article>
    </Stage>
  );
}

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

function MockSignInButton() {
  return (
    <svg viewBox="0 0 600 220" className="w-full h-auto" aria-hidden>
      <rect width="600" height="220" fill="#B7E5FF" />
      {/* page header */}
      <rect x="0" y="0" width="600" height="60" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="3" />
      <text x="20" y="38" fontFamily="Fredoka,sans-serif" fontWeight="700" fontSize="18" fill="#1B2A4E">🌞 Mia&apos;s Quiz</text>

      {/* the big sign in button */}
      <rect x="200" y="100" width="200" height="64" rx="14"
        fill="#E94B7E" stroke="#1B2A4E" strokeWidth="4" />
      <text x="300" y="142" textAnchor="middle"
        fontFamily="Fredoka,sans-serif" fontSize="22" fontWeight="700"
        fill="#FFFFFF">🔐 Sign in</text>
      <path d="M 280 200 Q 290 180 300 168" stroke="#1B2A4E" strokeWidth="3" fill="none" markerEnd="url(#arr2)" />
      <text x="320" y="208" fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#C9296A">click this!</text>
      <Arrow2 />
    </svg>
  );
}

function MockEmailEntry() {
  return (
    <svg viewBox="0 0 600 240" className="w-full h-auto" aria-hidden>
      <rect width="600" height="240" fill="#F4FAFF" />
      <rect x="120" y="20" width="360" height="200" rx="14"
        fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="3" />
      <text x="300" y="50" textAnchor="middle"
        fontFamily="Fredoka,sans-serif" fontSize="16" fontWeight="700" fill="#1B2A4E">Welcome back</text>
      <text x="300" y="72" textAnchor="middle"
        fontFamily="Quicksand,sans-serif" fontSize="11" fill="#3B4A7E">Enter your email to continue</text>

      <text x="150" y="105" fontFamily="Fredoka,sans-serif" fontSize="11" fontWeight="700" fill="#1B2A4E">Email address</text>
      <rect x="150" y="115" width="300" height="40" rx="8"
        fill="#FFFAE0" stroke="#E94B7E" strokeWidth="3" />
      <text x="160" y="140" fontFamily="Quicksand,sans-serif" fontSize="13" fill="#1B2A4E">your.email@example.com</text>

      <rect x="150" y="170" width="300" height="38" rx="8"
        fill="#E94B7E" stroke="#1B2A4E" strokeWidth="3" />
      <text x="300" y="194" textAnchor="middle"
        fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#FFFFFF">Continue →</text>
      <Arrow2 />
    </svg>
  );
}

function MockEmailInbox() {
  return (
    <svg viewBox="0 0 600 220" className="w-full h-auto" aria-hidden>
      <rect width="600" height="220" fill="#F4FAFF" />
      <rect x="20" y="20" width="560" height="180" rx="12"
        fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="3" />
      <text x="40" y="48" fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#1B2A4E">📧 Inbox</text>
      <line x1="40" y1="58" x2="560" y2="58" stroke="#B7E5FF" strokeWidth="2" />

      {/* highlighted message */}
      <rect x="40" y="68" width="520" height="60" rx="10"
        fill="#FFFAE0" stroke="#E94B7E" strokeWidth="3" />
      <text x="60" y="92" fontFamily="Fredoka,sans-serif" fontSize="13" fontWeight="700" fill="#1B2A4E">MiaAuth</text>
      <text x="60" y="112" fontFamily="Fredoka,sans-serif" fontSize="14" fill="#1B2A4E">Your sign-in code: <tspan fontWeight="700" fontSize="18" fill="#C9296A">529 047</tspan></text>

      <rect x="40" y="138" width="520" height="44" rx="8"
        fill="#FFFFFF" stroke="#3B4A7E" strokeWidth="1" />
      <text x="60" y="164" fontFamily="Quicksand,sans-serif" fontSize="11" fill="#3B4A7E">…other emails…</text>

      <path d="M 30 100 Q 36 100 38 100" stroke="#E94B7E" strokeWidth="3" fill="none" markerEnd="url(#arr2)" />
      <text x="100" y="40" fontFamily="Fredoka,sans-serif" fontSize="13" fontWeight="700" fill="#C9296A">copy the 6 digits ↓</text>
      <Arrow2 />
    </svg>
  );
}

function MockCodeEntry() {
  return (
    <svg viewBox="0 0 600 220" className="w-full h-auto" aria-hidden>
      <rect width="600" height="220" fill="#F4FAFF" />
      <rect x="120" y="20" width="360" height="180" rx="14"
        fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="3" />
      <text x="300" y="50" textAnchor="middle"
        fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#1B2A4E">Enter your code</text>
      <text x="300" y="70" textAnchor="middle"
        fontFamily="Quicksand,sans-serif" fontSize="11" fill="#3B4A7E">Sent to your email</text>

      {/* 6 boxes */}
      {[0,1,2,3,4,5].map((i) => (
        <g key={i}>
          <rect x={150 + i*50} y="95" width="40" height="50" rx="8"
            fill={i < 4 ? "#FFFAE0" : "#FFFFFF"}
            stroke={i === 4 ? "#E94B7E" : "#1B2A4E"}
            strokeWidth={i === 4 ? "3" : "2"} />
          {i < 4 && (
            <text x={170 + i*50} y="130" textAnchor="middle"
              fontFamily="Fredoka,sans-serif" fontSize="22" fontWeight="700" fill="#1B2A4E">
              {["5","2","9","0"][i]}
            </text>
          )}
        </g>
      ))}
      <text x="300" y="170" textAnchor="middle" fontFamily="Quicksand,sans-serif" fontSize="11" fill="#3B4A7E">type each digit, it auto-advances</text>
      <Arrow2 />
    </svg>
  );
}

function MockSignedIn() {
  return (
    <svg viewBox="0 0 600 220" className="w-full h-auto" aria-hidden>
      <rect width="600" height="220" fill="#B7E5FF" />
      <rect x="0" y="0" width="600" height="60" fill="#FFFFFF" stroke="#1B2A4E" strokeWidth="3" />
      <text x="20" y="38" fontFamily="Fredoka,sans-serif" fontWeight="700" fontSize="18" fill="#1B2A4E">🌞 Mia&apos;s Quiz</text>

      {/* avatar in top right */}
      <circle cx="555" cy="30" r="18" fill="#FFD93D" stroke="#1B2A4E" strokeWidth="3" />
      <text x="555" y="36" textAnchor="middle" fontFamily="Fredoka,sans-serif" fontSize="13" fontWeight="700" fill="#1B2A4E">M</text>
      <path d="M 555 90 Q 550 70 555 50" stroke="#E94B7E" strokeWidth="3" fill="none" markerEnd="url(#arr2)" />
      <text x="430" y="115" fontFamily="Fredoka,sans-serif" fontSize="14" fontWeight="700" fill="#C9296A">your initial here = signed in!</text>

      <text x="300" y="170" textAnchor="middle" fontFamily="Fredoka,sans-serif" fontSize="22" fontWeight="700" fill="#1B2A4E">🎉 You&apos;re in</text>
      <Arrow2 />
    </svg>
  );
}

function Arrow2() {
  return (
    <defs>
      <marker id="arr2" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto" markerUnits="strokeWidth">
        <path d="M 0 0 L 12 6 L 0 12 L 4 6 Z" fill="#E94B7E" />
      </marker>
    </defs>
  );
}
