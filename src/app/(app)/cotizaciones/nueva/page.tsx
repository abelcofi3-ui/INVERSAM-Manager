import type { Metadata } from "next";
import { Alert, ButtonLink, Card, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, hnDateString } from "@/lib/format";
import { loadCustomerVehicleOptions, loadSettings } from "@/lib/queries";
import { QuoteCreateForm } from "../quote-forms";

export const metadata: Metadata = { title: "Nueva cotización" };

export default async function NewQuotePage({ searchParams }: PageProps<"/cotizaciones/nueva">) {
  await requirePage("quotes.edit");
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ customers, vehicles }, settings] = await Promise.all([loadCustomerVehicleOptions(supabase), loadSettings(supabase)]);
  return (
    <>
      <PageHeader title="Nueva cotización" back={{ href: "/cotizaciones", label: "Cotizaciones" }} />
      {customers.length === 0 ? (
        <Alert tone="blue">
          Primero registre un cliente.{" "}
          <ButtonLink href="/clientes/nuevo" variant="secondary" className="ml-2">
            Registrar cliente
          </ButtonLink>
        </Alert>
      ) : (
        <Card className="max-w-3xl">
          <QuoteCreateForm
            customers={customers}
            vehicles={vehicles}
            taxRate={settings.tax_rate}
            taxLabel={settings.tax_label}
            validUntil={addDays(hnDateString(), settings.quote_validity_days)}
            defaultCustomerId={typeof sp.cliente === "string" ? sp.cliente : undefined}
          />
        </Card>
      )}
    </>
  );
}
