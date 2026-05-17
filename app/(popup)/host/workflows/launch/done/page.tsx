// Closes the popup window + reloads the parent dashboard.
// initiateWorkflowAction redirects here when popupOrigin=1.

import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Task initiated",
  robots: { index: false, follow: false },
};

export default function WorkflowLaunchDone() {
  return (
    <>
      <style>{`
        .done-wrap {
          display:flex; align-items:center; justify-content:center;
          min-height:100vh;
        }
        .done-card {
          background:white;
          border:4px solid #1B2A4E;
          border-radius:22px;
          box-shadow:6px 6px 0 #FFD93D;
          padding:32px 36px;
          text-align:center;
          max-width:380px;
        }
        .done-card .big { font-size:54px; line-height:1; }
        .done-card h1 { font-size:22px; margin:14px 0 6px; font-weight:700; color:#1B2A4E; }
        .done-card p {
          font-family:'Quicksand',sans-serif;
          font-weight:500; font-size:14px; margin:0; color:#5B6781;
        }
      `}</style>
      <div className="done-wrap">
        <div className="done-card">
          <div className="big">⚡</div>
          <h1>Task initiated</h1>
          <p>
            This window closes itself in a second. The dashboard is
            updating in the background.
          </p>
        </div>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            try {
              if (window.opener && !window.opener.closed) {
                window.opener.location.reload();
              }
            } catch (e) {}
            setTimeout(function() {
              try { window.close(); } catch (e) {}
            }, 600);
          `,
        }}
      />
    </>
  );
}
