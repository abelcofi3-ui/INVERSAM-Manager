import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCustomerVehicleOptions } from "@/lib/queries";
import { updateVehicle } from "../../actions";
import { VehicleForm } from "../../vehicle-form";

export const metadata: Metadata = { title: "Editar vehículo" };

export default async function EditVehiclePage({ params }: PageProps<"/vehiculos/[id]/editar">) {
  await requirePage("vehicles.edit");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { customers }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).maybeSingle(),
    loadCustomerVehicleOptions(supabase),
  ]);
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Editar: ${data.brand} ${data.model}`} back={{ href: `/vehiculos/${id}`, label: "Volver al vehículo" }} />
      <Card className="max-w-3xl">
        <VehicleForm action={updateVehicle.bind(null, id)} customers={customers} values={data} cancelHref={`/vehiculos/${id}`} />
      </Card>
    </>
  );
}
