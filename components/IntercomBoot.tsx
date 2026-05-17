"use client";

// Boots the Intercom JS SDK and hides its default launcher so our
// custom picture-book launcher (components/IntercomLauncher.tsx)
// takes its place. Renders no DOM of its own — just side effects.

import { useEffect } from "react";

declare global {
  interface Window {
    // Intercom's loose-typed proxy. We declare a single overloaded
    // signature that accepts the typical (command, …args) call, plus
    // a permissive overload so the inline proxy below assigns
    // without TS getting upset about the intersection.
    Intercom?: {
      (command: string, ...args: unknown[]): void;
      (...args: unknown[]): void;
      q?: unknown[][];
      c?: (args: unknown[]) => void;
    };
    intercomSettings?: Record<string, unknown>;
  }
}

export function IntercomBoot({
  appId,
  settings,
}: {
  appId: string;
  settings: Record<string, unknown>;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Always hide Intercom's stock launcher — we draw our own.
    const merged = { ...settings, hide_default_launcher: true };
    window.intercomSettings = merged;

    // If the SDK has already been injected (e.g. by a prior render),
    // just push an `update` so the new settings + user id take effect.
    if (typeof window.Intercom === "function") {
      window.Intercom("update", merged);
      return;
    }

    // Standard Intercom snippet, inlined as a function so React's
    // strict-mode double-effect doesn't re-inject the script twice.
    const queue: unknown[][] = [];
    const proxy = function (...args: unknown[]) {
      queue.push(args);
    } as unknown as NonNullable<Window["Intercom"]>;
    proxy.q = queue;
    proxy.c = (args) => queue.push(args);
    window.Intercom = proxy;

    const s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = `https://widget.intercom.io/widget/${appId}`;
    document.head.appendChild(s);

    return () => {
      // Intentionally NOT removing the script on unmount — Intercom
      // is meant to be a singleton, and yanking it tears down the
      // conversation state.
    };
  }, [appId, settings]);

  return null;
}
