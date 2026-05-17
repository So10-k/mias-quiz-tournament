"use client";

// Tappable triage card on /support. Two flavors:
//   • jsAction === "open-intercom"           → window.Intercom("show")
//   • jsAction === "open-intercom-articles"  → window.Intercom("showSpace","help")
//     (Intercom Help Center; falls back to a plain show if the
//      method isn't available — e.g. when Intercom hasn't loaded yet)
//   • scrollTo === "#ticket-form"            → smooth-scrolls to anchor

import { useEffect, useState } from "react";

type Props = {
  emoji: string;
  label: string;
  tagline: string;
  body: string;
  actionLabel: string;
  tone: string;
  primary?: boolean;
  jsAction?: "open-intercom" | "open-intercom-articles";
  scrollTo?: string;
};

export function SupportDoor(props: Props) {
  const [intercomReady, setIntercomReady] = useState(false);

  useEffect(() => {
    if (!props.jsAction) return;
    const tick = () => {
      if (typeof window !== "undefined" && typeof window.Intercom === "function") {
        setIntercomReady(true);
      } else {
        setTimeout(tick, 400);
      }
    };
    tick();
  }, [props.jsAction]);

  const handleClick = () => {
    if (props.scrollTo) {
      const el = document.querySelector(props.scrollTo);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (props.jsAction && typeof window.Intercom === "function") {
      if (props.jsAction === "open-intercom-articles") {
        // showSpace lands on the Help Center tab when configured.
        try {
          window.Intercom("showSpace", "help");
          return;
        } catch {
          /* fall through */
        }
      }
      window.Intercom("show");
    }
  };

  const disabled = !!props.jsAction && !intercomReady;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={
        `card px-5 py-5 text-left flex flex-col gap-2 border-4 ${props.tone} ` +
        (props.primary ? "shadow-pop" : "") +
        " hover:-translate-y-0.5 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
      }
    >
      <div className="text-4xl bob inline-block">{props.emoji}</div>
      <p
        className="font-display text-[10px] uppercase tracking-[0.22em] opacity-80"
      >
        {props.tagline}
      </p>
      <h2 className="font-display text-2xl leading-tight">{props.label}</h2>
      <p className="font-body text-sm leading-relaxed">{props.body}</p>
      <span className="font-display text-sm mt-1 underline-offset-4 underline">
        {disabled ? "Loading…" : props.actionLabel}
      </span>
    </button>
  );
}
