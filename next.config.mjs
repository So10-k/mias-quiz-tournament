/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @resvg/resvg-js loads a prebuilt native .node binary that webpack
  // can't bundle — keep it external so the runtime resolves it at exec
  // time. gifenc is also marked external because it's a CommonJS module
  // that webpack sometimes mangles in odd ways.
  serverExternalPackages: ["@resvg/resvg-js", "gifenc"],
};

export default nextConfig;
