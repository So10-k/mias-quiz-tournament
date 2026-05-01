"use client";

import { useEffect, useState } from "react";

// Picture-book countdown card for /play and /. Updates locally every
// second so the seconds tick. Reads target/label from props (server fetched
// from app_settings).

type Props = { label: string; targetIso: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function partsFromMs(ms: number) {
  if (ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function CountdownCard({ label, targetIso }: Props) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = new Date(targetIso);
  const targetMs = isNaN(target.getTime()) ? null : target.getTime();
  const parts = targetMs !== null ? partsFromMs(targetMs - now) : null;
  const finished = targetMs !== null && targetMs <= now;
  const targetReadable =
    targetMs !== null
      ? new Date(targetMs).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";

  return (
    <div className="card-sm bg-white px-5 py-4 max-w-xl mx-auto w-full flex flex-col gap-3 items-center text-center">
      <p className="font-display text-xs text-coral-deep uppercase tracking-widest">
        ⏰ {label}
      </p>
      {!parts && !finished ? (
        <p className="font-display text-2xl text-navy">
          (countdown target not set)
        </p>
      ) : finished ? (
        <p className="font-display text-3xl text-coral-deep">⌛ Time&rsquo;s up!</p>
      ) : (
        <div className="flex gap-2 md:gap-3 justify-center">
          {[
            { v: pad(parts!.days), l: parts!.days === 1 ? "DAY" : "DAYS" },
            { v: pad(parts!.hours), l: "HRS" },
            { v: pad(parts!.minutes), l: "MIN" },
            { v: pad(parts!.seconds), l: "SEC" },
          ].map((c, i) => (
            <div
              key={i}
              className="bg-sun border-3 border-navy rounded-lg shadow-pop-sm px-3 py-2 min-w-[60px] md:min-w-[72px]"
            >
              <div className="font-display text-3xl md:text-4xl text-navy leading-none">
                {c.v}
              </div>
              <div className="font-display text-[10px] md:text-xs text-coral-deep tracking-wider mt-1">
                {c.l}
              </div>
            </div>
          ))}
        </div>
      )}
      {targetReadable && !finished ? (
        <p className="font-body text-xs text-navy-soft">
          {targetReadable}
        </p>
      ) : null}
    </div>
  );
}
