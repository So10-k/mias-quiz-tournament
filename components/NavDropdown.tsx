"use client";

// Tiny self-contained dropdown for the nav's "More" menu.
// Opens on click, closes on outside-click, escape key, or any link
// click inside the panel. Renders the trigger as a `pop pop-white`
// button so it visually matches the rest of the nav chiclets.

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  label: string;
  children: ReactNode;
  // Optional alignment; default = right-anchored.
  align?: "left" | "right";
};

export function NavDropdown({ label, children, align = "right" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        className="pop pop-white text-base px-3 py-2 rounded-xl"
      >
        {label} <span aria-hidden>▾</span>
      </button>
      {open ? (
        <div
          // Click-anywhere-inside closes the dropdown — covers the
          // "user clicked a Link" case without per-child wiring.
          onClick={() => setOpen(false)}
          className={
            "absolute mt-2 z-30 card-sm bg-white px-2 py-2 flex flex-col gap-1 min-w-[180px] " +
            (align === "right" ? "right-0" : "left-0")
          }
          style={{ boxShadow: "5px 5px 0 0 var(--navy)" }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
