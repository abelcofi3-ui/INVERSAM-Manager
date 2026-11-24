import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { createCustomer } from "../actions";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default async function NewCustomerPage({ searchParams }: PageProps<"/clientes/nuevo">) {
  await requirePage("customers.edit");
  const sp = await searchParams;
  // ?siguiente=vehiculo → tras guardar, abrir el alta de vehículo para ese cliente
  const next = sp.siguiente === "vehiculo" ? "/vehiculos/nuevo?cliente={id}" : undefined;
  return (
    <>
      <PageHeader title="Nuevo cliente" back={{ href: "/clientes", label: "Clientes" }} />
      <Card className="max-w-3xl">
        <CustomerForm action={createCustomer} cancelHref="/clientes" next={next} />
      </Card>
    </>
  );
}
