import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root — a stray package-lock.json in the home dir otherwise
  // confuses Next's monorepo root detection.
  outputFileTracingRoot: process.cwd(),
  // Resume files are served via Supabase signed expiring URLs, never from the app origin.
  // Image optimization stays off the candidate-data path on purpose.
};

export default nextConfig;
