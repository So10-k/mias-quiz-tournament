import Link from "next/link";
import { Stage } from "./Stage";

// Shown to non-authors when the host has flipped a public page off — keeps
// the picture-book vibe instead of a 404 / "this is broken" feeling.
export function PageLockedNotice({
  title,
  emoji = "🔒",
  note,
}: {
  title: string;
  emoji?: string;
  note?: string;
}) {
  return (
    <Stage>
      <div className="h-[calc(100vh-128px)] flex items-center justify-center px-4">
        <div className="card px-7 py-7 text-center max-w-md">
          <div className="text-6xl">{emoji}</div>
          <h1 className="font-display text-3xl text-navy mt-3">
            {title} is paused
          </h1>
          <p className="font-body text-lg text-navy-soft mt-3">
            {note ??
              "Mia & Sam closed this view for a bit — it'll be back open after the next round."}
          </p>
          <Link href="/play" className="pop pop-coral mt-7 inline-flex">
            ← Play
          </Link>
        </div>
      </div>
    </Stage>
  );
}
