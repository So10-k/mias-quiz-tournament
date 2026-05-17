// Phase-aware editor for whoever holds the PIN.
//
//   • draft         — read-only. Sam is reviewing; show a polite
//                     waiting screen.
//   • delegating    — Mia's PIN: tap a chip on each line to assign it
//                     to herself or Juliette. Juliette's PIN: same as
//                     draft (read-only — waits for Mia).
//   • editing       — Mia / Juliette can edit ONLY the lines assigned
//                     to them. Others' lines are read-only.
//   • finalized     — read-only. Banner says it's locked + offers a
//                     direct PDF link for their lines.

import { notFound } from "next/navigation";
import { Stage } from "@/components/Stage";
import { AutoRefresh } from "@/components/AutoRefresh";
import {
  getScript,
  resolvePin,
  type Helper,
  type WritingScriptLine,
} from "@/lib/writing-session";
import { assignLineAction, editLineAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function WritingSessionDoc({
  params,
}: {
  params: Promise<{ pin: string }>;
}) {
  const { pin } = await params;
  const auth = await resolvePin(pin);
  if (!auth) notFound();
  const body = await getScript(auth.script.id);
  if (!body) notFound();

  const me = auth.pin.forPerson as Helper;
  const phase = auth.script.status;

  return (
    <Stage scrollable>
      {/* Light polling so a second window catches Sam's status changes
          + the other helper's edits while you're working. */}
      <AutoRefresh seconds={6} />
      <div className="max-w-4xl mx-auto pt-4 px-4 pb-16 flex flex-col gap-4">
        <header
          className={
            "card px-6 py-5 border-4 " +
            (me === "mia" ? "border-coral" : "border-coral-deep")
          }
        >
          <p className="font-display text-xs uppercase tracking-[0.22em] text-coral-deep">
            The Writing Session · {auth.script.title}
          </p>
          <h1 className="font-display text-2xl md:text-3xl text-navy mt-1">
            Hi {me === "mia" ? "Mia" : "Juliette"} 👋
          </h1>
          <PhaseBanner phase={phase} me={me} />
        </header>

        {body.parts.map(({ part, lines }, partIdx) => (
          <section key={part.id} className="card px-6 py-5">
            <p className="font-display text-xs uppercase tracking-[0.18em] text-coral-deep">
              Part {partIdx + 1}
            </p>
            <h2 className="font-display text-xl text-navy mt-1">
              {part.title}
            </h2>
            {part.description ? (
              <p className="font-body text-sm text-navy-soft mt-1 italic">
                {part.description}
              </p>
            ) : null}
            <div className="mt-3 flex flex-col gap-3">
              {lines.map((line) => (
                <LineCard
                  key={line.id}
                  line={line}
                  phase={phase}
                  me={me}
                  pin={pin}
                />
              ))}
            </div>
          </section>
        ))}

        <p className="font-body text-xs text-navy-soft text-center italic">
          Your edits save automatically when you tap save on a line. Sam
          sees everything in real time on the host dashboard.
        </p>
      </div>
    </Stage>
  );
}

function PhaseBanner({ phase, me }: { phase: string; me: Helper }) {
  if (phase === "draft") {
    return (
      <p className="font-body text-base text-navy mt-2">
        Sam&rsquo;s reviewing the first draft. Hang tight — you&rsquo;ll
        be able to do your part once he hands it over. (This page will
        refresh on its own.)
      </p>
    );
  }
  if (phase === "delegating") {
    if (me === "mia") {
      return (
        <p className="font-body text-base text-navy mt-2">
          Your turn:{" "}
          <strong>tap a chip on each line</strong> to mark whose line it
          is — yours, or Juliette&rsquo;s. Once you&rsquo;re happy, tell
          Sam to flip it to the editing phase.
        </p>
      );
    }
    return (
      <p className="font-body text-base text-navy mt-2">
        Mia&rsquo;s splitting the lines between you two right now. The
        page refreshes on its own — your lines will appear in green when
        she&rsquo;s done.
      </p>
    );
  }
  if (phase === "editing") {
    return (
      <p className="font-body text-base text-navy mt-2">
        Your lines are highlighted in coral. Edit them directly — tap
        save when you&rsquo;re happy. The other lines are read-only.
      </p>
    );
  }
  if (phase === "finalized") {
    return (
      <p className="font-body text-base text-navy mt-2">
        Locked. Sam&rsquo;s producing the PDFs.
      </p>
    );
  }
  return null;
}

function LineCard({
  line,
  phase,
  me,
  pin,
}: {
  line: WritingScriptLine;
  phase: string;
  me: Helper;
  pin: string;
}) {
  const mine = line.assignedTo === me;
  const owner = line.assignedTo as Helper | null;
  const tone =
    mine && phase === "editing"
      ? "bg-sun border-coral-deep"
      : owner === me
        ? "bg-grass/15 border-grass"
        : owner
          ? "bg-sky1 border-navy"
          : "bg-white border-navy";

  return (
    <div className={`card-sm px-3 py-3 border-3 ${tone}`}>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="font-display text-xs uppercase tracking-[0.18em] text-coral-deep">
          {speakerHumanLabel(line)}
        </p>
        <span className="font-body text-[10px] text-navy-soft">
          {line.lastEditedBy
            ? `edited by ${line.lastEditedBy}${
                line.lastEditedAt
                  ? " · " + relativeTime(line.lastEditedAt)
                  : ""
              }`
            : null}
        </span>
      </div>

      {phase === "editing" && mine ? (
        <form action={editLineAction} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="pin" value={pin} />
          <input type="hidden" name="lineId" value={line.id} />
          <textarea
            name="text"
            defaultValue={line.text}
            rows={2}
            className="card-sm bg-white text-base font-body text-navy px-3 py-2 border-2 border-navy w-full"
          />
          <div className="flex justify-end">
            <button className="pop pop-coral text-xs">💾 Save</button>
          </div>
        </form>
      ) : (
        <p className="font-body text-base text-navy mt-1 leading-relaxed">
          {line.text}
        </p>
      )}

      {phase === "delegating" && me === "mia" ? (
        <div className="mt-2 flex gap-2 flex-wrap">
          <AssignChip
            pin={pin}
            lineId={line.id}
            to="mia"
            label="🎤 Mine"
            active={line.assignedTo === "mia"}
          />
          <AssignChip
            pin={pin}
            lineId={line.id}
            to="juliette"
            label="🎙 Juliette"
            active={line.assignedTo === "juliette"}
          />
          <AssignChip
            pin={pin}
            lineId={line.id}
            to="none"
            label="✕ Unassign"
            active={line.assignedTo == null}
          />
        </div>
      ) : null}
    </div>
  );
}

function AssignChip({
  pin,
  lineId,
  to,
  label,
  active,
}: {
  pin: string;
  lineId: string;
  to: "mia" | "juliette" | "none";
  label: string;
  active: boolean;
}) {
  return (
    <form action={assignLineAction} className="contents">
      <input type="hidden" name="pin" value={pin} />
      <input type="hidden" name="lineId" value={lineId} />
      <input type="hidden" name="assignedTo" value={to} />
      <button
        type="submit"
        className={
          "font-display text-xs px-3 py-1 rounded-full border-2 border-navy " +
          (active
            ? "bg-coral-deep text-white"
            : "bg-white text-navy hover:-translate-y-0.5 transition-transform")
        }
      >
        {label}
      </button>
    </form>
  );
}

function speakerHumanLabel(line: WritingScriptLine): string {
  if (line.assignedTo === "mia") return "MIA (assigned)";
  if (line.assignedTo === "juliette") return "JULIETTE (assigned)";
  switch (line.character) {
    case "host":
      return "HOST";
    case "cohost":
      return "COHOST";
    case "mia":
      return "MIA";
    case "juliette":
      return "JULIETTE";
    case "sam":
      return "SAM";
    case "narrator":
      return "VO (narrator)";
    case "both":
      return "BOTH";
  }
}

function relativeTime(d: Date): string {
  const sec = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (sec < 60) return Math.round(sec) + "s ago";
  const min = sec / 60;
  if (min < 60) return Math.round(min) + "m ago";
  const hr = min / 60;
  if (hr < 24) return Math.round(hr) + "h ago";
  return Math.round(hr / 24) + "d ago";
}
