import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { ActionButton } from "@/components/forms";
import { BalanceBadge, OrderStatusBadge } from "@/components/badges";
import { ItemsEditor, type ItemRow } from "@/components/items-editor";
import { PaymentForm } from "@/components/payment-form";
import { DocumentPdfButton } from "@/components/pdf-button";
import { Alert, Badge, Card, DescriptionList, EmptyState, PageHeader, TableWrap, cx } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatHNL, formatNumber, toLocalInputValue } from "@/lib/format";
import {
  ITEM_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS_LABELS,
  vehicleLabel,
  type PaymentMethod,
  type WorkOrderStatus,
} from "@/lib/labels";
import { loadServices, loadSettings, loadTechnicians } from "@/lib/queries";
import { addWorkOrderItem, deleteWorkOrder, deleteWorkOrderItem } from "../actions";
import { DeletePhotoButton, OrderInfoForm, PhotoUploader, PricingForm, StatusControl, VoidPaymentButton } from "./order-components";

export const metadata: Metadata = { title: "Orden de trabajo" };

export default async function OrderDetailPage({ params }: PageProps<"/ordenes/[id]">) {
  const session = await requirePage("orders.view");
  const { id } = await params;
  const supabase = await createClient();
  const role = session.role;
  const canCash = can(role, "cash.view");

  const [{ data: o }, { data: items }, { data: photos }, { data: history }, paymentsRes, services, technicians, settings] =
    await Promise.all([
      supabase
        .from("work_orders")
        .select(
          "*, customers(id, full_name, phone, email, rtn, address), vehicles(id, brand, model, year, plate, vin), technician:profiles!work_orders_technician_id_fkey(full_name), quotes(id, quote_number)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("work_order_items").select("*").eq("work_order_id", id).order("created_at"),
      supabase.from("work_order_photos").select("*").eq("work_order_id", id).order("created_at"),
      supabase
        .from("work_order_status_history")
        .select("id, from_status, to_status, changed_at, profiles(full_name)")
        .eq("work_order_id", id)
        .order("changed_at", { ascending: false }),
      canCash
        ? supabase
            .from("payments")
            .select("*, profiles!payments_received_by_fkey(full_name)")
            .eq("work_order_id", id)
            .order("paid_at", { ascending: false })
        : Promise.resolve({ data: [] as never[] }),
      loadServices(supabase),
      loadTechnicians(supabase),
      loadSettings(supabase),
    ]);
  if (!o) notFound();

  const status = o.status as WorkOrderStatus;
  const delivered = status === "entregado";
  const customer = o.customers as { id: string; full_name: string; phone: string | null; email: string | null; rtn: string | null; address: string | null };
  const vehicle = o.vehicles as { id: string; brand: string; model: string; year: number | null; plate: string | null; vin: string | null };
  const technician = (o.technician as { full_name: string } | null)?.full_name ?? null;
  const quote = o.quotes as { id: string; quote_number: string } | null;
  const itemRows = (items ?? []) as ItemRow[];
  const payments = (paymentsRes.data ?? []) as {
    id: string;
    amount: string;
    method: PaymentMethod;
    reference: string | null;
    paid_at: string;
    voided: boolean;
    void_reason: string | null;
    cash_closing_id: string | null;
    profiles: { full_name: string } | null;
  }[];

  const total = Number(o.total);
  const balance = Number(o.balance);
  const paid = Number(o.amount_paid);
  const currentIndex = WORK_ORDER_STATUSES.indexOf(status);
  const showMoney = can(role, "dashboard.finance");

  // Fotos con URL firmada (bucket privado)
  let photoUrls: Record<string, string> = {};
  if (photos?.length) {
    const { data: signed } = await supabase.storage
      .from("work-order-photos")
      .createSignedUrls(photos.map((p) => p.storage_path), 60 * 60);
    photoUrls = Object.fromEntries((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  }

  const pdfData = {
    kind: "orden" as const,
    number: o.order_number,
    status: WORK_ORDER_STATUS_LABELS[status],
    issuedAt: o.received_at,
    business: settings,
    customer,
    vehicle: vehicleLabel(vehicle),
    mileage: o.mileage_in,
    technician,
    reportedProblem: o.reported_problem,
    diagnosis: o.diagnosis,
    notes: o.notes,
    items: itemRows.map((i) => ({
      type: ITEM_TYPE_LABELS[i.item_type],
      description: i.description,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      line_total: Number(i.line_total),
    })),
    totals: {
      subtotal: Number(o.subtotal),
      discount: Number(o.discount_amount),
      tax: Number(o.tax_amount),
      tax_rate: Number(o.tax_rate),
      total,
      paid,
      balance,
    },
  };

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {o.order_number} <OrderStatusBadge status={status} />
          </span>
        }
        description={`${customer.full_name} · ${vehicleLabel(vehicle)}`}
        back={{ href: "/ordenes", label: "Órdenes" }}
        actions={
          <>
            <DocumentPdfButton data={pdfData} />
            {can(role, "orders.delete") && (
              <ActionButton
                action={deleteWorkOrder}
                fields={{ id }}
                variant="dangerGhost"
                confirm="¿Eliminar esta orden? Se borrarán sus partidas y fotos."
              >
                Eliminar
              </ActionButton>
            )}
          </>
        }
      />

      {/* Línea de estados */}
      <Card className="mb-6" bodyClassName="p-4">
        <ol className="flex flex-wrap items-center gap-y-2 text-xs">
          {WORK_ORDER_STATUSES.map((s, i) => (
            <li key={s} className="flex items-center">
              <span
                className={cx(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
                  i < currentIndex && "text-emerald-700",
                  i === currentIndex && "bg-brand-900 text-white",
                  i > currentIndex && "text-slate-400",
                )}
              >
                {i < currentIndex && <Check className="h-3.5 w-3.5" />}
                {WORK_ORDER_STATUS_LABELS[s]}
              </span>
              {i < WORK_ORDER_STATUSES.length - 1 && <span className="mx-1 h-px w-4 bg-slate-300" />}
            </li>
          ))}
        </ol>
        {can(role, "orders.edit") && (!delivered || role === "admin") && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <StatusControl id={id} status={status} allowDeliver={can(role, "orders.pricing")} />
          </div>
        )}
      </Card>

      {delivered && balance > 0 && showMoney && (
        <div className="mb-6">
          <Alert tone="red">Vehículo entregado con saldo pendiente de {formatHNL(balance)}.</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Información de la orden"
            actions={
              can(role, "orders.edit") &&
              !delivered && (
                <OrderInfoForm
                  id={id}
                  technicians={technicians}
                  values={{
                    mileage_in: o.mileage_in,
                    reported_problem: o.reported_problem,
                    diagnosis: o.diagnosis,
                    technician_id: o.technician_id,
                    promised_at: toLocalInputValue(o.promised_at),
                    notes: o.notes,
                  }}
                />
              )
            }
          >
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
                {
                  label: "Vehículo",
                  value: (
                    <Link href={`/vehiculos/${vehicle.id}`} className="text-brand-800 hover:underline">
                      {vehicleLabel(vehicle)}
                    </Link>
                  ),
                },
                { label: "Kilometraje de entrada", value: o.mileage_in != null ? `${formatNumber(o.mileage_in)} km` : null },
                { label: "Técnico responsable", value: technician },
                { label: "Entrada", value: formatDateTime(o.received_at) },
                { label: "Entrega estimada", value: o.promised_at ? formatDateTime(o.promised_at) : null },
                { label: "Finalizado", value: o.finished_at ? formatDateTime(o.finished_at) : null },
                { label: "Entregado", value: o.delivered_at ? formatDateTime(o.delivered_at) : null },
                {
                  label: "Cotización de origen",
                  value: quote ? (
                    <Link href={`/cotizaciones/${quote.id}`} className="text-brand-800 hover:underline">
                      {quote.quote_number}
                    </Link>
                  ) : null,
                },
              ]}
            />
            <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-slate-500">Problema reportado</p>
                <p className="mt-1 text-sm whitespace-pre-line">{o.reported_problem}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Diagnóstico</p>
                <p className="mt-1 text-sm whitespace-pre-line">{o.diagnosis || <span className="text-slate-400">Pendiente</span>}</p>
              </div>
              {o.notes && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-slate-500">Observaciones</p>
                  <p className="mt-1 text-sm whitespace-pre-line">{o.notes}</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Servicios, repuestos y mano de obra" bodyClassName="p-0">
            <ItemsEditor
              items={itemRows}
              services={services}
              addAction={addWorkOrderItem.bind(null, id)}
              deleteAction={deleteWorkOrderItem}
              deleteFields={(it) => ({ item_id: it.id, order_id: id })}
              editable={can(role, "orders.edit") && !delivered}
              lockedMessage={delivered ? "La orden fue entregada; las partidas están bloqueadas." : undefined}
            />
          </Card>

          <Card title={`Fotografías (${photos?.length ?? 0})`}>
            {can(role, "orders.edit") && (
              <div className="mb-4">
                <PhotoUploader orderId={id} />
              </div>
            )}
            {!photos?.length ? (
              <p className="text-sm text-slate-500">Sin fotografías.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((p) => (
                  <li key={p.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {photoUrls[p.storage_path] ? (
                      <a href={photoUrls[p.storage_path]} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Supabase */}
                        <img src={photoUrls[p.storage_path]} alt={p.caption ?? "Foto de la orden"} className="aspect-square w-full object-cover" loading="lazy" />
                      </a>
                    ) : (
                      <div className="flex aspect-square items-center justify-center text-xs text-slate-400">No disponible</div>
                    )}
                    <div className="px-2 py-1.5">
                      <p className="truncate text-xs text-slate-700">{p.caption ?? "Sin descripción"}</p>
                      <p className="text-[10px] text-slate-400">{formatDateTime(p.created_at)}</p>
                    </div>
                    {can(role, "photos.delete") && (
                      <div className="absolute top-1.5 right-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        <DeletePhotoButton photoId={p.id} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Totales">
            <dl className="tabular space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd>{formatHNL(o.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">
                  Descuento{o.discount_type === "porcentaje" ? ` (${Number(o.discount_value)}%)` : ""}
                </dt>
                <dd>− {formatHNL(o.discount_amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">
                  {settings.tax_label} ({Number(o.tax_rate)}%)
                </dt>
                <dd>{formatHNL(o.tax_amount)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatHNL(total)}</dd>
              </div>
              {showMoney && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Pagado</dt>
                    <dd>{formatHNL(paid)}</dd>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <dt>Saldo</dt>
                    <dd className="flex items-center gap-2">
                      <BalanceBadge balance={balance} total={total} /> {formatHNL(balance)}
                    </dd>
                  </div>
                </>
              )}
            </dl>
            {can(role, "orders.pricing") && !delivered && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <PricingForm
                  id={id}
                  discountType={o.discount_type}
                  discountValue={Number(o.discount_value)}
                  taxRate={Number(o.tax_rate)}
                  taxLabel={settings.tax_label}
                />
              </div>
            )}
          </Card>

          {canCash && (
            <Card title="Pagos" bodyClassName="p-0">
              {can(role, "payments.create") && balance > 0 && (
                <div className="border-b border-slate-100 p-5">
                  <PaymentForm workOrderId={id} balance={balance} />
                </div>
              )}
              {!payments.length ? (
                <EmptyState title="Sin pagos registrados" />
              ) : (
                <TableWrap>
                  <table className="data-table">
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className={p.voided ? "opacity-60" : ""}>
                          <td>
                            <p className={cx("font-medium", p.voided && "line-through")}>{formatHNL(p.amount)}</p>
                            <p className="text-xs text-slate-500">
                              {PAYMENT_METHOD_LABELS[p.method]}
                              {p.reference ? ` · ${p.reference}` : ""}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {formatDateTime(p.paid_at)}
                              {p.profiles?.full_name ? ` · ${p.profiles.full_name}` : ""}
                            </p>
                            {p.voided && <p className="text-[11px] text-red-600">Anulado: {p.void_reason}</p>}
                          </td>
                          <td className="text-right">
                            {p.voided ? (
                              <Badge tone="red">Anulado</Badge>
                            ) : p.cash_closing_id ? (
                              <Badge tone="slate">En cierre</Badge>
                            ) : (
                              can(role, "payments.void") && <VoidPaymentButton paymentId={p.id} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Card>
          )}

          <Card title="Historial de estados">
            {!history?.length ? (
              <p className="text-sm text-slate-500">Sin movimientos.</p>
            ) : (
              <ol className="space-y-3">
                {(history as unknown as { id: number; to_status: WorkOrderStatus; changed_at: string; profiles: { full_name: string } | null }[]).map(
                  (h) => (
                    <li key={h.id} className="flex gap-3 text-sm">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                      <div>
                        <p className="font-medium">{WORK_ORDER_STATUS_LABELS[h.to_status]}</p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(h.changed_at)}
                          {h.profiles?.full_name ? ` · ${h.profiles.full_name}` : ""}
                        </p>
                      </div>
                    </li>
                  ),
                )}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
