"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const STORAGE_KEY = "qsp_welcomed_v2";

// One-time "we're back" toast. Triggers the first time a browser visits the
// site after this component ships, then persists a localStorage flag so it
// never appears again on that device.
export function WelcomeBackToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // localStorage may be blocked (private mode); skip rather than nag.
      return;
    }
    const t = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="toast"
          initial={{ y: 80, opacity: 0, rotate: -1 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 80, opacity: 0, rotate: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-5 z-50 px-4 w-full max-w-md"
        >
          <div
            className="card-sm bg-cloud px-5 py-4 flex items-start gap-3"
            style={{ borderColor: "var(--navy)" }}
          >
            <div className="text-3xl">☀️</div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-lg text-navy leading-tight">
                We&rsquo;re back!
              </p>
              <p className="font-body text-sm text-navy mt-1">
                Sorry about the placeholder yesterday — the site is up and
                ready to run.
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className="pop pop-coral text-xs px-2 py-1"
            >
              Got it
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
