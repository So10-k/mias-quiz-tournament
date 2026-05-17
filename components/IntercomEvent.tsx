"use client";

// Tiny render-free component you drop anywhere to fire a single
// Intercom trackEvent on mount. Used after meaningful user actions
// (made a prediction, registered for finals, etc.) where you can't
// easily reach for `window.Intercom` from a server action.
//
// Usage:
//   <IntercomEvent name="made_prediction" metadata={{ matchupId }} />
//
// Renders nothing. Idempotent per mount; React keys the component
// from its parent if you want re-fires.

import { useEffect } from "react";

export function IntercomEvent({
  name,
  metadata,
}: {
  name: string;
  metadata?: Record<string, unknown>;
}) {
  useEffect(() => {
    let attempts = 0;
    const tick = () => {
      attempts++;
      if (
        typeof window === "undefined" ||
        typeof window.Intercom !== "function"
      ) {
        if (attempts < 30) setTimeout(tick, 200);
        return;
      }
      try {
        if (metadata && Object.keys(metadata).length > 0) {
          window.Intercom("trackEvent", name, metadata);
        } else {
          window.Intercom("trackEvent", name);
        }
      } catch {
        /* swallow */
      }
    };
    tick();
  }, [name, metadata]);

  return null;
}
