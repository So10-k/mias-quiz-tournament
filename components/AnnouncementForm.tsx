"use client";

import { useEffect, useState, useTransition } from "react";
import {
  previewRecipients,
  sendAnnouncement,
  type AnnouncementResult,
} from "@/app/host/announce-actions";

const AUDIENCES = [
  { value: "still_in", label: "Players still in" },
  { value: "all", label: "All signed-up players" },
  { value: "eliminated", label: "Eliminated only" },
  { value: "all_users", label: "EVERY user (use with care)" },
] as const;

export function AnnouncementForm() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<
    "still_in" | "all" | "eliminated" | "all_users"
  >("still_in");
  const [confirmStage, setConfirmStage] = useState(false);
  const [preview, setPreview] = useState<{ count: number; emails: string[] }>({
    count: 0,
    emails: [],
  });
  const [result, setResult] = useState<AnnouncementResult | null>(null);
  const [pending, startTransition] = useTransition();

  // Refresh preview whenever the audience changes.
  useEffect(() => {
    startTransition(async () => {
      try {
        const p = await previewRecipients(audience);
        setPreview(p);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("preview failed", e);
      }
    });
  }, [audience]);

  const submit = async () => {
    setResult(null);
    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("body", body);
    fd.set("audience", audience);
    fd.set("confirm", "yes");
    startTransition(async () => {
      try {
        const r = await sendAnnouncement(fd);
        setResult(r);
        if (r.ok) {
          setSubject("");
          setBody("");
          setConfirmStage(false);
        }
      } catch (e: any) {
        setResult({
          ok: false,
          audience,
          recipientCount: 0,
          sentCount: 0,
          failedCount: 0,
          errors: [e?.message ?? "Send failed"],
          dryRun: false,
        });
      }
    });
  };

  const canDraft = subject.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-2">
        <span className="font-display text-lg text-navy">Audience</span>
        <select
          value={audience}
          onChange={(e) => {
            setConfirmStage(false);
            setAudience(e.target.value as any);
          }}
          className="px-3 py-2 bg-white border-3 border-navy rounded-md font-body text-base"
        >
          {AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <span className="font-body text-xs text-navy-soft">
          {pending && !result
            ? "Counting…"
            : preview.count === 0
            ? "0 recipients in that audience right now."
            : `${preview.count} recipient${preview.count === 1 ? "" : "s"}.`}
          {preview.count > 0
            ? ` First few: ${preview.emails
                .slice(0, 5)
                .map((e) => maskEmail(e))
                .join(", ")}${preview.count > 5 ? "…" : ""}`
            : ""}
        </span>
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-display text-lg text-navy">Subject</span>
        <input
          value={subject}
          onChange={(e) => {
            setConfirmStage(false);
            setSubject(e.target.value);
          }}
          maxLength={140}
          placeholder="e.g. The first round drops Saturday at 6pm"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-display text-lg text-navy">Message</span>
        <textarea
          value={body}
          onChange={(e) => {
            setConfirmStage(false);
            setBody(e.target.value);
          }}
          maxLength={8000}
          rows={8}
          placeholder={
            "Hi! Just a quick reminder…\n\nLinks (https://…) become tappable automatically.\nA blank line makes a new paragraph."
          }
        />
        <span className="font-body text-xs text-navy-soft">
          Plain text. URLs get linkified. Sent from{" "}
          <strong>Mia&rsquo;s Quiz Tournament</strong> with picture-book styling.
        </span>
      </label>

      {!confirmStage ? (
        <div>
          <button
            type="button"
            onClick={() => setConfirmStage(true)}
            disabled={!canDraft || preview.count === 0 || pending}
            className="pop pop-coral"
          >
            ✉️ Review &amp; send
          </button>
        </div>
      ) : (
        <div className="card-sm bg-sun px-5 py-4 flex flex-col gap-3">
          <p className="font-display text-lg text-navy">
            Send <strong>{subject}</strong> to{" "}
            <strong>
              {preview.count} {AUDIENCES.find((a) => a.value === audience)?.label}
            </strong>
            ?
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmStage(false)}
              className="pop pop-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="pop pop-coral"
            >
              {pending ? "Sending…" : "Yes, send it"}
            </button>
          </div>
        </div>
      )}

      {result ? (
        <div
          className={
            "card-sm px-5 py-3 " +
            (result.ok ? "bg-grass text-white" : "bg-coral-deep text-white")
          }
        >
          {result.ok ? (
            <p className="font-display">
              {result.dryRun
                ? `🔧 Dev mode — printed ${result.sentCount} email(s) to the server log (RESEND_API_KEY is empty).`
                : `✓ Sent ${result.sentCount} of ${result.recipientCount}!`}
              {result.failedCount > 0
                ? `  ${result.failedCount} failed.`
                : ""}
            </p>
          ) : (
            <div>
              <p className="font-display">⚠️ Send failed.</p>
              <ul className="font-body text-sm mt-2 list-disc ml-5">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function maskEmail(e: string) {
  const [user, domain] = e.split("@");
  if (!domain) return e;
  return `${user.slice(0, 2)}…@${domain}`;
}
