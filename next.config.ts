import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf bundles its own pdf.js build; keep it out of the server bundle.
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
