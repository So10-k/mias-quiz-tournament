"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Picture-book image viewer: inline preview that opens to a full-screen
// modal on click. Pinch-zoom on mobile is the browser's job — we don't
// fight it.
export function ImageViewer({
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
  const [open, setOpen] = useState(false);
  return (
    <div className="card bg-white p-3 flex flex-col gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        className="block w-full max-h-[70vh] object-contain rounded-md cursor-zoom-in bg-cloud border-3 border-navy"
        onClick={() => setOpen(true)}
        loading="lazy"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pop pop-yellow text-sm"
        >
          🔍 Open full-screen
        </button>
        {allowDownload ? (
          <a href={downloadHref} className="pop pop-grass text-sm">
            ⬇ Download
          </a>
        ) : null}
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(27, 42, 78, 0.85)" }}
            onClick={() => setOpen(false)}
          >
            <motion.img
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              src={src}
              alt={name}
              className="max-w-[96vw] max-h-[92vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-4 right-4 pop pop-white text-base"
            >
              ✕
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
