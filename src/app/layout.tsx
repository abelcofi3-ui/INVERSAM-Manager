import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "INVERSAM Manager", template: "%s · INVERSAM" },
  description: "Sistema de gestión para el taller de mecánica rápida INVERSAM — Santa Bárbara, Honduras.",
  robots: { index: false, follow: false },
  applicationName: "INVERSAM Manager",
  // iPhone/iPad: app a pantalla completa al agregarla a la pantalla de inicio desde Safari
  appleWebApp: { capable: true, title: "INVERSAM", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0f1e4a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-HN" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
