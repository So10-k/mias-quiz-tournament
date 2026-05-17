// Popup window: picker UI for ⚡ Initiate task. Designed for a 760x760
// browser popup opened by WorkflowLauncher on /host/workflows.
//
// Submit → initiateWorkflowAction (deferred) → redirects to /done →
// /done triggers window.opener.location.reload() + window.close().

import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { WORKFLOWS } from "@/lib/workflows";
import { initiateWorkflowAction } from "@/app/host/workflows/actions";

export const dynamic = "force-dynamic";

export default async function WorkflowLaunchPage({
  searchParams,
}: {
  searchParams: Promise<{ pick?: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/signin?next=/host/workflows/launch");
  if (me.role !== "author") notFound();
  const sp = await searchParams;
  const pickedId = sp.pick && WORKFLOWS.some((w) => w.id === sp.pick) ? sp.pick : null;
  const pickedItem = pickedId ? WORKFLOWS.find((w) => w.id === pickedId) ?? null : null;

  return (
    <>
      <style>{`
          :root {
            --navy: #1B2A4E;
            --coral: #E94B7E;
            --coral-deep: #C9296A;
            --sun: #FFD93D;
            --paper: #FFFDF0;
            --sky: #B7E5FF;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 0;
            background: linear-gradient(180deg, var(--sky), var(--paper));
            color: var(--navy);
            font-family: 'Fredoka', 'Quicksand', system-ui, sans-serif;
            min-height: 100vh;
          }
          .wrap {
            max-width: 720px;
            margin: 0 auto;
            padding: 22px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .card {
            background: white;
            border: 4px solid var(--navy);
            border-radius: 22px;
            box-shadow: 6px 6px 0 var(--sun);
            padding: 18px 20px;
          }
          .kicker {
            font-size: 11px;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            color: var(--coral-deep);
            font-weight: 700;
            margin: 0;
          }
          h1 { font-size: 24px; margin: 6px 0 0; font-weight: 700; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          @media (max-width: 540px) { .grid { grid-template-columns: 1fr; } }
          .pick {
            background: white;
            border: 3px solid var(--navy);
            border-radius: 14px;
            padding: 10px 12px;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            cursor: pointer;
            text-decoration: none;
            color: var(--navy);
            transition: transform 0.12s ease;
          }
          .pick:hover { transform: translateY(-2px); }
          .pick.active {
            background: var(--sun);
            border-color: var(--coral-deep);
            box-shadow: 4px 4px 0 var(--navy);
          }
          .pick .emo { font-size: 22px; line-height: 1; }
          .pick .nm { font-weight: 700; font-size: 14px; display: block; line-height: 1.2; }
          .pick .ds {
            font-family: 'Quicksand', sans-serif;
            font-weight: 500;
            font-size: 11px;
            color: #5B6781;
            display: block;
            margin-top: 3px;
            line-height: 1.35;
          }
          .warn {
            background: #FFE8EE;
            border: 3px solid var(--coral-deep);
            border-radius: 14px;
            padding: 12px 14px;
            color: var(--navy);
          }
          .warn .kicker { color: var(--coral-deep); }
          input[name="confirm"] {
            font-family: 'Quicksand', system-ui, sans-serif;
            font-weight: 600;
            background: white;
            border: 3px solid var(--navy);
            border-radius: 10px;
            padding: 8px 12px;
            font-size: 14px;
            width: 200px;
            color: var(--navy);
          }
          input[name="confirm"]:focus { outline: none; box-shadow: 3px 3px 0 var(--coral); }
          button.go {
            background: var(--coral);
            color: white;
            border: 4px solid var(--navy);
            border-radius: 14px;
            padding: 12px 22px;
            font-family: 'Fredoka', sans-serif;
            font-weight: 700;
            font-size: 16px;
            cursor: pointer;
            box-shadow: 5px 5px 0 var(--navy);
          }
          button.go:disabled { opacity: 0.5; cursor: not-allowed; }
          button.cancel {
            background: white;
            color: var(--navy);
            border: 3px solid var(--navy);
            border-radius: 12px;
            padding: 8px 14px;
            font-family: 'Fredoka', sans-serif;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
          }
          .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        `}</style>
      <div className="wrap">
          <div className="card">
            <p className="kicker">⚡ Workflow launcher</p>
            <h1>Pick a task to initiate</h1>
          </div>

          <div className="card">
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#5B6781" }}>
              Tap a workflow to select it. Then read the side-effects,
              type <code>RUN</code>, and hit Initiate.
            </p>
            <div className="grid">
              {WORKFLOWS.map((w) => (
                <a
                  key={w.id}
                  href={`?pick=${encodeURIComponent(w.id)}`}
                  className={`pick${pickedId === w.id ? " active" : ""}`}
                >
                  <span className="emo">{w.emoji}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="nm">{w.name}</span>
                    <span className="ds">{w.description}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>

          {pickedItem ? (
            <div className="warn">
              <p className="kicker">⚠ Side effects</p>
              <p style={{ margin: "6px 0 0", fontSize: 14 }}>
                {pickedItem.sideEffects}
              </p>
            </div>
          ) : null}

          <form
            action={initiateWorkflowAction}
            className="card"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <input
              type="hidden"
              name="workflowId"
              value={pickedItem?.id ?? ""}
            />
            <input type="hidden" name="popupOrigin" value="1" />
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: pickedItem ? "var(--navy)" : "#5B6781",
              }}
            >
              {pickedItem
                ? `Selected: ${pickedItem.emoji} ${pickedItem.name}.`
                : "Select a workflow above first."}
            </p>
            <div className="row">
              <input
                name="confirm"
                placeholder="Type RUN"
                autoComplete="off"
                disabled={!pickedItem}
              />
              <button
                type="submit"
                className="go"
                disabled={!pickedItem}
              >
                ⚡ Initiate
              </button>
              <button id="wf-cancel" type="button" className="cancel">
                Cancel
              </button>
            </div>
          </form>

          <p
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "#5B6781",
              margin: 0,
            }}
          >
            This window closes itself after the task starts. The
            dashboard refreshes automatically.
          </p>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              var el = document.getElementById('wf-cancel');
              if (el) el.addEventListener('click', function () {
                try { window.close(); } catch (e) {}
              });
            `,
          }}
        />
    </>
  );
}
