#!/usr/bin/env node
/**
 * Genera los íconos de la app (PWA, iPhone y Android) a partir del logotipo vectorial.
 * Uso: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const NAVY = "#0f1e4a";
// Rueda/llanta del logotipo INVERSAM (misma figura que src/components/brand.tsx), viewBox 40x40
const MARK = `<rect width="40" height="40" rx="9" fill="#3b66f5"/>
<path fill="#fff" d="M20 8.5a11.5 11.5 0 1 0 0 23 11.5 11.5 0 0 0 0-23Zm0 4.2a7.3 7.3 0 0 1 6.9 4.9h-4.3a3 3 0 0 0-5.2 0h-4.3a7.3 7.3 0 0 1 6.9-4.9Zm-7.3 7.8h4.4a3 3 0 0 0 1.4 2.3l-2.2 3.8a7.3 7.3 0 0 1-3.6-6.1Zm7.3 7.3c-.9 0-1.8-.2-2.6-.5l2.2-3.8h.8l2.2 3.8c-.8.3-1.7.5-2.6.5Zm3.7-1.2-2.2-3.8a3 3 0 0 0 1.4-2.3h4.4a7.3 7.3 0 0 1-3.6 6.1Z"/>`;

/** Fondo azul marino con el logotipo centrado ocupando `scale` del lado. */
function svg(size, { scale = 0.7, radius = 0, round = false } = {}) {
  const mark = size * scale;
  const off = (size - mark) / 2;
  const bg = round
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${NAVY}"/>`
    : `<rect width="${size}" height="${size}" rx="${radius}" fill="${NAVY}"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}
<g transform="translate(${off} ${off}) scale(${mark / 40})">${MARK}</g></svg>`,
  );
}

async function out(path, buffer, size) {
  mkdirSync(dirname(path), { recursive: true });
  await sharp(buffer).resize(size, size).png().toFile(path);
  console.log("✔", path);
}

// PWA / navegador
await out("public/icons/icon-192.png", svg(192), 192);
await out("public/icons/icon-512.png", svg(512), 512);
// "maskable": el contenido debe caber en el 80 % central
await out("public/icons/maskable-512.png", svg(512, { scale: 0.5 }), 512);
// iPhone (iOS aplica sus propias esquinas redondeadas)
await out("public/icons/apple-touch-icon.png", svg(180, { scale: 0.68 }), 180);

// Android (launcher clásico y redondo)
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, s] of Object.entries(densities)) {
  await out(`android/app/src/main/res/mipmap-${d}/ic_launcher.png`, svg(s, { radius: s * 0.18 }), s);
  await out(`android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`, svg(s, { round: true, scale: 0.62 }), s);
}
// Pantalla de inicio de Android
await out("android/app/src/main/res/drawable/splash.png", svg(288, { scale: 0.62, radius: 64 }), 288);
