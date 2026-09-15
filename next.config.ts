import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
