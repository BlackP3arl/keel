import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // The desk is opened at 127.0.0.1 in this environment. Dev assets must be allowed from that host.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;

// Makes D1 (and other bindings) available to `next dev` via getCloudflareContext().
initOpenNextCloudflareForDev();
