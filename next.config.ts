import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone — what the Dockerfile ships.
  output: "standalone",
  // The standalone server chdirs into .next/standalone, so a relative DATA_DIR
  // would point at a copy made at build time and wiped by the next build.
  // `start:standalone` passes an absolute DATA_DIR (and loads the real .env, so
  // a changed key needs a restart, not a rebuild); this keeps saved results
  // (and the eval reports) out of the build output altogether.
  outputFileTracingExcludes: { "*": ["data/**", "eval/**"] },
  // The Gradio client is written for Node and the browser at once; bundling
  // it for the server picks the wrong entry points. Load it with plain require.
  serverExternalPackages: ["@gradio/client"],
};

export default nextConfig;
