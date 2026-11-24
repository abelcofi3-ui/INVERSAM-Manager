import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { ActionButton } from "@/components/forms";
import { OrderStatusBadge, QuoteStatusBadge } from "@/components/badges";
import { ButtonLink, Card, DescriptionList, EmptyState, PageHeader, StatCard, TableWrap } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatHNL, formatNumber } from "@/lib/format";
import { VEHICLE_TYPE_LABELS, vehicleLabel, type QuoteStatus, type VehicleType, type WorkOrderStatus } from "@/lib/labels";
import { deleteCustomer } from "../actions";

export const metadata: Metadata = { title: "Cliente" };

export default async function CustomerDetailPage({ params }: PageProps<"/clientes/[id]">) {
  const session = await requirePage("customers.view");
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: c }, { data: vehicles }, { data: orders }, { data: quotes }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.from("vehicles").select("*").eq("customer_id", id).order("created_at"),
    supabase
      .from("work_orders")
      .select("id, order_number, status, received_at, total, balance, reported_problem, vehicles(brand, model, year, plate)")
      .eq("customer_id", id)
      .order("received_at", { ascending: false })
      .limit(100),
    supabase
      .from("quotes")
      .select("id, quote_number, status, issued_at, total")
      .eq("customer_id", id)
      .order("issued_at", { ascending: false })
      .limit(50),
  ]);
  if (!c) notFound();

  type OrderRow = {
    id: string;
    order_number: string;
    status: WorkOrderStatus;
    received_at: string;
    total: string;
    balance: string;
    reported_problem: string;
    vehicles: { brand: string; model: string; year: number | null; plate: string | null } | null;
  };
  const orderRows = (orders ?? []) as unknown as OrderRow[];
  const billed = orderRows.reduce((s, o) => s + Number(o.total), 0);
  const pending = orderRows.reduce((s, o) => s + Math.max(Number(o.balance), 0), 0);
  const showMoney = can(session.role, "dashboard.finance");

  return (
    <>
      <PageHeader
        title={c.full_name}
        description={`Cliente desde ${formatDate(c.created_at)}`}
        back={{ href: "/clientes", label: "Clientes" }}
        actions={
          <>
            {can(session.role, "orders.create") && (
              <ButtonLink href={`/ordenes/nueva?cliente=${id}`}>
                <Plus className="h-4 w-4" /> Nueva orden
              </ButtonLink>
            )}
            {can(session.role, "customers.edit") && (
              <ButtonLink variant="secondary" href={`/clientes/${id}/editar`}>
                <Pencil className="h-4 w-4" /> Editar
              </ButtonLink>
            )}
            {can(session.role, "customers.delete") && (
              <ActionButton
                action={deleteCustomer}
                fields={{ id }}
                variant="dangerGhost"
                confirm="¿Eliminar este cliente y sus vehículos? Esta acción no se puede deshacer."
              >
                Eliminar
              </ActionButton>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Órdenes" value={orderRows.length} />
        {showMoney && <StatCard label="Total facturado" value={formatHNL(billed)} />}
        {showMoney && <StatCard label="Saldo pendiente" value={formatHNL(pending)} />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Datos de contacto" className="lg:col-span-1">
          <DescriptionList
            items={[
              { label: "Teléfono", value: c.phone },
              { label: "Correo", value: c.email },
              { label: "RTN", value: c.rtn },
              { label: "Dirección", value: c.address },
              { label: "Notas", value: c.notes },
            ]}
          />
        </Card>

        <Card
          title="Vehículos"
          className="lg:col-span-2"
          bodyClassName="p-0"
          actions={
            can(session.role, "vehicles.edit") && (
              <ButtonLink variant="secondary" className="px-2.5 py-1.5 text-xs" href={`/vehiculos/nuevo?cliente=${id}`}>
                <Plus className="h-3.5 w-3.5" /> Agregar vehículo
              </ButtonLink>
            )
          }
        >
          {!vehicles?.length ? (
            <EmptyState title="Sin vehículos registrados" />
          ) : (
            <TableWrap>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vehículo</th>
                    <th>Placa</th>
                    <th className="hidden sm:table-cell">Tipo</th>
                    <th className="num">Kilometraje</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <Link href={`/vehiculos/${v.id}`} className="font-medium text-brand-800 hover:underline">
                          {[v.brand, v.model, v.year].filter(Boolean).join(" ")}
                        </Link>
                      </td>
                      <td>{v.plate ?? "—"}</td>
                      <td className="hidden sm:table-cell">{VEHICLE_TYPE_LABELS[v.vehicle_type as VehicleType]}</td>
                      <td className="num">{v.mileage != null ? `${formatNumber(v.mileage)} km` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>

      <Card title="Historial de servicios" className="mt-6" bodyClassName="p-0">
        {!orderRows.length ? (
          <EmptyState title="Sin órdenes de trabajo" />
        ) : (
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Fecha</th>
                  <th className="hidden md:table-cell">Vehículo</th>
                  <th className="hidden lg:table-cell">Problema reportado</th>
                  <th>Estado</th>
                  {showMoney && <th className="num">Total</th>}
                  {showMoney && <th className="num">Saldo</th>}
                </tr>
              </thead>
              <tbody>
                {orderRows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/ordenes/${o.id}`} className="font-medium text-brand-800 hover:underline">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{formatDate(o.received_at)}</td>
                    <td className="hidden md:table-cell">{vehicleLabel(o.vehicles)}</td>
                    <td className="hidden max-w-xs truncate lg:table-cell">{o.reported_problem}</td>
                    <td>
                      <OrderStatusBadge status={o.status} />
                    </td>
                    {showMoney && <td className="num">{formatHNL(o.total)}</td>}
                    {showMoney && <td className="num">{formatHNL(o.balance)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      {!!quotes?.length && (
        <Card title="Cotizaciones" className="mt-6" bodyClassName="p-0">
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cotización</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <Link href={`/cotizaciones/${q.id}`} className="font-medium text-brand-800 hover:underline">
                        {q.quote_number}
                      </Link>
                    </td>
                    <td>{formatDate(q.issued_at)}</td>
                    <td>
                      <QuoteStatusBadge status={q.status as QuoteStatus} />
                    </td>
                    <td className="num">{formatHNL(q.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}
    </>
  );
}
