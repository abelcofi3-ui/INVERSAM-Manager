"use client";

import { useState, useSyncExternalStore } from "react";
import { CheckCircle2, Laptop, MonitorSmartphone, Share, Smartphone, SquarePlus } from "lucide-react";
import { useInstallPrompt } from "@/components/pwa";
import { btn, cx } from "@/components/ui";

type Platform = "android" | "ios" | "desktop";

function detect(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  // iPadOS se presenta como Mac con pantalla táctil
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "desktop";
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-white">{n}</span>
      <span className="pt-0.5 text-sm text-slate-700">{children}</span>
    </li>
  );
}

export function InstallOptions({ apkUrl, apkSize }: { apkUrl: string | null; apkSize: string | null }) {
  const platform = useSyncExternalStore<Platform | null>(
    () => () => {},
    detect,
    () => null, // en el servidor no se conoce el dispositivo
  );
  const { available, installed, install } = useInstallPrompt();
  const [result, setResult] = useState<string | null>(null);

  if (installed) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <CheckCircle2 className="h-5 w-5" /> Ya está usando INVERSAM Manager como aplicación instalada.
      </div>
    );
  }

  const installButton = available && (
    <button
      type="button"
      className={cx(btn.primary, "w-full sm:w-auto")}
      onClick={async () => setResult((await install()) ? "¡Listo! La app quedó instalada." : "Instalación cancelada.")}
    >
      <SquarePlus className="h-4 w-4" /> Instalar ahora
    </button>
  );

  const cards: { id: Platform; title: string; icon: React.ReactNode; body: React.ReactNode }[] = [
    {
      id: "android",
      title: "Android",
      icon: <Smartphone className="h-5 w-5" />,
      body: (
        <div className="space-y-4">
          {apkUrl ? (
            <>
              <a href={apkUrl} download className={cx(btn.primary, "w-full sm:w-auto")}>
                Descargar APK{apkSize ? ` (${apkSize})` : ""}
              </a>
              <ol className="space-y-2">
                <Step n={1}>Abra el archivo descargado.</Step>
                <Step n={2}>Si Android lo solicita, permita «Instalar apps desconocidas» para Chrome o su gestor de archivos.</Step>
                <Step n={3}>Abra <b>INVERSAM</b> desde el menú de aplicaciones e inicie sesión.</Step>
              </ol>
              <p className="text-xs text-slate-500">Requiere Google Chrome instalado (viene por defecto en la mayoría de teléfonos).</p>
            </>
          ) : (
            <p className="text-sm text-slate-600">El APK aún no está publicado en este servidor. Mientras tanto puede instalarla desde Chrome:</p>
          )}
          {!apkUrl && (
            <ol className="space-y-2">
              <Step n={1}>Abra esta página en <b>Chrome</b>.</Step>
              <Step n={2}>Toque el menú <b>⋮</b> → <b>Instalar aplicación</b> (o «Agregar a pantalla principal»).</Step>
            </ol>
          )}
          {platform === "android" && installButton}
        </div>
      ),
    },
    {
      id: "ios",
      title: "iPhone / iPad",
      icon: <MonitorSmartphone className="h-5 w-5" />,
      body: (
        <ol className="space-y-2">
          <Step n={1}>Abra esta página en <b>Safari</b>.</Step>
          <Step n={2}>
            Toque <b>Compartir</b> <Share className="inline h-4 w-4 align-text-bottom" /> en la barra inferior.
          </Step>
          <Step n={3}>
            Elija <b>Agregar a inicio</b> <SquarePlus className="inline h-4 w-4 align-text-bottom" /> y confirme con <b>Agregar</b>.
          </Step>
          <Step n={4}>Abra <b>INVERSAM</b> desde la pantalla de inicio: se abre a pantalla completa, como una app.</Step>
        </ol>
      ),
    },
    {
      id: "desktop",
      title: "PC (Windows / Mac)",
      icon: <Laptop className="h-5 w-5" />,
      body: (
        <div className="space-y-4">
          {platform === "desktop" && installButton}
          <ol className="space-y-2">
            <Step n={1}>Abra esta página en <b>Microsoft Edge</b> o <b>Google Chrome</b>.</Step>
            <Step n={2}>
              Haga clic en el ícono <b>Instalar</b> de la barra de direcciones (o menú <b>⋯ / ⋮</b> → <b>Aplicaciones</b> →{" "}
              <b>Instalar INVERSAM Manager</b>).
            </Step>
            <Step n={3}>La app queda en el menú Inicio / escritorio y se abre en su propia ventana. Puede anclarla a la barra de tareas.</Step>
          </ol>
        </div>
      ),
    },
  ];

  const ordered = platform ? [...cards.filter((c) => c.id === platform), ...cards.filter((c) => c.id !== platform)] : cards;

  return (
    <div className="space-y-4">
      {result && <p className="rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-900">{result}</p>}
      {ordered.map((c, i) => (
        <section
          key={c.id}
          className={cx("rounded-xl border bg-white p-5 shadow-sm", i === 0 && platform ? "border-brand-300 ring-2 ring-brand-100" : "border-slate-200")}
        >
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className="rounded-lg bg-brand-50 p-1.5 text-brand-700">{c.icon}</span>
            {c.title}
            {i === 0 && platform && <span className="ml-auto text-xs font-medium text-brand-700">Su dispositivo</span>}
          </h2>
          {c.body}
        </section>
      ))}
    </div>
  );
}
