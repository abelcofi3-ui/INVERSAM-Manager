import type { Metadata } from "next";
import Link from "next/link";
import { IncomeExpenseChart, RankBars } from "@/components/charts";
import { Alert, Card, EmptyState, PageHeader, StatCard, TableWrap, btn, cx, inputClass, str } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatHNL, formatNumber } from "@/lib/format";
import { ITEM_TYPE_LABELS, PAYMENT_METHOD_LABELS, WORK_ORDER_STATUSES, WORK_ORDER_STATUS_LABELS } from "@/lib/labels";
import { loadSettings } from "@/lib/queries";
import { resolveRange, type ReportData } from "@/lib/reports";
import { ReportExport } from "./report-export";

export const metadata: Metadata = { title: "Reportes" };

const PRESETS = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "mes_anterior", label: "Mes anterior" },
  { value: "anio", label: "Este año" },
];

export default async function ReportsPage({ searchParams }: PageProps<"/reportes">) {
  await requirePage("reports.view");
  const sp = await searchParams;
  const rango = str(sp.rango);
  const { from, to } = resolveRange({ desde: str(sp.desde), hasta: str(sp.hasta), rango });
  const supabase = await createClient();
  const [{ data, error }, settings] = await Promise.all([
    supabase.rpc("report_data", { p_from: from, p_to: to }),
    loadSettings(supabase),
  ]);
  const r = data as ReportData | null;

  return (
    <>
      <PageHeader
        title="Reportes"
        description={`Período: ${formatDate(from)} – ${formatDate(to)}`}
        actions={r && <ReportExport data={r} business={settings} />}
      />

      <div className="no-print mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {PRESETS.map((p) => (
            <Link
              key={p.value}
              href={`/reportes?rango=${p.value}`}
              className={cx(
                "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                rango === p.value || (!rango && !sp.desde && p.value === "mes") ? "bg-brand-900 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <form action="/reportes" method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="desde" className="mb-1 block text-xs font-medium text-slate-700">Desde</label>
            <input id="desde" type="date" name="desde" defaultValue={from} className={inputClass} />
          </div>
          <div>
            <label htmlFor="hasta" className="mb-1 block text-xs font-medium text-slate-700">Hasta</label>
            <input id="hasta" type="date" name="hasta" defaultValue={to} className={inputClass} />
          </div>
          <button type="submit" className={btn.secondary}>
            Aplicar
          </button>
        </form>
      </div>

      {error || !r ? (
        <Alert tone="red">No se pudo generar el reporte{error ? `: ${error.message}` : ""}.</Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Ingresos cobrados" value={formatHNL(r.income_total)} hint="Pagos recibidos (no anulados)" />
            <StatCard label="Gastos" value={formatHNL(r.expenses_total)} />
            <StatCard label="Resultado" value={formatHNL(r.profit)} hint="Ingresos − gastos registrados" />
            <StatCard label="Órdenes recibidas" value={formatNumber(r.orders_count)} hint={`${r.orders_delivered} entregadas`} />
            <StatCard label="Facturado en órdenes" value={formatHNL(r.orders_billed)} hint="Total de órdenes del período" />
            <StatCard label="Ticket promedio" value={formatHNL(r.average_ticket)} />
            <StatCard label="Saldo pendiente" value={formatHNL(r.orders_balance)} hint="De las órdenes del período" />
            <StatCard label="Clientes recurrentes" value={formatNumber(r.recurring_customers.length)} hint="Con 2 o más visitas" />
          </div>

          <Card title="Ingresos y gastos por día" className="mt-6">
            <IncomeExpenseChart data={r.daily} />
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card title="Ingresos por método de pago">
              <RankBars
                data={r.income_by_method.map((m) => ({ name: PAYMENT_METHOD_LABELS[m.method], value: Number(m.amount), hint: `${m.count} pago(s)` }))}
              />
            </Card>
            <Card title="Gastos por categoría">
              <RankBars data={r.expenses_by_category.map((c) => ({ name: c.category, value: Number(c.amount) }))} />
            </Card>
            <Card title="Facturación por tipo">
              <RankBars data={r.billed_by_type.map((b) => ({ name: ITEM_TYPE_LABELS[b.type], value: Number(b.amount) }))} />
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card title="Órdenes por estado">
              <RankBars
                money={false}
                data={WORK_ORDER_STATUSES.map((s) => ({ name: WORK_ORDER_STATUS_LABELS[s], value: r.orders_by_status[s] ?? 0 }))}
              />
            </Card>
            <Card title="Servicios vendidos" className="lg:col-span-2" bodyClassName="p-0">
              {!r.services_sold.length ? (
                <EmptyState title="Sin servicios en el período" />
              ) : (
                <TableWrap>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Servicio</th>
                        <th className="num">Cantidad</th>
                        <th className="num">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.services_sold.map((s) => (
                        <tr key={s.name}>
                          <td>{s.name}</td>
                          <td className="num">{formatNumber(s.quantity)}</td>
                          <td className="num">{formatHNL(s.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Card>
          </div>

          <Card title="Clientes recurrentes" description="Clientes con órdenes en el período y 2 o más visitas en total" className="mt-6" bodyClassName="p-0">
            {!r.recurring_customers.length ? (
              <EmptyState title="Sin clientes recurrentes en el período" />
            ) : (
              <TableWrap>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th className="hidden sm:table-cell">Teléfono</th>
                      <th className="num">Órdenes (período)</th>
                      <th className="num">Visitas totales</th>
                      <th className="num">Facturado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.recurring_customers.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/clientes/${c.id}`} className="font-medium text-brand-800 hover:underline">
                            {c.full_name}
                          </Link>
                        </td>
                        <td className="hidden sm:table-cell">{c.phone ?? "—"}</td>
                        <td className="num">{c.orders_in_range}</td>
                        <td className="num">{c.orders_total}</td>
                        <td className="num">{formatHNL(c.billed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
          <p className="mt-4 text-xs text-slate-500">
            Rentabilidad: el resultado se calcula con base en efectivo (pagos cobrados menos gastos registrados). El costo de repuestos
            solo se refleja si se registra como gasto.
          </p>
        </>
      )}
    </>
  );
}
