import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "INVERSAM Manager",
    short_name: "INVERSAM",
    description: "Gestión del taller INVERSAM: órdenes, caja, clientes y reportes.",
    lang: "es-HN",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#0f1e4a",
    theme_color: "#0f1e4a",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nueva orden", url: "/ordenes/nueva", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Caja", url: "/caja", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Citas", url: "/citas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
