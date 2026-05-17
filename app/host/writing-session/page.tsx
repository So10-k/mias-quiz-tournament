// Host index for the Writing Session. Lists all scripts, lets Sam
// kick off a fresh AI draft, and links into the per-script editor.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { listScripts } from "@/lib/writing-session";
import {
  createScriptAction,
  createFromFinalsTemplateAction,
} from "./actions";

export const dynamic = "force-dynamic";

const PHASE_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "DRAFT · Sam reviewing", cls: "bg-white text-navy" },
  delegating: { label: "DELEGATING · Mia", cls: "bg-coral text-white" },
  editing: { label: "EDITING · Mia + Juliette", cls: "bg-sun text-navy" },
  finalized: { label: "FINALIZED · PDFs ready", cls: "bg-grass text-white" },
};

export default async function HostWritingIndex() {
  const me = await currentUser();
  if (!me) redirect("/signin?next=/host/writing-session");
  if (me.role !== "author") redirect("/");

  const scripts = await listScripts();

  return (
    <Stage scrollable>
      <div className="max-w-4xl mx-auto pt-4 px-4 pb-12 flex flex-col gap-5">
        <header className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-coral-deep">
              Host · The Writing Session
            </p>
            <h1 className="font-display text-3xl text-navy mt-0.5">
              ✍️ Scripts
            </h1>
          </div>
          <Link href="/host" className="pop pop-white text-sm">
            ← Host
          </Link>
        </header>

        <section className="card px-6 py-5 border-4 border-coral">
          <h2 className="font-display text-xl text-navy">
            📝 Use the curated finals template
          </h2>
          <p className="font-body text-sm text-navy-soft mt-1">
            Hand-written by Sam's collaborator. Wired to the actual
            finalists, the 12 pre-produced ads, and every runbook stage.
            No AI involved — pick this if you want a tight, deterministic
            starting point.
          </p>
          <form action={createFromFinalsTemplateAction} className="mt-3">
            <button className="pop pop-coral text-base">
              📝 Drop in the finals template
            </button>
          </form>
        </section>

        <section className="card px-6 py-5">
          <h2 className="font-display text-xl text-navy">
            ✨ Generate a new draft (AI)
          </h2>
          <p className="font-body text-sm text-navy-soft mt-1">
            Sam types a brief; AI drafts a serious, no-jokes script split
            into parts. You comprehensively edit before flipping the
            phase so Mia can delegate lines.
          </p>
          <form
            action={createScriptAction}
            className="mt-4 flex flex-col gap-3"
          >
            <label className="font-display text-sm text-navy">
              Title
              <input
                name="title"
                defaultValue="Finals · Saturday May 16"
                maxLength={120}
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
                required
              />
            </label>
            <label className="font-display text-sm text-navy">
              Brief — tell the AI what's special about tonight (1-3
              paragraphs). Tone, structure, who's hosting, anything
              fixed.
              <textarea
                name="brief"
                rows={4}
                defaultValue={
                  "Live broadcast of the finals. Mia (7) and Juliette (teen) co-host. Sam directs from off-camera. Tournament started 8 weeks ago, four finalists: Karen, Marc, Grandpa, Sam. Two bracket finals + championship. Pre-produced parody ads between matches — don't write the ads. Keep it warm and serious, like a family Olympics ceremony."
                }
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
              />
            </label>
            <button className="pop pop-coral text-base self-start">
              ✨ Draft a new script
            </button>
            <p className="font-body text-[11px] text-navy-soft italic">
              ~15-25 seconds. The generator uses Groq llama-3.1; the
              result is yours to edit.
            </p>
          </form>
        </section>

        <section className="card px-6 py-5">
          <h2 className="font-display text-xl text-navy">All scripts</h2>
          {scripts.length === 0 ? (
            <p className="font-body text-sm text-navy-soft mt-2 italic">
              None yet.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {scripts.map((s) => {
                const badge = PHASE_BADGE[s.status] ?? PHASE_BADGE.draft;
                return (
                  <li
                    key={s.id}
                    className="card-sm bg-white px-3 py-3 flex items-center gap-3 flex-wrap"
                  >
                    <span className="font-display text-base text-navy flex-1 min-w-0 truncate">
                      {s.title}
                    </span>
                    <span
                      className={`font-display text-[10px] px-2 py-0.5 rounded border-2 border-navy ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <Link
                      href={`/host/writing-session/${s.id}`}
                      className="pop pop-coral text-xs px-3 py-1"
                    >
                      Open →
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Stage>
  );
}
