"use client";

import { useRef, useState } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "presigning"; filename: string }
  | { kind: "uploading"; filename: string; progress: number }
  | { kind: "finalizing"; filename: string }
  | { kind: "done"; filename: string }
  | { kind: "error"; message: string };

export function FileUploader({ onUploaded }: { onUploaded?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragActive, setDragActive] = useState(false);

  const upload = async (file: File) => {
    setStatus({ kind: "presigning", filename: file.name });
    let presign;
    try {
      const r = await fetch("/api/files/presign-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail ?? d.error ?? `presign ${r.status}`);
      }
      presign = (await r.json()) as { id: string; key: string; url: string };
    } catch (e: any) {
      setStatus({ kind: "error", message: e?.message ?? "presign failed" });
      return;
    }

    setStatus({ kind: "uploading", filename: file.name, progress: 0 });
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setStatus({
              kind: "uploading",
              filename: file.name,
              progress: ev.loaded / ev.total,
            });
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`upload ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("network error"));
        xhr.open("PUT", presign.url);
        xhr.setRequestHeader(
          "content-type",
          file.type || "application/octet-stream"
        );
        xhr.send(file);
      });
    } catch (e: any) {
      setStatus({ kind: "error", message: e?.message ?? "upload failed" });
      return;
    }

    setStatus({ kind: "finalizing", filename: file.name });
    try {
      const r = await fetch("/api/files/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: presign.id,
          storageKey: presign.key,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail ?? d.error ?? `finalize ${r.status}`);
      }
    } catch (e: any) {
      setStatus({ kind: "error", message: e?.message ?? "finalize failed" });
      return;
    }

    setStatus({ kind: "done", filename: file.name });
    onUploaded?.();
    // Auto-clear status after a moment
    setTimeout(() => setStatus({ kind: "idle" }), 1800);
  };

  const onPick = () => inputRef.current?.click();
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
    e.target.value = "";
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
      className={
        "card-sm bg-white px-5 py-7 flex flex-col items-center justify-center gap-3 border-dashed " +
        (dragActive ? "bg-sky1" : "")
      }
      style={{ borderStyle: "dashed" }}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onChange}
      />
      <p className="font-display text-lg text-navy">
        📤 Drop a file here, or
      </p>
      <button
        type="button"
        onClick={onPick}
        className="pop pop-coral"
        disabled={
          status.kind === "presigning" ||
          status.kind === "uploading" ||
          status.kind === "finalizing"
        }
      >
        Choose a file
      </button>
      <p className="font-body text-xs text-navy-soft">
        Up to 1 GB. Anything with a MIME type works — image, PDF, video,
        audio, doc, zip…
      </p>

      {status.kind !== "idle" ? (
        <div className="w-full mt-2">
          {status.kind === "uploading" ? (
            <div className="h-3 w-full rounded-full border-2 border-navy bg-white overflow-hidden">
              <div
                className="h-full bg-coral"
                style={{ width: `${Math.round(status.progress * 100)}%` }}
              />
            </div>
          ) : null}
          <p className="font-body text-sm text-navy mt-1">
            {status.kind === "presigning"
              ? `Asking R2 for a slot for ${status.filename}…`
              : status.kind === "uploading"
              ? `Uploading ${status.filename} — ${Math.round(status.progress * 100)}%`
              : status.kind === "finalizing"
              ? "Recording…"
              : status.kind === "done"
              ? `✓ ${status.filename} uploaded`
              : `⚠️ ${status.message}`}
          </p>
        </div>
      ) : null}
    </div>
  );
}
