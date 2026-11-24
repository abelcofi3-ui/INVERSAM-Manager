import type { Metadata } from "next";
import Link from "next/link";
import { statSync } from "node:fs";
import { join } from "node:path";
import { BrandWordmark } from "@/components/brand";
import { InstallOptions } from "./install-options";

export const metadata: Metadata = { title: "Instalar la app" };
export const dynamic = "force-dynamic";

const APK_PATH = "/descargas/inversam-manager.apk";

function apkInfo() {
  try {
    const s = statSync(join(process.cwd(), "public", APK_PATH));
    return { url: APK_PATH, size: `${(s.size / 1024 / 1024).toFixed(1)} MB` };
  } catch {
    return { url: null, size: null };
  }
}

export default function InstallPage() {
  const apk = apkInfo();
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-brand-950 px-4 py-5">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <BrandWordmark />
          <Link href="/" className="text-sm font-medium text-brand-200 hover:text-white">
            Ir al sistema →
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-slate-900">Instalar INVERSAM Manager</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          Use el sistema como una aplicación en su teléfono o computadora. Siempre muestra los datos actualizados y requiere internet.
        </p>
        <InstallOptions apkUrl={apk.url} apkSize={apk.size} />
      </main>
    </div>
  );
}
