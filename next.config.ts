import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Turbopack stops picking up the
  // user-home lockfile when multiple lockfiles exist on the machine.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
