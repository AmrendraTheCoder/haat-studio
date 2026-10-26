import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone — what the Dockerfile ships.
  output: "standalone",
  // The Gradio client is written for Node and the browser at once; bundling
  // it for the server picks the wrong entry points. Load it with plain require.
  serverExternalPackages: ["@gradio/client"],
};

export default nextConfig;
