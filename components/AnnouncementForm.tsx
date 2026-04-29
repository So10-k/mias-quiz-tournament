"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  getAudienceUniverse,
  previewRecipients,
  sendAnnouncement,
  type AnnouncementResult,
} from "@/app/host/announce-actions";
import {
  AUDIENCE_LABELS,
  AUDIENCE_MODES,
  ROUND_AUDIENCE_MODES as ROUND_MODES,
  type AudienceFilter,
  type AudienceMode,
  type AudienceUniverse,
} from "@/lib/audience";
import {
  applyMergeVars,
  getTemplate,
  listTemplateMeta,
  MERGE_VARS,
  recipientMergeValues,
  type EmailTemplateMeta,
} from "@/lib/email-templates";

const TEMPLATES: EmailTemplateMeta[] = listTemplateMeta();

const PLAIN_TEXT = "" as const;

function defaultsFor(template: EmailTemplateMeta): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of template.fields) out[f.key] = f.defaultValue;
  return out;
}

export function AnnouncementForm() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<AudienceMode>("still_in");
  const [roundId, setRoundId] = useState<string>("");
  const [strikes, setStrikes] = useState<number>(1);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [universe, setUniverse] = useState<AudienceUniverse>({
    rounds: [],
    players: [],
  });
  const [templateId, setTemplateId] = useState<string>(PLAIN_TEXT);
  const [templateFields, setTemplateFields] = useState<Record<string, string>>(
    {}
  );
  const [confirmStage, setConfirmStage] = useState(false);
  const [preview, setPreview] = useState<{ count: number; emails: string[] }>({
    count: 0,
    emails: [],
  });
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState<AnnouncementResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [playerFilter, setPlayerFilter] = useState("");

  const activeTemplate = useMemo(
    () => (templateId ? TEMPLATES.find((t) => t.id === templateId) ?? null : null),
    [templateId]
  );

  // Build the current AudienceFilter object based on mode + secondary fields.
  const audienceFilter = useMemo<AudienceFilter | null>(() => {
    switch (mode) {
      case "still_in":
      case "eliminated":
      case "all":
      case "all_users":
        return { mode };
      case "with_strikes":
        return { mode: "with_strikes", strikes };
      case "specific": {
        const ids = [...picked];
        return ids.length > 0
          ? { mode: "specific", userIds: ids }
          : null;
      }
      case "eliminated_in_round":
      case "survived_round":
      case "no_submit_in_round":
        return roundId
          ? ({ mode, roundId } as AudienceFilter)
          : null;
    }
  }, [mode, strikes, roundId, picked]);

  // Load the universe of rounds + players once on mount.
  useEffect(() => {
    (async () => {
      try {
        const u = await getAudienceUniverse();
        setUniverse(u);
        if (!roundId && u.rounds.length > 0) {
          // Default round = highest-numbered real round.
          const real = u.rounds.filter((r) => !r.isPractice);
          setRoundId((real[real.length - 1] ?? u.rounds[u.rounds.length - 1])?.id);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("universe load failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh recipient preview whenever the resolved filter changes.
  useEffect(() => {
    if (!audienceFilter) {
      setPreview({ count: 0, emails: [] });
      return;
    }
    startTransition(async () => {
      try {
        const p = await previewRecipients(audienceFilter);
        setPreview(p);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("preview failed", e);
      }
    });
  }, [audienceFilter]);

  // Render the HTML preview client-side — the template module is pure
  // string templating, no server roundtrip needed. Merge variables get
  // sample values so the host sees a realistic personalised render.
  useEffect(() => {
    if (!activeTemplate) {
      setPreviewHtml("");
      return;
    }
    const full = getTemplate(activeTemplate.id);
    if (!full) {
      setPreviewHtml("");
      return;
    }
    const sampleVars = recipientMergeValues({
      name: preview.emails[0] ? "Marc Liss" : "Marc Liss",
      email: preview.emails[0] ?? "marc@example.com",
    });
    const rendered = full.render({ subject, fields: templateFields });
    setPreviewHtml(applyMergeVars(rendered.html, sampleVars, true));
  }, [activeTemplate, subject, templateFields, preview.emails]);

  const onTemplateChange = (next: string) => {
    setConfirmStage(false);
    setResult(null);
    setTemplateId(next);
    if (!next) {
      setTemplateFields({});
      return;
    }
    const t = TEMPLATES.find((x) => x.id === next);
    if (!t) return;
    setTemplateFields(defaultsFor(t));
    if (!subject.trim()) setSubject(t.defaultSubject);
    setShowPreview(true);
  };

  const setField = (key: string, value: string) => {
    setConfirmStage(false);
    setTemplateFields((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    if (!audienceFilter) return;
    setResult(null);
    const fd = new FormData();
    fd.set("subject", subject);
    fd.set("body", body);
    fd.set("audience", JSON.stringify(audienceFilter));
    fd.set("confirm", "yes");
    if (templateId) {
      fd.set("templateId", templateId);
      fd.set("templateFields", JSON.stringify(templateFields));
    }
    startTransition(async () => {
      try {
        const r = await sendAnnouncement(fd);
        setResult(r);
        if (r.ok) {
          setSubject("");
          setBody("");
          setTemplateId(PLAIN_TEXT);
          setTemplateFields({});
          setConfirmStage(false);
        }
      } catch (e: any) {
        setResult({
          ok: false,
          audience: mode,
          recipientCount: 0,
          sentCount: 0,
          failedCount: 0,
          errors: [e?.message ?? "Send failed"],
          dryRun: false,
        });
      }
    });
  };

  const canDraft =
    subject.trim().length > 0 &&
    (activeTemplate ? true : body.trim().length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="card-sm bg-white px-4 py-3 flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="font-display text-lg text-navy">Audience</span>
          <select
            value={mode}
            onChange={(e) => {
              setConfirmStage(false);
              setMode(e.target.value as AudienceMode);
            }}
            className="px-3 py-2 bg-white border-3 border-navy rounded-md font-body text-base"
          >
            {AUDIENCE_MODES.map((m) => (
              <option key={m} value={m}>
                {AUDIENCE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        {ROUND_MODES.includes(mode) ? (
          <label className="flex flex-col gap-1">
            <span className="font-display text-sm text-navy">Round</span>
            <select
              value={roundId}
              onChange={(e) => {
                setConfirmStage(false);
                setRoundId(e.target.value);
              }}
              className="px-3 py-2 bg-white border-3 border-navy rounded-md font-body text-base"
            >
              <option value="">— pick a round —</option>
              {universe.rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.isPractice ? "🎯 Practice" : "Round"} {r.chapterNumber}:{" "}
                  {r.title}
                  {r.status !== "active" ? ` (${r.status})` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {mode === "with_strikes" ? (
          <label className="flex flex-col gap-1">
            <span className="font-display text-sm text-navy">Strike count</span>
            <input
              type="number"
              min={0}
              max={10}
              value={strikes}
              onChange={(e) => {
                setConfirmStage(false);
                setStrikes(Math.max(0, Math.floor(Number(e.target.value) || 0)));
              }}
              className="px-3 py-2 bg-white border-3 border-navy rounded-md font-body text-base w-32"
            />
            <span className="font-body text-xs text-navy-soft">
              People with exactly this many strikes recorded.
            </span>
          </label>
        ) : null}

        {mode === "specific" ? (
          <div className="flex flex-col gap-2">
            <span className="font-display text-sm text-navy">
              Pick players ({picked.size} selected)
            </span>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setConfirmStage(false);
                  setPicked(new Set(universe.players.map((p) => p.userId)));
                }}
                className="pop pop-white text-xs"
              >
                Select all enrolled
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmStage(false);
                  setPicked(
                    new Set(
                      universe.players
                        .filter((p) => !p.eliminatedAt)
                        .map((p) => p.userId)
                    )
                  );
                }}
                className="pop pop-white text-xs"
              >
                + still in
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmStage(false);
                  setPicked(
                    new Set(
                      universe.players
                        .filter((p) => p.eliminatedAt)
                        .map((p) => p.userId)
                    )
                  );
                }}
                className="pop pop-white text-xs"
              >
                + eliminated
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmStage(false);
                  setPicked(new Set());
                }}
                className="pop pop-white text-xs"
              >
                Clear
              </button>
            </div>
            <input
              type="search"
              value={playerFilter}
              onChange={(e) => setPlayerFilter(e.target.value)}
              placeholder="Filter by name or email…"
              className="px-3 py-2 bg-white border-3 border-navy rounded-md font-body text-base"
            />
            <div
              className="border-3 border-navy rounded-md bg-sky1 max-h-72 overflow-y-auto p-2 flex flex-col gap-1"
            >
              {universe.players.length === 0 ? (
                <p className="font-body text-xs text-navy-soft px-2 py-1">
                  No enrolled players.
                </p>
              ) : null}
              {universe.players
                .filter((p) => {
                  const q = playerFilter.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (p.name ?? "").toLowerCase().includes(q) ||
                    p.email.toLowerCase().includes(q)
                  );
                })
                .map((p) => {
                  const checked = picked.has(p.userId);
                  return (
                    <label
                      key={p.userId}
                      className="flex items-center gap-2 px-2 py-1 bg-white rounded-md border-2 border-navy cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setConfirmStage(false);
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (next.has(p.userId)) next.delete(p.userId);
                            else next.add(p.userId);
                            return next;
                          });
                        }}
                      />
                      <span className="font-display text-sm text-navy flex-1">
                        {p.name ?? "(no name)"}
                      </span>
                      <span className="font-body text-xs text-navy-soft truncate">
                        {p.email}
                      </span>
                      {p.eliminatedAt ? (
                        <span className="font-display text-xs text-coral-deep">
                          out
                        </span>
                      ) : (
                        <span className="font-display text-xs text-grass-deep">
                          in
                        </span>
                      )}
                      <span
                        className="font-display text-xs text-navy-soft"
                        title="strike count"
                      >
                        {p.strikeCount}⛔
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>
        ) : null}

        <span className="font-body text-xs text-navy-soft">
          {!audienceFilter
            ? "Pick the missing detail above to see who matches."
            : pending && !result
            ? "Counting…"
            : preview.count === 0
            ? "0 recipients match this filter right now."
            : `${preview.count} recipient${preview.count === 1 ? "" : "s"}.`}
          {audienceFilter && preview.count > 0
            ? ` First few: ${preview.emails
                .slice(0, 5)
                .map((e) => maskEmail(e))
                .join(", ")}${preview.count > 5 ? "…" : ""}`
            : ""}
        </span>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-display text-lg text-navy">Format</span>
        <select
          value={templateId}
          onChange={(e) => onTemplateChange(e.target.value)}
          className="px-3 py-2 bg-white border-3 border-navy rounded-md font-body text-base"
        >
          <option value={PLAIN_TEXT}>
            Plain text — your own message (default)
          </option>
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="font-body text-xs text-navy-soft">
          {activeTemplate
            ? activeTemplate.description
            : "Standard sky-card stationery — your typed words, with the usual styling."}
        </span>
      </label>

      <div className="card-sm bg-sun px-4 py-3">
        <p className="font-display text-sm text-navy">
          ✨ Merge variables — usable in any field below (subject, message,
          template fields)
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {MERGE_VARS.map((v) => (
            <li
              key={v.token}
              className="font-body text-xs bg-white border-2 border-navy rounded-md px-2 py-1"
              title={v.label}
            >
              <code className="font-display text-navy">{v.token}</code>
              <span className="text-navy-soft"> · {v.label}</span>
            </li>
          ))}
        </ul>
        <p className="font-body text-xs text-navy-soft mt-2">
          Each recipient gets their own values swapped in at send time.
          Example: <code>Hey {"{firstName}"}!</code> → “Hey Marc!”
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-display text-lg text-navy">Subject</span>
        <input
          value={subject}
          onChange={(e) => {
            setConfirmStage(false);
            setSubject(e.target.value);
          }}
          maxLength={140}
          placeholder={
            activeTemplate
              ? activeTemplate.defaultSubject
              : "e.g. The first round drops Saturday at 6pm"
          }
        />
      </label>

      {activeTemplate ? (
        <div className="flex flex-col gap-3 card-sm bg-sky1 px-4 py-4">
          <p className="font-display text-base text-navy">
            ✏️ Template fields
          </p>
          {activeTemplate.fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1">
              <span className="font-display text-sm text-navy">{f.label}</span>
              {f.kind === "textarea" ? (
                <textarea
                  value={templateFields[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  rows={f.rows ?? 3}
                  maxLength={f.maxLength ?? 1000}
                />
              ) : (
                <input
                  value={templateFields[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  maxLength={f.maxLength ?? 200}
                />
              )}
              {f.hint ? (
                <span className="font-body text-xs text-navy-soft">{f.hint}</span>
              ) : null}
            </label>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="pop pop-white text-sm"
            >
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
            <span className="font-body text-xs text-navy-soft">
              The recipient sees the rendered card; plain-text fallback is
              auto-generated for clients that block HTML.
            </span>
          </div>

          {activeTemplate.id === "bracket-update" ? (
            <div className="border-3 border-navy rounded-md overflow-hidden bg-sky1">
              <p className="font-display text-xs text-navy-soft px-3 py-2 bg-white border-b-2 border-navy">
                Live bracket snapshot — this is exactly what recipients will see.
              </p>
              <img
                src="/api/bracket/snapshot.svg"
                alt="Live bracket snapshot"
                style={{ display: "block", width: "100%", height: "auto" }}
              />
            </div>
          ) : null}

          {showPreview ? (
            <div className="border-3 border-navy rounded-md overflow-hidden bg-white">
              <iframe
                title="Email preview"
                srcDoc={previewHtml}
                className="w-full"
                style={{ height: 720, border: 0 }}
              />
            </div>
          ) : null}
        </div>
      ) : (
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
      )}

      {!confirmStage ? (
        <div>
          <button
            type="button"
            onClick={() => setConfirmStage(true)}
            disabled={!canDraft || !audienceFilter || preview.count === 0 || pending}
            className="pop pop-coral"
          >
            ✉️ Review &amp; send
          </button>
        </div>
      ) : (
        <div className="card-sm bg-sun px-5 py-4 flex flex-col gap-3">
          <p className="font-display text-lg text-navy">
            Send <strong>{subject || activeTemplate?.defaultSubject}</strong> to{" "}
            <strong>
              {preview.count} · {AUDIENCE_LABELS[mode]}
            </strong>
            {activeTemplate ? (
              <>
                {" "}
                using the{" "}
                <strong>{activeTemplate.name}</strong> template?
              </>
            ) : (
              "?"
            )}
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
