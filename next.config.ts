import type { NextConfig } from "next";

/**
 * Toda la aplicación es privada y depende de la sesión del usuario (cookies), por lo que
 * se renderiza dinámicamente en cada solicitud. Cache Components no aporta aquí y se desactiva.
 */
const nextConfig: NextConfig = {
  cacheComponents: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      {
        // El service worker siempre se revalida para que las actualizaciones lleguen de inmediato
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/descargas/:file*.apk",
        headers: [{ key: "Content-Type", value: "application/vnd.android.package-archive" }],
      },
    ];
  },
};

export default nextConfig;
