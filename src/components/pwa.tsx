"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { Download } from "lucide-react";

/** Registra el service worker (solo en producción, para no interferir con el desarrollo). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((e) => console.warn("SW", e));
  }, []);
  return null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Hook: ¿el navegador ofrece instalación directa? y función para lanzarla. */
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useInstallPrompt() {
  const available = useSyncExternalStore(subscribe, () => Boolean(deferred), () => false);
  const installed = useSyncExternalStore(subscribe, isStandalone, () => false);
  const install = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    listeners.forEach((l) => l());
    return outcome === "accepted";
  };
  return { available, installed, install };
}

/** Enlace compacto en el menú lateral; se oculta si ya se usa como app instalada. */
export function InstallLink({ onNavigate }: { onNavigate?: () => void }) {
  const { installed } = useInstallPrompt();
  if (installed) return null;
  return (
    <Link
      href="/instalar"
      onClick={onNavigate}
      className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-200 hover:bg-white/5 hover:text-white"
    >
      <Download className="h-3.5 w-3.5" aria-hidden /> Instalar la app
    </Link>
  );
}
