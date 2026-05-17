// Host index for live rounds. Lists every round with `isLive=true`
// across the active/most-recent tournament, with one-click links to
// the per-round control panel. Doubles as the entry point for creating
// practice live rounds.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import { db, schema } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import {
  createPracticeLiveRoundAction,
  deleteLiveRoundAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function HostLiveIndexPage() {
  const user = await currentUser();
  if (!user) redirect("/signin?next=/host/live");
  if (user.role !== "author") redirect("/");

  const liveRounds = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.isLive, true))
    .orderBy(desc(schema.rounds.createdAt));

  return (
    <Stage scrollable>
      <div className="max-w-3xl mx-auto pt-4 px-4 pb-12 flex flex-col gap-4">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-2xl text-navy">
            🎙️ Live rounds
          </h1>
          <Link href="/host" className="pop pop-white text-sm">
            ← Host
          </Link>
        </div>

        <div className="card px-6 py-5">
          <h2 className="font-display text-lg text-navy">
            ✨ Create a practice live round
          </h2>
          <p className="font-body text-sm text-navy-soft mt-2">
            Same UI as the finals (synced host pace, server-locked timer,
            live scoreboard) but flagged as practice — anyone signed in
            can join, no bracket effects, no strikes. Use it to rehearse
            before the real thing.
          </p>
          <form
            action={createPracticeLiveRoundAction}
            className="mt-4 flex flex-col gap-3"
          >
            <label className="font-display text-sm text-navy">
              Title
              <input
                name="title"
                defaultValue="Finals Rehearsal"
                maxLength={80}
                className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
                required
              />
            </label>
            <div className="flex gap-3 flex-wrap">
              <label className="font-display text-sm text-navy flex-1 min-w-[140px]">
                # questions
                <input
                  name="questionCount"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={10}
                  className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
                  required
                />
              </label>
              <label className="font-display text-sm text-navy flex-1 min-w-[140px]">
                Seconds per Q
                <input
                  name="seconds"
                  type="number"
                  min={10}
                  max={120}
                  defaultValue={30}
                  className="card-sm bg-white px-3 py-1.5 w-full mt-1 text-base font-body border-2 border-navy"
                  required
                />
              </label>
            </div>
            <button className="pop pop-coral text-base self-start">
              ✨ Create + open control panel
            </button>
          </form>
        </div>

        <div className="card px-6 py-5">
          <h2 className="font-display text-lg text-navy">
            All live rounds
          </h2>
          {liveRounds.length === 0 ? (
            <p className="font-body text-sm text-navy-soft mt-2 italic">
              None yet.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {liveRounds.map((r) => (
                <li
                  key={r.id}
                  className="card-sm bg-white px-3 py-2 flex items-center gap-3 flex-wrap"
                >
                  <span className="font-display text-base text-navy flex-1 min-w-0 truncate">
                    {r.title}
                  </span>
                  <span
                    className={
                      "font-display text-xs px-2 py-0.5 rounded border-2 border-navy " +
                      (r.isPractice
                        ? "bg-sun text-navy"
                        : "bg-coral text-white")
                    }
                  >
                    {r.isPractice ? "PRACTICE" : "TOURNAMENT"}
                  </span>
                  <span className="font-display text-xs px-2 py-0.5 rounded border-2 border-navy bg-white text-navy">
                    {r.liveStatus.replace("_", " ")}
                  </span>
                  <Link
                    href={`/host/live/${r.id}`}
                    className="pop pop-coral text-xs px-3 py-1"
                  >
                    🎙️ control
                  </Link>
                  <Link
                    href={`/play/live/${r.id}`}
                    className="pop pop-sky text-xs px-3 py-1"
                  >
                    👀 spectator url
                  </Link>
                  {r.isPractice ? (
                    <details>
                      <summary className="font-body text-xs text-coral-deep cursor-pointer">
                        ⚠ delete
                      </summary>
                      <form
                        action={deleteLiveRoundAction}
                        className="mt-2 flex gap-2"
                      >
                        <input type="hidden" name="roundId" value={r.id} />
                        <input
                          name="confirm"
                          placeholder="Type DELETE"
                          className="card-sm bg-white px-2 py-1 text-xs font-body border-2 border-navy"
                          required
                        />
                        <button className="pop pop-white text-xs px-2 py-1">
                          confirm
                        </button>
                      </form>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Stage>
  );
}
