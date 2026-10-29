import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Extra dev-server hosts (e.g. a LAN IP for testing on a phone) come from
  // DEV_ALLOWED_ORIGINS in .env.local, so a machine's address stays out of git.
  allowedDevOrigins: [
    "127.0.0.1",
    ...(process.env.DEV_ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? []),
  ],
  logging: { serverFunctions: false },
  // Docker/WSL/VM file watching: uncomment if hot reload misses changes.
  // This is Turbopack's polling watcher — known-flaky, so off by default.
  // watchOptions: { pollIntervalMs: 1000 },
};

export default nextConfig;
