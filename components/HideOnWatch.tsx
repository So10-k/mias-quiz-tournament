"use client";

// Renders nothing when the current route is /watch. Used to suppress
// layout-level chrome (site announcement banner, Intercom messenger
// launcher) from the broadcast scene so the TV behind the hosts +
// any full-frame cutaway stays clean.

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function HideOnWatch({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path === "/watch" || path?.startsWith("/watch/")) return null;
  return <>{children}</>;
}
