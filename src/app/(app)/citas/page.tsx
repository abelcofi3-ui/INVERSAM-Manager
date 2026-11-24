import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ActionButton } from "@/components/forms";
import { AppointmentStatusBadge } from "@/components/badges";
import { ButtonLink, Card, EmptyState, PageHeader, TableWrap, btn, cx, inputClass, str } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDate, formatTime, hnDateString, hnDayStartISO } from "@/lib/format";
import { vehicleLabel, type AppointmentStatus } from "@/lib/labels";
import { loadCustomerVehicleOptions, loadServices } from "@/lib/queries";
import { deleteAppointment } from "./actions";
import { AppointmentForm, AppointmentStatusSelect } from "./appointment-form";

export const metadata: Metadata = { title: "Citas" };

export default async function AppointmentsPage({ searchParams }: PageProps<"/citas">) {
  const session = await requirePage("appointments.view");
  const editable = can(session.role, "appointments.edit");
  const sp = await searchParams;
  const raw = str(sp.fecha);
  const today = hnDateString();
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
  const supabase = await createClient();

  const [{ data, error }, options, services, { data: upcoming }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, scheduled_at, duration_minutes, status, notes, customer_id, vehicle_id, customers(id, full_name, phone), vehicles(brand, model, year, plate), services(name)")
      .gte("scheduled_at", hnDayStartISO(date))
      .lt("scheduled_at", hnDayStartISO(addDays(date, 1)))
      .order("scheduled_at"),
    editable ? loadCustomerVehicleOptions(supabase) : Promise.resolve({ customers: [], vehicles: [] }),
    loadServices(supabase),
    supabase
      .from("appointments")
      .select("scheduled_at")
      .gte("scheduled_at", hnDayStartISO(today))
      .lt("scheduled_at", hnDayStartISO(addDays(today, 7)))
      .not("status", "in", "(cancelada,no_asistio)"),
  ]);

  type Row = {
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    status: AppointmentStatus;
    notes: string | null;
    customer_id: string;
    vehicle_id: string | null;
    customers: { id: string; full_name: string; phone: string | null };
    vehicles: { brand: string; model: string; year: number | null; plate: string | null } | null;
    services: { name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  // Conteo de próximos 7 días para la mini agenda
  const counts: Record<string, number> = {};
  for (const a of upcoming ?? []) {
    const d = hnDateString(new Date(a.scheduled_at));
    counts[d] = (counts[d] ?? 0) + 1;
  }
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const weekday = new Intl.DateTimeFormat("es-HN", { weekday: "short", timeZone: "UTC" });

  return (
    <>
      <PageHeader title="Citas" description="Agenda de servicios programados." />

      <div className="no-print mb-6 grid grid-cols-7 gap-2">
        {week.map((d) => (
          <Link
            key={d}
            href={`/citas?fecha=${d}`}
            className={cx(
              "rounded-lg border px-2 py-2 text-center text-xs transition",
              d === date ? "border-brand-900 bg-brand-900 text-white" : "border-slate-200 bg-white hover:border-brand-300",
            )}
          >
            <p className="capitalize">{weekday.format(new Date(`${d}T12:00:00Z`))}</p>
            <p className="text-base font-semibold">{d.slice(8)}</p>
            <p className={d === date ? "text-brand-200" : "text-slate-500"}>{counts[d] ?? 0} cita(s)</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title={`Agenda del ${formatDate(date)}`}
          className="lg:col-span-2"
          bodyClassName="p-0"
          actions={
            <div className="flex items-center gap-1">
              <Link className={cx(btn.ghost, btn.sm)} href={`/citas?fecha=${addDays(date, -1)}`} aria-label="Día anterior">
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <form action="/citas" method="get" className="flex items-center gap-1">
                <input type="date" name="fecha" defaultValue={date} className={cx(inputClass, "py-1 text-xs")} aria-label="Ir a fecha" />
                <button type="submit" className={cx(btn.secondary, btn.sm)}>
                  Ir
                </button>
              </form>
              <Link className={cx(btn.ghost, btn.sm)} href={`/citas?fecha=${addDays(date, 1)}`} aria-label="Día siguiente">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          }
        >
          {error ? (
            <EmptyState title="No se pudo cargar la agenda" description={error.message} />
          ) : !rows.length ? (
            <EmptyState title="Sin citas para este día" />
          ) : (
            <TableWrap>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Cliente</th>
                    <th className="hidden md:table-cell">Vehículo / servicio</th>
                    <th>Estado</th>
                    {editable && <th />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap">
                        <p className="font-medium">{formatTime(a.scheduled_at)}</p>
                        <p className="text-[11px] text-slate-500">{a.duration_minutes} min</p>
                      </td>
                      <td>
                        <Link href={`/clientes/${a.customers.id}`} className="font-medium text-brand-800 hover:underline">
                          {a.customers.full_name}
                        </Link>
                        {a.customers.phone && <p className="text-xs text-slate-500">{a.customers.phone}</p>}
                        {a.notes && <p className="text-xs text-slate-500 italic">{a.notes}</p>}
                      </td>
                      <td className="hidden md:table-cell">
                        <p>{a.vehicles ? vehicleLabel(a.vehicles) : "—"}</p>
                        <p className="text-xs text-slate-500">{a.services?.name ?? "General"}</p>
                      </td>
                      <td>
                        {editable ? <AppointmentStatusSelect id={a.id} status={a.status} /> : <AppointmentStatusBadge status={a.status} />}
                      </td>
                      {editable && (
                        <td>
                          <div className="flex justify-end gap-1">
                            {can(session.role, "orders.create") && a.status !== "cancelada" && (
                              <ButtonLink
                                variant="secondary"
                                className="px-2.5 py-1.5 text-xs"
                                href={`/ordenes/nueva?cliente=${a.customer_id}${a.vehicle_id ? `&vehiculo=${a.vehicle_id}` : ""}`}
                              >
                                Recibir
                              </ButtonLink>
                            )}
                            <ActionButton
                              action={deleteAppointment}
                              fields={{ id: a.id }}
                              variant="dangerGhost"
                              className="px-2.5 py-1.5 text-xs"
                              confirm="¿Eliminar esta cita?"
                            >
                              Eliminar
                            </ActionButton>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>

        {editable && (
          <Card title="Programar cita">
            {options.customers.length ? (
              <AppointmentForm
                customers={options.customers}
                vehicles={options.vehicles}
                services={services}
                defaultDateTime={`${date}T08:00`}
              />
            ) : (
              <p className="text-sm text-slate-500">
                Registre primero un cliente en{" "}
                <Link href="/clientes/nuevo" className="text-brand-700 underline">
                  Clientes
                </Link>
                .
              </p>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
