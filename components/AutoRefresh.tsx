"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the current server component every `seconds`. Used by host /
// staff pages that want a near-live feed without standing up SSE/WebSockets.
//
// Important: pauses when the tab isn't visible. Without this, every open
// staff tab keeps hammering the RSC endpoint in the background — a few open
// tabs × every-20s × multi-DB-query renders is enough to look bot-like to
// Vercel's auto-mitigation. We've been locked out by it. Page Visibility
// API guards against that: hidden tabs are silent, foreground tabs refresh
// on the configured cadence AND immediately on visibility change so the
// feed feels live the moment you switch back.
export function AutoRefresh({ seconds = 8 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => {
        router.refresh();
      }, seconds * 1000);
    }
    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        // Refresh once on focus so the feed is current immediately, then
        // resume the interval.
        router.refresh();
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router, seconds]);
  return null;
}
