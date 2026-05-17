// Bare layout for /embed/* routes — these are iframed into Discourse
// and other surfaces, so they MUST NOT render the Quiz Book nav or
// any chrome that assumes a full-page context.
//
// The layout also sets `X-Frame-Options` (via the `frame-ancestors`
// directive in middleware-equivalent meta) so browsers allow
// embedding from discuss.miaswebsites.art. The actual frame-ancestors
// header is set in next.config.mjs (see headers() block).
//
// We keep just `globals.css` for the design tokens + fonts; no Nav,
// no VisitLogger, no schema dumps.

import "../globals.css";

export const metadata = {
  // Don't index these — they're partial widgets, not standalone pages.
  robots: { index: false, follow: false },
};

export default function EmbedLayout({
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
          background: "transparent",
          fontFamily: "Quicksand, system-ui, sans-serif",
          color: "#1B2A4E",
          fontWeight: 600,
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
