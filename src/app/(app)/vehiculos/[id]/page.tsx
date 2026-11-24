import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { ActionButton } from "@/components/forms";
import { OrderStatusBadge } from "@/components/badges";
import { ButtonLink, Card, DescriptionList, EmptyState, PageHeader, TableWrap } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatHNL, formatNumber } from "@/lib/format";
import { VEHICLE_TYPE_LABELS, type VehicleType, type WorkOrderStatus } from "@/lib/labels";
import { deleteVehicle } from "../actions";

export const metadata: Metadata = { title: "Vehículo" };

export default async function VehicleDetailPage({ params }: PageProps<"/vehiculos/[id]">) {
  const session = await requirePage("vehicles.view");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: v }, { data: orders }] = await Promise.all([
    supabase.from("vehicles").select("*, customers(id, full_name, phone)").eq("id", id).maybeSingle(),
    supabase
      .from("work_orders")
      .select("id, order_number, status, received_at, mileage_in, reported_problem, diagnosis, total, work_order_items(description, item_type)")
      .eq("vehicle_id", id)
      .order("received_at", { ascending: false })
      .limit(200),
  ]);
  if (!v) notFound();

  type OrderRow = {
    id: string;
    order_number: string;
    status: WorkOrderStatus;
    received_at: string;
    mileage_in: number | null;
    reported_problem: string;
    diagnosis: string | null;
    total: string;
    work_order_items: { description: string; item_type: string }[];
  };
  const rows = (orders ?? []) as unknown as OrderRow[];
  const owner = v.customers as { id: string; full_name: string; phone: string | null } | null;
  const showMoney = can(session.role, "dashboard.finance");

  return (
    <>
      <PageHeader
        title={[v.brand, v.model, v.year].filter(Boolean).join(" ")}
        description={v.plate ? `Placa ${v.plate}` : "Sin placa registrada"}
        back={{ href: "/vehiculos", label: "Vehículos" }}
        actions={
          <>
            {can(session.role, "orders.create") && (
              <ButtonLink href={`/ordenes/nueva?cliente=${v.customer_id}&vehiculo=${id}`}>
                <Plus className="h-4 w-4" /> Nueva orden
              </ButtonLink>
            )}
            {can(session.role, "vehicles.edit") && (
              <ButtonLink variant="secondary" href={`/vehiculos/${id}/editar`}>
                <Pencil className="h-4 w-4" /> Editar
              </ButtonLink>
            )}
            {can(session.role, "vehicles.delete") && (
              <ActionButton action={deleteVehicle} fields={{ id }} variant="dangerGhost" confirm="¿Eliminar este vehículo?">
                Eliminar
              </ActionButton>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Datos del vehículo" className="lg:col-span-1">
          <DescriptionList
            items={[
              {
                label: "Propietario",
                value: owner ? (
                  <Link href={`/clientes/${owner.id}`} className="text-brand-800 hover:underline">
                    {owner.full_name}
                  </Link>
                ) : null,
              },
              { label: "Teléfono", value: owner?.phone },
              { label: "Tipo", value: VEHICLE_TYPE_LABELS[v.vehicle_type as VehicleType] },
              { label: "Color", value: v.color },
              { label: "VIN", value: v.vin ? <span className="font-mono text-xs">{v.vin}</span> : null },
              { label: "Kilometraje", value: v.mileage != null ? `${formatNumber(v.mileage)} km` : null },
              { label: "Notas", value: v.notes },
            ]}
          />
        </Card>
        <Card title="Historial de mantenimiento" className="lg:col-span-2" bodyClassName="p-0">
          {!rows.length ? (
            <EmptyState title="Sin servicios registrados para este vehículo" />
          ) : (
            <TableWrap>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Fecha</th>
                    <th className="num">Km</th>
                    <th>Trabajos</th>
                    <th>Estado</th>
                    {showMoney && <th className="num">Total</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/ordenes/${o.id}`} className="font-medium text-brand-800 hover:underline">
                          {o.order_number}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">{formatDate(o.received_at)}</td>
                      <td className="num">{o.mileage_in != null ? formatNumber(o.mileage_in) : "—"}</td>
                      <td className="max-w-xs">
                        <p className="truncate">
                          {o.work_order_items
                            .filter((i) => i.item_type === "servicio")
                            .map((i) => i.description)
                            .join(", ") || o.reported_problem}
                        </p>
                      </td>
                      <td>
                        <OrderStatusBadge status={o.status} />
                      </td>
                      {showMoney && <td className="num">{formatHNL(o.total)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>
    </>
  );
}
