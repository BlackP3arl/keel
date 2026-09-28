import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The desk is opened at 127.0.0.1 in this environment. Dev assets must be allowed from that host.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
