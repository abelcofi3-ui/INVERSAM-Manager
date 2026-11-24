import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/forms";
import { QuoteStatusBadge } from "@/components/badges";
import { ItemsEditor, type ItemRow } from "@/components/items-editor";
import { DocumentPdfButton } from "@/components/pdf-button";
import { Alert, Card, DescriptionList, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatHNL, hnDateString } from "@/lib/format";
import { ITEM_TYPE_LABELS, QUOTE_STATUS_LABELS, vehicleLabel, type QuoteStatus } from "@/lib/labels";
import { loadServices, loadSettings, loadTechnicians } from "@/lib/queries";
import { addQuoteItem, deleteQuote, deleteQuoteItem } from "../actions";
import { ConvertQuoteForm, QuoteDecision, QuoteEditForm } from "../quote-forms";

export const metadata: Metadata = { title: "Cotización" };

export default async function QuoteDetailPage({ params }: PageProps<"/cotizaciones/[id]">) {
  const session = await requirePage("quotes.view");
  const role = session.role;
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: q }, { data: items }, { data: orders }, services, technicians, settings] = await Promise.all([
    supabase
      .from("quotes")
      .select("*, customers(id, full_name, phone, email, rtn, address), vehicles(id, brand, model, year, plate)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("created_at"),
    supabase.from("work_orders").select("id, order_number").eq("quote_id", id),
    loadServices(supabase),
    loadTechnicians(supabase),
    loadSettings(supabase),
  ]);
  if (!q) notFound();

  const status = q.status as QuoteStatus;
  const editable = can(role, "quotes.edit") && (status === "borrador" || status === "enviada");
  const customer = q.customers as { id: string; full_name: string; phone: string | null; email: string | null; rtn: string | null; address: string | null };
  const vehicle = q.vehicles as { id: string; brand: string; model: string; year: number | null; plate: string | null } | null;
  const itemRows = (items ?? []) as ItemRow[];
  const order = orders?.[0];
  const { data: customerVehicles } = await supabase
    .from("vehicles")
    .select("id, brand, model, year, plate")
    .eq("customer_id", customer.id);
  const expired = q.valid_until && q.valid_until < hnDateString() && (status === "borrador" || status === "enviada");

  const pdfData = {
    kind: "cotizacion" as const,
    number: q.quote_number,
    status: QUOTE_STATUS_LABELS[status],
    issuedAt: q.issued_at,
    validUntil: q.valid_until,
    business: settings,
    customer,
    vehicle: vehicle ? vehicleLabel(vehicle) : null,
    notes: q.notes,
    items: itemRows.map((i) => ({
      type: ITEM_TYPE_LABELS[i.item_type],
      description: i.description,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      line_total: Number(i.line_total),
    })),
    totals: {
      subtotal: Number(q.subtotal),
      discount: Number(q.discount_amount),
      tax: Number(q.tax_amount),
      tax_rate: Number(q.tax_rate),
      total: Number(q.total),
    },
  };

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {q.quote_number} <QuoteStatusBadge status={status} />
          </span>
        }
        description={`${customer.full_name} · emitida ${formatDate(q.issued_at)}`}
        back={{ href: "/cotizaciones", label: "Cotizaciones" }}
        actions={
          <>
            <DocumentPdfButton data={pdfData} />
            {can(role, "quotes.delete") && !order && (
              <ActionButton action={deleteQuote} fields={{ id }} variant="dangerGhost" confirm="¿Eliminar esta cotización?">
                Eliminar
              </ActionButton>
            )}
          </>
        }
      />

      {expired && (
        <div className="mb-6">
          <Alert tone="amber">La vigencia de esta cotización venció el {formatDate(q.valid_until)}.</Alert>
        </div>
      )}
      {order && (
        <div className="mb-6">
          <Alert tone="green">
            Convertida en la orden{" "}
            <Link href={`/ordenes/${order.id}`} className="font-semibold underline">
              {order.order_number}
            </Link>
            .
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Datos">
            <DescriptionList
              items={[
                {
                  label: "Cliente",
                  value: (
                    <Link href={`/clientes/${customer.id}`} className="text-brand-800 hover:underline">
                      {customer.full_name}
                    </Link>
                  ),
                },
                { label: "Teléfono", value: customer.phone },
                { label: "Vehículo", value: vehicle ? vehicleLabel(vehicle) : null },
                { label: "Válida hasta", value: formatDate(q.valid_until) },
                { label: "Decisión", value: q.decided_at ? `${QUOTE_STATUS_LABELS[status]} · ${formatDateTime(q.decided_at)}` : null },
                { label: "Notas de la decisión", value: q.decision_notes },
                { label: "Observaciones", value: q.notes },
              ]}
            />
          </Card>
          <Card title="Servicios y repuestos" bodyClassName="p-0">
            <ItemsEditor
              items={itemRows}
              services={services}
              addAction={addQuoteItem.bind(null, id)}
              deleteAction={deleteQuoteItem}
              deleteFields={(it) => ({ item_id: it.id, quote_id: id })}
              editable={editable}
              lockedMessage={!editable && (status === "aprobada" || status === "rechazada") ? "La cotización está cerrada; reábrala para modificarla." : undefined}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Totales">
            <dl className="tabular space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd>{formatHNL(q.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Descuento{q.discount_type === "porcentaje" ? ` (${Number(q.discount_value)}%)` : ""}</dt>
                <dd>− {formatHNL(q.discount_amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">
                  {settings.tax_label} ({Number(q.tax_rate)}%)
                </dt>
                <dd>{formatHNL(q.tax_amount)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatHNL(q.total)}</dd>
              </div>
            </dl>
            {editable && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <QuoteEditForm
                  id={id}
                  taxLabel={settings.tax_label}
                  vehicles={(customerVehicles ?? []).map((v) => ({ value: v.id, label: vehicleLabel(v) }))}
                  values={{
                    vehicle_id: q.vehicle_id,
                    valid_until: q.valid_until,
                    notes: q.notes,
                    discount_type: q.discount_type,
                    discount_value: Number(q.discount_value),
                    tax_rate: Number(q.tax_rate),
                  }}
                />
              </div>
            )}
          </Card>

          {can(role, "quotes.edit") && !order && (
            <Card title="Aprobación">
              <QuoteDecision id={id} status={status} />
            </Card>
          )}

          {status === "aprobada" && !order && can(role, "orders.create") && (
            <Card title="Orden de trabajo">
              {q.vehicle_id ? (
                <ConvertQuoteForm id={id} technicians={technicians} defaultProblem={`Según cotización ${q.quote_number}`} />
              ) : (
                <p className="text-sm text-slate-500">
                  Asigne un vehículo a la cotización para convertirla en orden (reábrala para editarla).
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
