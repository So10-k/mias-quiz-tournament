"use client";

import { useEffect, useRef, useState } from "react";

// PDF viewer with a custom picture-book toolbar. We hand the heavy
// rendering to the browser's built-in PDF stack via an iframe (works on
// Chrome/Firefox/Safari/iOS Safari) and overlay our own controls for
// zoom, fullscreen, and (optionally) download.
//
// We don't reimplement page navigation — the native viewer already exposes
// scroll/keyboard/touch gestures. Search is left to the browser viewer
// where supported.
export function PdfViewer({
  src,
  name,
  allowDownload,
  downloadHref,
}: {
  src: string;
  name: string;
  allowDownload: boolean;
  downloadHref: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fs, setFs] = useState(false);

  // We hint the native viewer with #zoom params. Some viewers honor them
  // (Chrome, Firefox PDF.js); Safari ignores. The `transform: scale` on
  // the wrapper picks up the slack on Safari.
  const url = `${src}#view=FitH&zoom=${Math.round(zoom * 100)}`;

  useEffect(() => {
    const onChange = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      try {
        await el.requestFullscreen();
      } catch {
        /* ignore */
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div ref={wrapRef} className="card bg-white p-3 flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
          className="px-3 py-1 rounded-md border-2 border-navy bg-sun text-navy font-display text-sm"
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="font-display text-sm text-navy w-14 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
          className="px-3 py-1 rounded-md border-2 border-navy bg-sun text-navy font-display text-sm"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="pop pop-white text-xs"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="pop pop-white text-xs"
        >
          {fs ? "↘ Exit fullscreen" : "↗ Fullscreen"}
        </button>
        <span className="flex-1" />
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="pop pop-white text-xs"
        >
          🗗 Open in new tab
        </a>
        {allowDownload ? (
          <a href={downloadHref} className="pop pop-grass text-xs">
            ⬇ Download
          </a>
        ) : null}
      </div>

      {/* Canvas — uses object so file URLs that need auth still get cookies. */}
      <div
        className="w-full bg-cloud border-3 border-navy rounded-md overflow-hidden"
        style={{
          height: fs ? "calc(100vh - 64px)" : "min(80vh, 900px)",
          // Some browsers ignore #zoom; this is the visual fallback.
          // We keep transform-origin top so it doesn't scroll out of view.
        }}
      >
        <object
          data={url}
          type="application/pdf"
          aria-label={name}
          width="100%"
          height="100%"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
            display: "block",
          }}
        >
          <div className="p-5">
            <p className="font-body text-sm text-navy">
              Your browser can&rsquo;t embed PDFs.{" "}
              <a
                className="text-coral-deep underline"
                href={src}
                target="_blank"
                rel="noreferrer"
              >
                Open in a new tab
              </a>
              {allowDownload ? (
                <>
                  {" "}
                  or{" "}
                  <a
                    className="text-coral-deep underline"
                    href={downloadHref}
                  >
                    download it
                  </a>
                </>
              ) : null}
              .
            </p>
          </div>
        </object>
      </div>
    </div>
  );
}
