import type { Metadata } from "next";
import { DatabaseBackup } from "lucide-react";
import { Card, PageHeader, btn } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/queries";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  await requirePage("settings.manage");
  const supabase = await createClient();
  const settings = await loadSettings(supabase);
  return (
    <>
      <PageHeader title="Configuración" description="Datos del negocio, impuestos y respaldos." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Datos del negocio e impuestos" className="lg:col-span-2">
          <SettingsForm values={settings} />
        </Card>
        <Card title="Respaldo de datos">
          <p className="text-sm text-slate-600">
            Descarga una copia completa (JSON) de clientes, vehículos, órdenes, cotizaciones, pagos, gastos, citas, cierres y
            configuración. Guárdela en un lugar seguro.
          </p>
          <a href="/api/respaldo" className={`${btn.primary} mt-4 w-full`}>
            <DatabaseBackup className="h-4 w-4" /> Descargar respaldo
          </a>
          <p className="mt-4 text-xs text-slate-500">
            Además del respaldo manual, active los respaldos automáticos de Supabase (plan Pro: diarios y PITR) o programe{" "}
            <code>pg_dump</code>. Ver README, sección «Respaldos».
          </p>
        </Card>
      </div>
    </>
  );
}
