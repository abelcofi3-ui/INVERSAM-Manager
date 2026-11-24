import type { Metadata } from "next";
import { Alert, ButtonLink, Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCustomerVehicleOptions, loadServices, loadSettings, loadTechnicians } from "@/lib/queries";
import { toLocalInputValue } from "@/lib/format";
import { OrderCreateForm } from "./order-create-form";

export const metadata: Metadata = { title: "Nueva orden" };

export default async function NewOrderPage({ searchParams }: PageProps<"/ordenes/nueva">) {
  await requirePage("orders.create");
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ customers, vehicles }, technicians, services, settings] = await Promise.all([
    loadCustomerVehicleOptions(supabase),
    loadTechnicians(supabase),
    loadServices(supabase),
    loadSettings(supabase),
  ]);

  return (
    <>
      <PageHeader title="Nueva orden de trabajo" back={{ href: "/ordenes", label: "Órdenes" }} />
      {customers.length === 0 ? (
        <Alert tone="blue">
          Primero registre un cliente y su vehículo.{" "}
          <ButtonLink href="/clientes/nuevo?siguiente=vehiculo" variant="secondary" className="ml-2">
            Registrar cliente
          </ButtonLink>
        </Alert>
      ) : (
        <Card className="max-w-4xl">
          <OrderCreateForm
            customers={customers}
            vehicles={vehicles}
            technicians={technicians}
            services={services}
            taxRate={settings.tax_rate}
            taxLabel={settings.tax_label}
            defaultCustomerId={typeof sp.cliente === "string" ? sp.cliente : undefined}
            defaultVehicleId={typeof sp.vehiculo === "string" ? sp.vehiculo : undefined}
            nowLocal={toLocalInputValue(new Date())}
          />
        </Card>
      )}
    </>
  );
}
