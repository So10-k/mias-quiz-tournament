/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @resvg/resvg-js loads a prebuilt native .node binary that webpack
  // can't bundle — keep it external so the runtime resolves it at exec
  // time. gifenc is also marked external because it's a CommonJS module
  // that webpack sometimes mangles in odd ways.
  // pdfkit ships its standard fonts as AFM files loaded via
  // fs.readFileSync at runtime; webpack mangles those paths on Vercel
  // and the route 500s with "ENOENT Helvetica.afm". Keep it external
  // so the runtime resolves pdfkit from node_modules directly.
  serverExternalPackages: ["@resvg/resvg-js", "gifenc", "pdfkit"],

  // Long-cache static media — the theme audio and rendered hype video
  // are content-addressed (file paths only change when assets change),
  // so we let the CDN hold them for a year.
  async headers() {
    return [
      {
        source: "/audio/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/videos/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // /embed/* routes get framed by discuss.miaswebsites.art for
      // the [quizbook-bracket] / [quizbook-qotd] / [quizbook-standings]
      // shortcodes. Default X-Frame-Options DENY would block this; we
      // narrow it to only the discuss subdomain via CSP frame-ancestors.
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://discuss.miaswebsites.art https://miaswebsites.art",
          },
        ],
      },
      // Site-wide security headers. Hardened defaults:
      //   X-Content-Type-Options nosniff — stops MIME-sniffing attacks
      //   Referrer-Policy strict-origin-when-cross-origin — privacy
      //     without breaking analytics for our own pages
      //   Permissions-Policy — disables APIs we never use
      // Notably we DON'T set X-Frame-Options DENY because the homepage
      // hype video may be embedded in our own marketing channels;
      // CSP frame-ancestors handles that more granularly if we ever
      // need it.
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
      // Override the site-wide Permissions-Policy for the broadcast
      // pages so the JaaS iframe (8x8.vc) can request camera + mic.
      // The empty () in the site-wide rule denies ALL origins,
      // including self — which silently breaks the in-call mute
      // toggle. Here we explicitly allow self + 8x8.vc.
      {
        source: "/live",
        headers: [
          {
            key: "Permissions-Policy",
            value:
              'camera=(self "https://8x8.vc"), microphone=(self "https://8x8.vc"), display-capture=(self "https://8x8.vc"), autoplay=(self "https://8x8.vc"), geolocation=(), browsing-topics=()',
          },
        ],
      },
      {
        source: "/watch",
        headers: [
          {
            key: "Permissions-Policy",
            value:
              'camera=(self "https://8x8.vc"), microphone=(self "https://8x8.vc"), display-capture=(self "https://8x8.vc"), autoplay=(self "https://8x8.vc"), geolocation=(), browsing-topics=()',
          },
        ],
      },
      {
        // Teleprompter records via getUserMedia — needs cam + mic
        // for self only (no iframe).
        source: "/teleprompter",
        headers: [
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), display-capture=(self), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
