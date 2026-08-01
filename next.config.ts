import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained server bundle (.next/standalone) for the Docker/VPS deploy.
  output: "standalone",
  // Pin the workspace root to this project so Turbopack stops picking up the
  // user-home lockfile when multiple lockfiles exist on the machine.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Ship the embedded PDF font with the server bundle (read via process.cwd()
  // in the @react-pdf devis renderer) so it survives on Vercel.
  outputFileTracingIncludes: {
    "/api/documents/**": ["./public/fonts/**"],
  },
};

export default nextConfig;
