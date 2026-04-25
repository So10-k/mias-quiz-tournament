import { Inkblot } from "./ink/Inkblot";
import { EndStamp } from "./ink/Stamp";

type Props = {
  name: string;
  strikeCount: number;
  strikeLimit: number;
  eliminated: boolean;
  joinedChapter?: number | null;
  lastSeenChapter?: number | null;
  isWinner?: boolean;
};

export function ReaderCard({
  name,
  strikeCount,
  strikeLimit,
  eliminated,
  joinedChapter,
  lastSeenChapter,
  isWinner,
}: Props) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className={
        "relative border border-ink p-5 bg-paper " +
        (eliminated ? "sepia-card text-sepia" : "")
      }
    >
      <div className="flex items-center gap-5">
        {/* Monogram */}
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          aria-hidden="true"
          className="shrink-0"
        >
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <text
            x="32"
            y="42"
            textAnchor="middle"
            fontFamily="DM Serif Display, Georgia, serif"
            fontSize="32"
            fill="currentColor"
          >
            {initial}
          </text>
        </svg>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-h2 text-ink truncate">{name}</h3>
          <div className="mt-2 flex items-center gap-2">
            {Array.from({ length: strikeLimit }).map((_, i) => (
              <Inkblot
                key={i}
                size={18}
                filled={i < strikeCount}
                className={
                  i < strikeCount ? "text-accent-red" : "text-ink-muted"
                }
              />
            ))}
          </div>
          <p className="font-hand text-caption-md text-ink-muted mt-2">
            {joinedChapter
              ? `Joined chapter ${joinedChapter}.`
              : "Joined the book."}
            {lastSeenChapter ? ` Last seen chapter ${lastSeenChapter}.` : ""}
          </p>
        </div>
      </div>

      {eliminated ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <EndStamp size={220} className="text-accent-red opacity-90" />
        </div>
      ) : null}

      {isWinner ? (
        <p className="absolute -top-3 left-5 px-2 bg-paper font-hand text-caption-md text-accent-red">
          — the last reader standing —
        </p>
      ) : null}
    </div>
  );
}
