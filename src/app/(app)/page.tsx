import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CarFront, CheckCircle2, ClipboardList, HandCoins, Plus, UserPlus, Wallet } from "lucide-react";
import { AppointmentStatusBadge } from "@/components/badges";
import { IncomeAreaChart, OrdersBarChart, RankBars } from "@/components/charts";
import { Alert, ButtonLink, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatHNL, formatTime } from "@/lib/format";
import { WORK_ORDER_STATUSES, WORK_ORDER_STATUS_LABELS, type AppointmentStatus } from "@/lib/labels";

export const metadata: Metadata = { title: "Dashboard" };

interface Stats {
  today: string;
  income_today: number;
  income_week: number;
  income_month: number;
  open_orders: number;
  in_repair: number;
  ready_for_delivery: number;
  completed_month: number;
  receivables: number;
  appointments_today: number;
  new_customers_month: number;
  orders_by_status: Record<string, number>;
  top_services: { name: string; count: number; amount: number }[];
  series: { date: string; income: number; orders: number }[];
  upcoming_appointments: { id: string; scheduled_at: string; status: AppointmentStatus; customer: string; vehicle: string | null; service: string | null }[];
}

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const session = await requirePage("dashboard.view");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_stats");
  const s = data as Stats | null;
  const finance = can(session.role, "dashboard.finance");
  const firstName = session.full_name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Hola, ${firstName}`}
        description={s ? `Resumen del taller · ${formatDate(s.today)}` : "Resumen del taller"}
        actions={
          <>
            {can(session.role, "orders.create") && (
              <ButtonLink href="/ordenes/nueva">
                <Plus className="h-4 w-4" /> Nueva orden
              </ButtonLink>
            )}
            {can(session.role, "quotes.edit") && (
              <ButtonLink variant="secondary" href="/cotizaciones/nueva">
                Nueva cotización
              </ButtonLink>
            )}
          </>
        }
      />

      {sp.denegado && (
        <div className="mb-6">
          <Alert tone="amber">No tiene permiso para acceder a esa sección.</Alert>
        </div>
      )}

      {error || !s ? (
        <Alert tone="red">
          No se pudieron cargar las métricas{error ? `: ${error.message}` : ""}. Verifique que las migraciones de la base de datos estén
          aplicadas (ver README).
        </Alert>
      ) : (
        <>
          {finance && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Ingresos de hoy" value={formatHNL(s.income_today)} icon={<Wallet className="h-5 w-5" />} href="/caja" />
              <StatCard label="Ingresos de la semana" value={formatHNL(s.income_week)} hint="Desde el lunes" />
              <StatCard label="Ingresos del mes" value={formatHNL(s.income_month)} />
              <StatCard
                label="Por cobrar"
                value={formatHNL(s.receivables)}
                icon={<HandCoins className="h-5 w-5" />}
                href="/caja?vista=saldos"
              />
            </div>
          )}

          <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-5 ${finance ? "mt-4" : ""}`}>
            <StatCard label="Órdenes abiertas" value={s.open_orders} icon={<ClipboardList className="h-5 w-5" />} href="/ordenes?estado=abiertas" />
            <StatCard label="En reparación" value={s.in_repair} icon={<CarFront className="h-5 w-5" />} href="/ordenes?estado=en_reparacion" />
            <StatCard
              label="Completadas (mes)"
              value={s.completed_month}
              hint={`${s.ready_for_delivery} por entregar`}
              icon={<CheckCircle2 className="h-5 w-5" />}
              href="/ordenes?estado=finalizado"
            />
            <StatCard label="Citas de hoy" value={s.appointments_today} icon={<CalendarDays className="h-5 w-5" />} href="/citas" />
            <StatCard label="Clientes nuevos (mes)" value={s.new_customers_month} icon={<UserPlus className="h-5 w-5" />} href="/clientes?orden=recientes" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {finance ? (
              <Card title="Ingresos diarios" description="Pagos recibidos, últimos 30 días (L)" className="lg:col-span-2">
                <IncomeAreaChart data={s.series} />
              </Card>
            ) : (
              <Card title="Órdenes recibidas" description="Últimos 30 días" className="lg:col-span-2">
                <OrdersBarChart data={s.series} />
              </Card>
            )}
            <Card title="Órdenes por estado" description="Activas y entregadas este mes">
              <RankBars
                money={false}
                data={WORK_ORDER_STATUSES.map((st) => ({ name: WORK_ORDER_STATUS_LABELS[st], value: s.orders_by_status[st] ?? 0 }))}
              />
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {finance && (
              <Card title="Órdenes recibidas" description="Últimos 30 días">
                <OrdersBarChart data={s.series} />
              </Card>
            )}
            <Card title="Servicios más vendidos" description="Órdenes de este mes">
              <RankBars
                data={s.top_services.map((t) => ({ name: t.name, value: finance ? Number(t.amount) : Number(t.count), hint: `${t.count}×` }))}
                money={finance}
                empty="Aún no hay servicios registrados este mes"
              />
            </Card>
            <Card
              title="Citas de hoy"
              bodyClassName="p-0"
              className={finance ? "" : "lg:col-span-2"}
              actions={
                <Link href="/citas" className="text-xs font-medium text-brand-700 hover:underline">
                  Ver agenda
                </Link>
              }
            >
              {!s.upcoming_appointments.length ? (
                <EmptyState title="Sin citas programadas para hoy" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {s.upcoming_appointments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          <span className="tabular text-slate-500">{formatTime(a.scheduled_at)}</span> · {a.customer}
                        </p>
                        <p className="truncate text-xs text-slate-500">{[a.vehicle, a.service].filter(Boolean).join(" · ") || "General"}</p>
                      </div>
                      <AppointmentStatusBadge status={a.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
