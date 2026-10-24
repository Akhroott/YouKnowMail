import type { NextConfig } from "next";

/**
 * Optional same-origin proxy so session cookies stay first-party.
 * Set API_PROXY_TARGET=https://mail.yoyknowmail.com and
 * NEXT_PUBLIC_API_BASE_URL=/api/backend
 *
 * Does not rewrite /admin UI routes — only /api/backend/*.
 */
const proxyTarget = (process.env.API_PROXY_TARGET ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    if (!proxyTarget) return [];
    return [
      {
        source: "/api/backend/:path*",
        destination: `${proxyTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
