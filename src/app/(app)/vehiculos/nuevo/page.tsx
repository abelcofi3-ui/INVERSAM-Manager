import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCustomerVehicleOptions } from "@/lib/queries";
import { createVehicle } from "../actions";
import { VehicleForm } from "../vehicle-form";

export const metadata: Metadata = { title: "Nuevo vehículo" };

export default async function NewVehiclePage({ searchParams }: PageProps<"/vehiculos/nuevo">) {
  await requirePage("vehicles.edit");
  const sp = await searchParams;
  const customerId = typeof sp.cliente === "string" ? sp.cliente : undefined;
  const supabase = await createClient();
  const { customers } = await loadCustomerVehicleOptions(supabase);
  return (
    <>
      <PageHeader
        title="Nuevo vehículo"
        back={customerId ? { href: `/clientes/${customerId}`, label: "Volver al cliente" } : { href: "/vehiculos", label: "Vehículos" }}
      />
      <Card className="max-w-3xl">
        <VehicleForm
          action={createVehicle}
          customers={customers}
          values={{ customer_id: customerId }}
          cancelHref={customerId ? `/clientes/${customerId}` : "/vehiculos"}
        />
      </Card>
    </>
  );
}
