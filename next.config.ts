import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Allow admin image uploads up to 8MB (matches src/lib/upload.ts MAX_BYTES).
  // Default Next.js Server Action body limit is 1MB which rejects most photos.
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  async redirects() {
    // Kim 영민 → Kim 영(yeong)민. 옛 링크 보존용 308 영구 리다이렉트.
    return [
      {
        source: "/playground/kim-youngmin-bot/:path*",
        destination: "/playground/kim-yeongmin-bot/:path*",
        permanent: true,
      },
      {
        source: "/playground/kim-youngmin-bot",
        destination: "/playground/kim-yeongmin-bot",
        permanent: true,
      },
      {
        source: "/admin/youngmin-bot/:path*",
        destination: "/admin/yeongmin-bot/:path*",
        permanent: true,
      },
      {
        source: "/admin/youngmin-bot",
        destination: "/admin/yeongmin-bot",
        permanent: true,
      },
      {
        source: "/api/playground/kim-youngmin-bot/:path*",
        destination: "/api/playground/kim-yeongmin-bot/:path*",
        permanent: true,
      },
      {
        source: "/api/admin/youngmin-bot/:path*",
        destination: "/api/admin/yeongmin-bot/:path*",
        permanent: true,
      },
      {
        source: "/uploads/youngmin/:path*",
        destination: "/uploads/yeongmin/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/slides/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:path((?!_next|slides|.*\\.).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
