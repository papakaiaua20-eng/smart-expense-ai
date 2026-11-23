import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js spawns worker threads from its own files, so keep it out of the bundle
  serverExternalPackages: ["tesseract.js"],
  // ship the Thai/English OCR language data with the scan API route
  outputFileTracingIncludes: {
    "/api/receipts/scan": ["./ocr-data/**/*", "./node_modules/tesseract.js/**/*", "./node_modules/tesseract.js-core/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
