import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  logging: { serverFunctions: false },
  // Docker/WSL/VM file watching: uncomment if hot reload misses changes.
  // This is Turbopack's polling watcher — known-flaky, so off by default.
  // watchOptions: { pollIntervalMs: 1000 },
};

export default nextConfig;
