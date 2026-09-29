import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.100.167"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
