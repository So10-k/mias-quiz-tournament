"use client";

import { useState, useTransition } from "react";
import {
  deleteFileAction,
  updateFileAction,
} from "@/app/host/files/actions";

type Mode = "public" | "login" | "users" | "password";

type Props = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  accessMode: Mode;
  hasPassword: boolean;
  allowedEmails: string | null;
  allowDownload: boolean;
  note: string | null;
  origin: string; // window.location.origin, passed from server
};

const ACCESS_LABEL: Record<Mode, string> = {
  public: "🌍 Public",
  login: "🔐 Anyone signed in",
  users: "👥 Specific players",
  password: "🔑 Password",
};

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function FileRow(props: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(props.accessMode);
  const [emails, setEmails] = useState(props.allowedEmails ?? "");
  const [allowDownload, setAllowDownload] = useState(props.allowDownload);
  const [newPassword, setNewPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [note, setNote] = useState(props.note ?? "");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const viewerUrl = `${props.origin}/files/${props.id}`;
  const rawUrl = `${props.origin}/r/${props.id}`;
  const downloadUrl = `${props.origin}/r/${props.id}?download=1`;

  const copy = (s: string) => {
    navigator.clipboard?.writeText(s).catch(() => {});
    setFeedback(`Copied: ${s.length > 50 ? s.slice(0, 50) + "…" : s}`);
    setTimeout(() => setFeedback(null), 1500);
  };

  const save = () =>
    startTransition(async () => {
      try {
        await updateFileAction({
          id: props.id,
          accessMode: mode,
          allowedEmails: mode === "users" ? emails : null,
          allowDownload,
          note: note.trim() ? note : null,
          newPassword:
            mode !== "password"
              ? null
              : newPassword
              ? newPassword
              : clearPassword
              ? null
              : undefined,
        });
        setNewPassword("");
        setClearPassword(false);
        setFeedback("✓ Saved");
        setTimeout(() => setFeedback(null), 1500);
      } catch (e: any) {
        setFeedback(`⚠️ ${e?.message ?? "save failed"}`);
      }
    });

  const remove = () =>
    startTransition(async () => {
      if (!confirm(`Delete "${props.originalName}"? This can't be undone.`)) return;
      await deleteFileAction(props.id);
    });

  return (
    <li className="card-sm bg-white px-5 py-4 flex flex-col gap-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <FileIcon mime={props.mimeType} />
        <a
          href={viewerUrl}
          target="_blank"
          rel="noreferrer"
          className="font-display text-lg text-navy hover:text-coral-deep underline-offset-4 hover:underline truncate flex-1 min-w-0"
        >
          {props.originalName}
        </a>
        <span className="font-display text-xs text-white bg-navy border-2 border-navy rounded-md px-2 py-0.5">
          {ACCESS_LABEL[props.accessMode]}
        </span>
        <span className="font-body text-xs text-navy-soft whitespace-nowrap">
          {fmtSize(props.size)}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="pop pop-white text-xs"
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => copy(viewerUrl)}
          className="px-2 py-1 rounded-md border-2 border-navy bg-sun text-navy font-display"
        >
          📋 viewer link
        </button>
        <button
          type="button"
          onClick={() => copy(rawUrl)}
          className="px-2 py-1 rounded-md border-2 border-navy bg-sky2 text-white font-display"
        >
          📋 raw URL
        </button>
        {props.allowDownload ? (
          <a
            href={downloadUrl}
            className="px-2 py-1 rounded-md border-2 border-navy bg-grass text-white font-display"
          >
            ⬇ download
          </a>
        ) : null}
        {feedback ? (
          <span className="font-body text-navy-soft self-center">
            {feedback}
          </span>
        ) : null}
      </div>

      {open ? (
        <div className="flex flex-col gap-3 pt-2">
          <label className="flex flex-col gap-1">
            <span className="font-display text-sm text-navy">
              Who can view this file?
            </span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="px-3 py-2 bg-white border-2 border-navy rounded-md font-body text-sm"
            >
              <option value="public">🌍 Anyone with the link</option>
              <option value="login">🔐 Anyone signed in</option>
              <option value="users">👥 Only specific players (by email)</option>
              <option value="password">🔑 Password-protected</option>
            </select>
          </label>

          {mode === "users" ? (
            <label className="flex flex-col gap-1">
              <span className="font-display text-sm text-navy">
                Allowed emails (commas or new lines)
              </span>
              <textarea
                rows={3}
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder={"alice@example.com,\nbob@example.com"}
              />
            </label>
          ) : null}

          {mode === "password" ? (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="font-display text-sm text-navy">
                  {props.hasPassword ? "Change password" : "Set password"}
                </span>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={
                    props.hasPassword ? "(leave blank to keep current)" : "shareable password"
                  }
                />
              </label>
              {props.hasPassword ? (
                <label className="font-body text-sm text-navy-soft flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={clearPassword}
                    onChange={(e) => setClearPassword(e.target.checked)}
                  />
                  Clear the saved password (mode stays password)
                </label>
              ) : null}
            </div>
          ) : null}

          <label className="font-body text-sm text-navy flex items-center gap-2">
            <input
              type="checkbox"
              checked={allowDownload}
              onChange={(e) => setAllowDownload(e.target.checked)}
            />
            Allow downloads (otherwise viewers can only view)
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-display text-sm text-navy">
              Note (optional, shown to viewers)
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="e.g. The illustration draft for chapter 1"
            />
          </label>

          <div className="flex flex-wrap gap-2 mt-1">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="pop pop-coral text-sm"
            >
              {pending ? "Saving…" : "💾 Save changes"}
            </button>
            <button
              type="button"
              onClick={remove}
              className="pop pop-danger text-sm"
            >
              🗑 Delete file
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function FileIcon({ mime }: { mime: string }) {
  const e = mime.startsWith("image/")
    ? "🖼"
    : mime === "application/pdf"
    ? "📄"
    : mime.startsWith("video/")
    ? "🎬"
    : mime.startsWith("audio/")
    ? "🎵"
    : mime.startsWith("text/")
    ? "📝"
    : "📦";
  return <span aria-hidden className="text-2xl">{e}</span>;
}
