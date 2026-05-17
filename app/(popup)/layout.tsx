// Parallel root layout used by the OS popup browser window
// (/host/workflows/launch + /done). Strips the site chrome
// (Intercom Messenger, SiteBanner, VisitLogger) since the popup is a
// tiny self-contained surface.

import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Workflow launcher",
  robots: { index: false, follow: false },
};

export default function PopupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          background:
            "linear-gradient(180deg, #B7E5FF 0%, #FFFDF0 100%)",
          color: "#1B2A4E",
          fontFamily: "Fredoka, Quicksand, system-ui, sans-serif",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
