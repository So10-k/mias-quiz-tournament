"use client";

// Page-aware Intercom enrichment.
//
// Subscribes to App Router route changes via usePathname and on every
// change:
//   1. Pushes the current pathname + a routeName into intercomSettings
//      via Intercom("update", ...). Shows up in the contact sidebar
//      so ops can see "📍 currently on /play/round/3" at a glance.
//   2. Fires Intercom("trackEvent", "page_visited", { path }). Useful
//      for outbound triggers ("just visited /finals → send registration
//      nudge after 2 minutes").
//   3. Computes a contextual conversation starter for the page (e.g.
//      "I'm stuck on this round" on /play/round/N) and stashes it on
//      window.__miaIntercomStarter so the IntercomLauncher pre-fills
//      it when the user opens Messenger.
//
// This is purely client-side enrichment — no DOM.

import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    __miaIntercomStarter?: string;
  }
}

type PageMeta = {
  routeName: string;
  starter?: string;
};

function classifyPath(path: string): PageMeta {
  // /play/round/[n]
  const round = path.match(/^\/play\/round\/(\d+)/);
  if (round) {
    return {
      routeName: `Playing round ${round[1]}`,
      starter: `I'm playing round ${round[1]} and I'd like help with…`,
    };
  }

  // /play/live/[id]
  if (path.startsWith("/play/live/")) {
    return {
      routeName: "In a live round",
      starter: "I'm in a live round and I'd like help with…",
    };
  }

  // Top-of-route exact matches.
  switch (path) {
    case "/":
      return { routeName: "Homepage" };
    case "/finals":
      return {
        routeName: "Finals invitation page",
        starter: "Question about the Grand Final broadcast…",
      };
    case "/finals/registered":
      return {
        routeName: "Post-registration",
        starter: "Question about my registration…",
      };
    case "/finals/recap":
      return { routeName: "Post-broadcast recap" };
    case "/live":
      return {
        routeName: "🔴 Watching the broadcast",
        starter: "I have a question during the broadcast…",
      };
    case "/watch":
      return { routeName: "🔴 Watching the broadcast (spectator)" };
    case "/standings":
      return {
        routeName: "Standings / bracket",
        starter: "Question about the bracket…",
      };
    case "/predictions":
      return {
        routeName: "Predictions",
        starter: "Question about how predictions work…",
      };
    case "/qotd":
      return { routeName: "Question of the Day" };
    case "/support":
      return {
        routeName: "Support portal",
        starter: "I need help with…",
      };
    case "/signin":
      return {
        routeName: "Sign-in page",
        starter: "I'm having trouble signing in…",
      };
    case "/finals-guide":
      return { routeName: "Finals guide" };
    case "/forum-guide":
      return { routeName: "Forum guide" };
  }

  if (path.startsWith("/play/practice")) return { routeName: "Practice round" };
  if (path.startsWith("/blog")) return { routeName: "Reading the blog" };
  if (path.startsWith("/forms")) return { routeName: "Filling out a form" };
  if (path.startsWith("/host"))
    return { routeName: "Host dashboard (internal)" };
  if (path.startsWith("/writing-session"))
    return { routeName: "Writing-session collaborator" };

  return { routeName: path };
}

function intercomReady(): boolean {
  return (
    typeof window !== "undefined" && typeof window.Intercom === "function"
  );
}

export function IntercomTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const meta = classifyPath(pathname);

    // Stash the starter on the window so IntercomLauncher can read
    // it on click without re-rendering.
    window.__miaIntercomStarter = meta.starter;

    // Wait for Intercom to be ready. Poll briefly — the SDK boots
    // a fraction of a second after the page mounts.
    let attempts = 0;
    const tick = () => {
      attempts++;
      if (!intercomReady()) {
        if (attempts < 30) setTimeout(tick, 200);
        return;
      }
      try {
        window.Intercom!("update", {
          current_path: pathname,
          current_route_name: meta.routeName,
        });
        window.Intercom!("trackEvent", "page_visited", {
          path: pathname,
          route_name: meta.routeName,
        });
      } catch {
        // Boot raced — drop the update; next route change will retry.
      }
    };
    tick();
  }, [pathname]);

  return null;
}
