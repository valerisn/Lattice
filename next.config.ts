import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  devIndicators: false,
  experimental: {
    // Keep browser tests independent of the preview server's persisted cache.
    turbopackFileSystemCacheForDev: process.env.LATTICE_E2E !== "1",
  },
  turbopack: { root: process.cwd() },
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "./uploads/**/*", "./tests/**/*", "./.env*"],
  },
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
          },
        ],
      },
    ];
  },
};
export default config;
