"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the current server component every `seconds`. Used by host
// pages that want a near-live feed without standing up SSE/WebSockets.
export function AutoRefresh({ seconds = 8 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
