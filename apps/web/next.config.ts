import type { NextConfig } from "next";
import { z } from "zod";

// Next loads .env* before this file runs, so a bad API_URL fails `next dev` /
// `next build` here. Rewrites are baked in at build time: set API_URL then.
const { API_URL } = z
  .object({
    API_URL: z
      .url({ protocol: /^https?$/ })
      .default("http://localhost:3001")
      .transform((url) => url.replace(/\/+$/, "")),
  })
  .parse(process.env);

const nextConfig: NextConfig = {
  // Browser calls /api/* on the Next origin; Next proxies to Nest. No CORS needed.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
