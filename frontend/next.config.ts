import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: require('path').join(__dirname, '..'),
  reactStrictMode: true
};

export default nextConfig;
