"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// One ping per route entry. Mounted in the root layout so every page in the
// app gets logged. The server enriches with IP/Vercel-geo headers and pairs
// the log to the signed-in user (if any).
export function VisitLogger() {
  const pathname = usePathname();

  useEffect(() => {
    // Cheap idle wait so we don't compete with TTI.
    const send = () => {
      try {
        const screen = `${window.screen?.width ?? 0}x${
          window.screen?.height ?? 0
        }@${window.devicePixelRatio ?? 1}`;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const lang =
          navigator.language ?? (navigator.languages?.[0] as string | undefined);
        fetch("/api/log/visit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            path: pathname || "/",
            referrer: document.referrer || null,
            timezone: tz || null,
            language: lang || null,
            screen,
          }),
          // keepalive lets the request finish even on navigation.
          keepalive: true,
          credentials: "same-origin",
        }).catch(() => {});
      } catch {
        // ignore
      }
    };
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(send, { timeout: 1500 });
    } else {
      const t = setTimeout(send, 200);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  return null;
}
