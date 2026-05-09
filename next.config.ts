import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.afloat.cc"],
  devIndicators: {
    position: "bottom-left"
  },
  output: "standalone"
};

export default nextConfig;
