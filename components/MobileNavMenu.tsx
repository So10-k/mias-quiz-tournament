"use client";

import { useEffect, useState, type ReactNode } from "react";

// Mobile-only nav drawer. Renders a hamburger button on small screens; on
// click, slides in a left-side sidebar containing the link list (passed in
// as `children` from the server-rendered Nav). Desktop screens see neither
// the button nor the drawer — server component handles the inline link
// layout there.
export function MobileNavMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Body scroll lock while drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="md:hidden flex flex-col items-center justify-center gap-1.5 w-10 h-10 rounded-xl border-3 border-navy bg-white shadow-pop-sm active:translate-y-0.5 active:shadow-none transition-transform"
      >
        <span className="block w-5 h-0.5 bg-navy rounded" />
        <span className="block w-5 h-0.5 bg-navy rounded" />
        <span className="block w-5 h-0.5 bg-navy rounded" />
      </button>

      {open ? (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-navy/40 z-40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Drawer */}
          <aside
            className="md:hidden fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white z-50 flex flex-col shadow-pop"
            style={{
              borderRight: "4px solid var(--navy)",
              animation: "slideInLeft 220ms cubic-bezier(.2,.8,.3,1)",
            }}
            role="dialog"
            aria-label="Navigation"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b-3 border-navy bg-sky1">
              <span className="font-display text-xl text-navy flex items-center gap-2">
                <span className="text-2xl">🌞</span>
                Menu
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="w-9 h-9 rounded-lg border-3 border-navy bg-white shadow-pop-sm font-display text-navy text-lg active:translate-y-0.5 active:shadow-none"
              >
                ✕
              </button>
            </div>
            {/* The link list. Wrap with onClick to auto-close after any nav. */}
            <div
              className="flex-1 overflow-y-auto p-5 flex flex-col gap-2"
              onClick={() => setOpen(false)}
            >
              {children}
            </div>
          </aside>
          <style>{`
            @keyframes slideInLeft {
              from { transform: translateX(-100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </>
      ) : null}
    </>
  );
}
