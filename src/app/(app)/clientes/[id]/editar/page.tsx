import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateCustomer } from "../../actions";
import { CustomerForm } from "../../customer-form";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditCustomerPage({ params }: PageProps<"/clientes/[id]/editar">) {
  await requirePage("customers.edit");
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Editar: ${data.full_name}`} back={{ href: `/clientes/${id}`, label: "Volver al cliente" }} />
      <Card className="max-w-3xl">
        <CustomerForm action={updateCustomer.bind(null, id)} values={data} cancelHref={`/clientes/${id}`} />
      </Card>
    </>
  );
}
