import Link from "next/link";
import { currentUser } from "@/lib/session";
import { AUTHOR_NAME } from "@/lib/author";

const linkBase = "pop pop-white text-base px-3 py-2 rounded-xl";

export async function Nav() {
  const user = await currentUser();
  const isHost = user?.role === "author";

  return (
    <header className="relative z-20 px-4 md:px-7 pt-4">
      <nav className="card-sm flex items-center justify-between gap-2 px-3 py-2 md:px-5 md:py-3">
        <Link
          href="/"
          className="font-display text-lg md:text-xl text-navy hover:text-coral transition-colors flex items-center gap-2"
        >
          <span className="text-2xl">🌞</span>
          <span>{AUTHOR_NAME}&rsquo;s Quiz</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className={linkBase}>Home</Link>
          {user ? (
            <Link href="/play" className={linkBase}>Play</Link>
          ) : (
            <Link href="/signin" className="pop pop-coral text-base px-3 py-2 rounded-xl">Sign In</Link>
          )}
          <Link href="/bracket" className={linkBase}>Bracket</Link>
          <Link href="/players" className={linkBase}>Players</Link>
          <Link href="/standings" className={linkBase}>Standings</Link>
          {isHost ? (
            <Link href="/host" className="pop pop-yellow text-base px-3 py-2 rounded-xl">🛠️ Host</Link>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
