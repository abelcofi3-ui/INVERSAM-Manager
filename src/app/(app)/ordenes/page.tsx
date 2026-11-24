import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { BalanceBadge, OrderStatusBadge } from "@/components/badges";
import { ButtonLink, Card, EmptyState, FilterBar, Pagination, PageHeader, TableWrap, cx, ilikeTerm, inputClass, pageParams, str } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatHNL, hnDayStartISO, addDays } from "@/lib/format";
import { WORK_ORDER_STATUSES, vehicleLabel, type WorkOrderStatus } from "@/lib/labels";
import { loadTechnicians } from "@/lib/queries";

export const metadata: Metadata = { title: "Órdenes de trabajo" };

const TABS = [
  { value: "abiertas", label: "Abiertas" },
  { value: "en_reparacion", label: "En reparación" },
  { value: "finalizado", label: "Por entregar" },
  { value: "entregado", label: "Entregadas" },
  { value: "todas", label: "Todas" },
];

export default async function OrdersPage({ searchParams }: PageProps<"/ordenes">) {
  const session = await requirePage("orders.view");
  const sp = await searchParams;
  const estado = str(sp.estado) ?? "abiertas";
  const q = str(sp.q);
  const tecnico = str(sp.tecnico);
  const desde = str(sp.desde);
  const hasta = str(sp.hasta);
  const saldo = str(sp.saldo);
  const { page, pageSize, from, to } = pageParams(sp);
  const showMoney = can(session.role, "dashboard.finance");

  const supabase = await createClient();
  let query = supabase
    .from("work_orders")
    .select(
      "id, order_number, status, received_at, promised_at, total, balance, reported_problem, customers!inner(id, full_name), vehicles(brand, model, year, plate), technician:profiles!work_orders_technician_id_fkey(full_name)",
      { count: "exact" },
    );
  if (estado === "abiertas") query = query.not("status", "in", "(finalizado,entregado)");
  else if ((WORK_ORDER_STATUSES as readonly string[]).includes(estado)) query = query.eq("status", estado);
  if (q) {
    const t = ilikeTerm(q);
    query = query.or(`order_number.ilike.${t},reported_problem.ilike.${t}`);
  }
  if (tecnico) query = query.eq("technician_id", tecnico);
  if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) query = query.gte("received_at", hnDayStartISO(desde));
  if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) query = query.lt("received_at", hnDayStartISO(addDays(hasta, 1)));
  if (saldo === "1") query = query.gt("balance", 0);

  const [{ data, count, error }, technicians] = await Promise.all([
    query.order("received_at", { ascending: false }).range(from, to),
    loadTechnicians(supabase),
  ]);

  type Row = {
    id: string;
    order_number: string;
    status: WorkOrderStatus;
    received_at: string;
    promised_at: string | null;
    total: string;
    balance: string;
    reported_problem: string;
    customers: { id: string; full_name: string };
    vehicles: { brand: string; model: string; year: number | null; plate: string | null } | null;
    technician: { full_name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const params = { estado, q, tecnico, desde, hasta, saldo };
  const tabHref = (v: string) => {
    const s = new URLSearchParams();
    s.set("estado", v);
    if (q) s.set("q", q);
    return `/ordenes?${s.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Órdenes de trabajo"
        description="Recepción, diagnóstico, reparación y entrega de vehículos."
        actions={
          can(session.role, "orders.create") && (
            <ButtonLink href="/ordenes/nueva">
              <Plus className="h-4 w-4" /> Nueva orden
            </ButtonLink>
          )
        }
      />

      <div className="no-print mb-4 flex gap-1 overflow-x-auto rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={tabHref(t.value)}
            className={cx(
              "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
              estado === t.value ? "bg-brand-900 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <FilterBar action="/ordenes">
        <input type="hidden" name="estado" value={estado} />
        <div className="w-full sm:w-64">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate-700">Buscar</label>
          <input id="q" name="q" defaultValue={q} placeholder="No. de orden o problema" className={inputClass} />
        </div>
        <div>
          <label htmlFor="tecnico" className="mb-1 block text-xs font-medium text-slate-700">Técnico</label>
          <select id="tecnico" name="tecnico" defaultValue={tecnico ?? ""} className={inputClass}>
            <option value="">Todos</option>
            {technicians.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="desde" className="mb-1 block text-xs font-medium text-slate-700">Desde</label>
          <input id="desde" name="desde" type="date" defaultValue={desde} className={inputClass} />
        </div>
        <div>
          <label htmlFor="hasta" className="mb-1 block text-xs font-medium text-slate-700">Hasta</label>
          <input id="hasta" name="hasta" type="date" defaultValue={hasta} className={inputClass} />
        </div>
        {showMoney && (
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" name="saldo" value="1" defaultChecked={saldo === "1"} className="h-4 w-4 rounded border-slate-300" />
            Con saldo pendiente
          </label>
        )}
      </FilterBar>

      <Card bodyClassName="p-0">
        {error ? (
          <EmptyState title="No se pudieron cargar las órdenes" description={error.message} />
        ) : rows.length === 0 ? (
          <EmptyState title="No hay órdenes con estos filtros" />
        ) : (
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Entrada</th>
                  <th>Cliente</th>
                  <th className="hidden md:table-cell">Vehículo</th>
                  <th className="hidden lg:table-cell">Técnico</th>
                  <th>Estado</th>
                  {showMoney && <th className="num">Total</th>}
                  {showMoney && <th className="hidden sm:table-cell">Pago</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/ordenes/${o.id}`} className="font-medium text-brand-800 hover:underline">
                        {o.order_number}
                      </Link>
                      <p className="max-w-[14rem] truncate text-xs text-slate-500">{o.reported_problem}</p>
                    </td>
                    <td className="whitespace-nowrap">{formatDate(o.received_at)}</td>
                    <td>{o.customers.full_name}</td>
                    <td className="hidden md:table-cell">{vehicleLabel(o.vehicles)}</td>
                    <td className="hidden lg:table-cell">{o.technician?.full_name ?? "—"}</td>
                    <td>
                      <OrderStatusBadge status={o.status} />
                    </td>
                    {showMoney && <td className="num">{formatHNL(o.total)}</td>}
                    {showMoney && (
                      <td className="hidden sm:table-cell">
                        <BalanceBadge balance={Number(o.balance)} total={Number(o.total)} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/ordenes" params={params} />
      </Card>
    </>
  );
}
