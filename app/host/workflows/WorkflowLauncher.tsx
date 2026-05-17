"use client";

// "Initiate task" button — opens an OS-level popup browser window
// (not an in-page modal). The popup loads /host/workflows/launch
// where the picker UI lives. On submit, that page's action redirects
// to /host/workflows/launch/done which calls window.opener.reload()
// + window.close() so the parent dashboard picks up the new running
// task immediately.

import { useCallback } from "react";

export function WorkflowLauncher() {
  const open = useCallback(() => {
    const url = "/host/workflows/launch";
    const features = [
      "width=760",
      "height=760",
      "menubar=no",
      "toolbar=no",
      "location=no",
      "status=no",
      "scrollbars=yes",
      "resizable=yes",
    ].join(",");
    const win = window.open(url, "wf_launcher", features);
    if (!win) {
      // Popup blocked — fall back to full-page navigation.
      window.location.href = url;
      return;
    }
    win.focus();
  }, []);

  return (
    <button
      type="button"
      onClick={open}
      className="pop pop-coral text-base px-5 py-3"
      style={{ boxShadow: "6px 6px 0 #1B2A4E" }}
    >
      ⚡ Initiate task
    </button>
  );
}
