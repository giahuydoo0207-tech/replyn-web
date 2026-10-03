import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Replyn demo is client-only, so Vercel can host it as a static export.
  output: "export",
  // badge dev của Next nằm đè lên avatar ở rail trái khi trình diễn
  devIndicators: false,
};

export default nextConfig;
