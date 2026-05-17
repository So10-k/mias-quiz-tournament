// Sam's master editor for a single script. Full edit access at every
// phase. Includes PIN management, phase advancement, PDF download
// links, and a live-edit indicator showing what Mia + Juliette have
// touched recently.

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { AutoRefresh } from "@/components/AutoRefresh";
import { currentUser } from "@/lib/session";
import {
  getScript,
  getScriptPins,
  type WritingScriptLine,
} from "@/lib/writing-session";
import { SITE_URL } from "@/lib/seo";
import {
  addLineHostAction,
  advancePhaseAction,
  assignLineHostAction,
  deleteLineHostAction,
  editLineHostAction,
  generatePinAction,
  revokePinAction,
  updateMetaAction,
} from "../actions";

export const dynamic = "force-dynamic";

const PHASE_DEF: Record<
  string,
  { label: string; tagline: string; next: string | null; nextLabel: string }
> = {
  draft: {
    label: "DRAFT",
    tagline:
      "AI just wrote this. Edit comprehensively before sending to Mia.",
    next: "delegating",
    nextLabel: "→ Hand off to Mia (delegating)",
  },
  delegating: {
    label: "DELEGATING",
    tagline:
      "Mia is assigning lines to herself or Juliette. You still have full edit access.",
    next: "editing",
    nextLabel: "→ Open editing (Mia + Juliette)",
  },
  editing: {
    label: "EDITING",
    tagline:
      "Mia + Juliette are editing their assigned lines. Watch the timestamps.",
    next: "finalized",
    nextLabel: "→ Finalize + lock",
  },
  finalized: {
    label: "FINALIZED",
    tagline: "Locked. PDFs are ready.",
    next: null,
    nextLabel: "",
  },
};

export default async function HostScriptEditor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) redirect(`/signin?next=/host/writing-session/${id}`);
  if (me.role !== "author") redirect("/");
  const body = await getScript(id);
  if (!body) notFound();
  const pins = await getScriptPins(id);
  const phase = body.script.status;
  const def = PHASE_DEF[phase] ?? PHASE_DEF.draft;

  // Recent-edit summary for the live-edit indicator.
  const allLines: WritingScriptLine[] = body.parts.flatMap((p) => p.lines);
  const recent = allLines
    .filter((l) => l.lastEditedAt)
    .sort(
      (a, b) =>
        (b.lastEditedAt?.getTime() ?? 0) - (a.lastEditedAt?.getTime() ?? 0)
    )
    .slice(0, 5);

  return (
    <Stage scrollable>
      <AutoRefresh seconds={4} />
      <div className="max-w-5xl mx-auto pt-4 px-4 pb-16 flex flex-col gap-5">
        <header className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
              Host · The Writing Session
            </p>
            <h1 className="font-display text-2xl md:text-3xl text-navy mt-0.5">
              ✍️ {body.script.title}
            </h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/host/writing-session"
              className="pop pop-white text-sm"
            >
              ← All scripts
            </Link>
          </div>
        </header>

        {/* Phase / advance */}
        <section
          className={
            "card px-6 py-5 border-4 " +
            (phase === "finalized" ? "border-grass" : "border-coral")
          }
        >
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
                Phase
              </p>
              <h2 className="font-display text-2xl text-navy mt-0.5">
                {def.label}
              </h2>
              <p className="font-body text-sm text-navy mt-1">{def.tagline}</p>
            </div>
            {def.next ? (
              <form action={advancePhaseAction}>
                <input type="hidden" name="scriptId" value={id} />
                <input type="hidden" name="to" value={def.next} />
                <button className="pop pop-coral text-base">
                  {def.nextLabel}
                </button>
              </form>
            ) : null}
          </div>
        </section>

        {/* PINs */}
        <section className="card px-6 py-5">
          <h2 className="font-display text-xl text-navy">🔢 4-digit PINs</h2>
          <p className="font-body text-sm text-navy-soft mt-1">
            Generate one per helper. Text it to them; they enter it at{" "}
            <code className="bg-white px-1 rounded">{SITE_URL}/writing-session</code>.
            Each PIN is valid for 72 hours.
          </p>
          <div className="mt-4 grid md:grid-cols-2 gap-3">
            <PinPanel
              scriptId={id}
              forPerson="mia"
              pins={pins.filter((p) => p.forPerson === "mia")}
            />
            <PinPanel
              scriptId={id}
              forPerson="juliette"
              pins={pins.filter((p) => p.forPerson === "juliette")}
            />
          </div>
        </section>

        {/* PDFs (only when finalized — but show preview links earlier) */}
        <section className="card px-6 py-5">
          <h2 className="font-display text-xl text-navy">📄 PDFs</h2>
          <p className="font-body text-sm text-navy-soft mt-1">
            Generate live. Each link streams a freshly-rendered PDF.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/host/writing-session/${id}/pdf?variant=personal-mia`}
              target="_blank"
              className="pop pop-coral text-sm"
            >
              📄 Mia (personal)
            </a>
            <a
              href={`/host/writing-session/${id}/pdf?variant=personal-juliette`}
              target="_blank"
              className="pop pop-coral text-sm"
            >
              📄 Juliette (personal)
            </a>
            <a
              href={`/host/writing-session/${id}/pdf?variant=lines-only`}
              target="_blank"
              className="pop pop-sky text-sm"
            >
              📄 All lines (no cues)
            </a>
            <a
              href={`/host/writing-session/${id}/pdf?variant=master`}
              target="_blank"
              className="pop pop-yellow text-sm"
            >
              📄 Sam's master (with cues)
            </a>
          </div>
        </section>

        {/* Live-edit indicator */}
        {recent.length > 0 ? (
          <section className="card px-6 py-5 bg-sky1">
            <h2 className="font-display text-sm text-navy uppercase tracking-[0.18em] text-coral-deep">
              Live editing — recent activity
            </h2>
            <ul className="mt-3 flex flex-col gap-1">
              {recent.map((line) => (
                <li
                  key={line.id}
                  className="font-body text-sm text-navy flex items-center gap-2"
                >
                  <span className="font-display text-[10px] px-2 py-0.5 rounded bg-white border-2 border-navy">
                    {line.lastEditedBy ?? "?"}
                  </span>
                  <span className="font-body text-xs text-navy-soft">
                    {line.lastEditedAt
                      ? new Date(line.lastEditedAt).toLocaleTimeString()
                      : ""}
                  </span>
                  <span className="truncate flex-1">{line.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Title + brief */}
        <section className="card px-6 py-5">
          <h2 className="font-display text-xl text-navy">Title + brief</h2>
          <form action={updateMetaAction} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="scriptId" value={id} />
            <label className="font-display text-sm text-navy">
              Title
              <input
                name="title"
                defaultValue={body.script.title}
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
              />
            </label>
            <label className="font-display text-sm text-navy">
              Brief
              <textarea
                name="brief"
                defaultValue={body.script.brief}
                rows={3}
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-sm font-body border-2 border-navy"
              />
            </label>
            <button className="pop pop-white text-sm self-start">
              💾 Save meta
            </button>
          </form>
        </section>

        {/* Body — every part with editable lines */}
        {body.parts.map(({ part, lines }, partIdx) => (
          <section key={part.id} className="card px-6 py-5">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div>
                <p className="font-display text-xs uppercase tracking-[0.18em] text-coral-deep">
                  Part {partIdx + 1}
                </p>
                <h2 className="font-display text-xl text-navy mt-0.5">
                  {part.title}
                </h2>
                {part.description ? (
                  <p className="font-body text-sm text-navy-soft mt-1 italic">
                    {part.description}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {lines.map((line) => (
                <HostLineCard
                  key={line.id}
                  line={line}
                  scriptId={id}
                  phase={phase}
                />
              ))}
              <form
                action={addLineHostAction}
                className="card-sm bg-sky1 px-3 py-3 border-2 border-dashed border-navy"
              >
                <input type="hidden" name="scriptId" value={id} />
                <input type="hidden" name="partId" value={part.id} />
                <input
                  type="hidden"
                  name="afterOrder"
                  value={lines[lines.length - 1]?.order ?? -1}
                />
                <p className="font-display text-xs text-coral-deep uppercase tracking-[0.18em]">
                  + Add line at end of part
                </p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <select
                    name="character"
                    className="card-sm bg-white px-2 py-1 text-sm font-body border-2 border-navy"
                  >
                    <option value="host">HOST</option>
                    <option value="cohost">COHOST</option>
                    <option value="mia">MIA</option>
                    <option value="juliette">JULIETTE</option>
                    <option value="sam">SAM</option>
                    <option value="narrator">VO</option>
                    <option value="both">BOTH</option>
                  </select>
                  <input
                    name="text"
                    placeholder="Line text"
                    className="flex-1 min-w-[200px] card-sm bg-white px-2 py-1 text-sm font-body border-2 border-navy"
                  />
                  <button className="pop pop-white text-xs">+ Add</button>
                </div>
              </form>
            </div>
          </section>
        ))}
      </div>
    </Stage>
  );
}

function PinPanel({
  scriptId,
  forPerson,
  pins,
}: {
  scriptId: string;
  forPerson: "mia" | "juliette";
  pins: Array<{
    id: string;
    pin: string;
    createdAt: Date;
    expiresAt: Date | null;
    revokedAt: Date | null;
  }>;
}) {
  const active = pins.filter((p) => !p.revokedAt && (!p.expiresAt || p.expiresAt.getTime() > Date.now()));
  return (
    <div
      className={
        "card-sm bg-white px-4 py-4 border-3 " +
        (forPerson === "mia" ? "border-coral" : "border-coral-deep")
      }
    >
      <p className="font-display text-sm text-navy uppercase tracking-[0.18em]">
        {forPerson === "mia" ? "🎤 Mia" : "🎙 Juliette"}
      </p>
      {active.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2">
          {active.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 bg-sun rounded-lg px-3 py-2 border-2 border-navy"
            >
              <span
                className="font-display text-3xl tracking-[0.3em] text-navy flex-1"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {p.pin}
              </span>
              <form action={revokePinAction}>
                <input type="hidden" name="scriptId" value={scriptId} />
                <input type="hidden" name="pinId" value={p.id} />
                <button className="pop pop-white text-[10px] px-2 py-1">
                  ✕
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="font-body text-xs text-navy-soft mt-2 italic">
          No active PIN.
        </p>
      )}
      <form action={generatePinAction} className="mt-3">
        <input type="hidden" name="scriptId" value={scriptId} />
        <input type="hidden" name="forPerson" value={forPerson} />
        <button className="pop pop-coral text-sm w-full">
          🔄 Generate a {active.length === 0 ? "" : "new "}PIN
        </button>
      </form>
    </div>
  );
}

function HostLineCard({
  line,
  scriptId,
  phase,
}: {
  line: WritingScriptLine;
  scriptId: string;
  phase: string;
}) {
  const owner = line.assignedTo as "mia" | "juliette" | null;
  const ownerStyle =
    owner === "mia"
      ? "border-coral"
      : owner === "juliette"
        ? "border-coral-deep"
        : "border-navy";
  return (
    <div className={`card-sm bg-white px-3 py-3 border-3 ${ownerStyle}`}>
      <form action={editLineHostAction} className="flex flex-col gap-2">
        <input type="hidden" name="scriptId" value={scriptId} />
        <input type="hidden" name="lineId" value={line.id} />
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <span className="font-display text-xs uppercase tracking-[0.18em] text-coral-deep">
            {line.character.toUpperCase()}
            {owner ? ` · assigned to ${owner}` : ""}
          </span>
          <span className="font-body text-[10px] text-navy-soft">
            {line.lastEditedBy
              ? `${line.lastEditedBy} · ${line.lastEditedAt ? new Date(line.lastEditedAt).toLocaleTimeString() : ""}`
              : ""}
          </span>
        </div>
        <textarea
          name="text"
          defaultValue={line.text}
          rows={2}
          className="card-sm bg-white text-base font-body text-navy px-3 py-2 border-2 border-navy w-full"
        />
        <input
          name="cue"
          defaultValue={line.cue ?? ""}
          placeholder="Cue / stage direction (optional)"
          className="card-sm bg-white text-sm font-body italic text-navy-soft px-3 py-1.5 border-2 border-navy w-full"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <button className="pop pop-white text-xs">💾 Save</button>
        </div>
      </form>

      {/* Assignment chips — visible always so Sam can override */}
      <div className="mt-2 flex gap-2 flex-wrap">
        {(
          [
            ["mia", "🎤 Mia"],
            ["juliette", "🎙 Juliette"],
            ["none", "✕ Unassign"],
          ] as const
        ).map(([to, label]) => (
          <form action={assignLineHostAction} key={to} className="contents">
            <input type="hidden" name="scriptId" value={scriptId} />
            <input type="hidden" name="lineId" value={line.id} />
            <input type="hidden" name="assignedTo" value={to} />
            <button
              type="submit"
              className={
                "font-display text-[10px] px-2 py-1 rounded-full border-2 border-navy " +
                ((to === "mia" && owner === "mia") ||
                (to === "juliette" && owner === "juliette") ||
                (to === "none" && owner == null)
                  ? "bg-coral-deep text-white"
                  : "bg-white text-navy hover:-translate-y-0.5 transition-transform")
              }
            >
              {label}
            </button>
          </form>
        ))}
        <form action={deleteLineHostAction} className="contents">
          <input type="hidden" name="scriptId" value={scriptId} />
          <input type="hidden" name="lineId" value={line.id} />
          <button
            type="submit"
            className="font-display text-[10px] px-2 py-1 rounded-full border-2 border-coral-deep text-coral-deep bg-white"
          >
            🗑 Delete
          </button>
        </form>
      </div>
    </div>
  );
}
