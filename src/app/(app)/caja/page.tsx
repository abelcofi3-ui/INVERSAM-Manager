import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/forms";
import { Alert, Badge, Card, EmptyState, PageHeader, StatCard, TableWrap, cx, inputClass, str } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDate, formatDateTime, formatHNL, formatTime, hnDateString, hnDayStartISO } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/labels";
import { loadSettings } from "@/lib/queries";
import { VoidPaymentButton } from "../ordenes/[id]/order-components";
import { reopenCashRegister } from "./actions";
import { ClosingPdfButton, CloseCashForm, CollectPayment } from "./cash-components";

export const metadata: Metadata = { title: "Caja y pagos" };

const VIEWS = [
  { value: "dia", label: "Caja del día" },
  { value: "saldos", label: "Saldos pendientes" },
  { value: "cierres", label: "Historial de cierres" },
];

interface Summary {
  cash_income: number;
  transfer_income: number;
  card_income: number;
  total_income: number;
  payments_count: number;
  cash_expenses: number;
  total_expenses: number;
  closing: Record<string, number | string | null> | null;
}

export default async function CashPage({ searchParams }: PageProps<"/caja">) {
  const session = await requirePage("cash.view");
  const role = session.role;
  const sp = await searchParams;
  const view = str(sp.vista) ?? "dia";
  const today = hnDateString();
  const rawDate = str(sp.fecha);
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && rawDate <= today ? rawDate : today;
  const supabase = await createClient();

  const tabs = (
    <div className="no-print mb-6 flex gap-1 overflow-x-auto rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
      {VIEWS.map((v) => (
        <Link
          key={v.value}
          href={`/caja?vista=${v.value}`}
          className={cx(
            "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
            view === v.value ? "bg-brand-900 text-white" : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );

  // ------------------------------------------------------------------ saldos
  if (view === "saldos") {
    const { data } = await supabase
      .from("work_orders")
      .select("id, order_number, status, received_at, total, amount_paid, balance, customers(full_name, phone)")
      .gt("balance", 0)
      .order("received_at")
      .limit(500);
    const rows = (data ?? []) as unknown as {
      id: string;
      order_number: string;
      status: string;
      received_at: string;
      total: string;
      amount_paid: string;
      balance: string;
      customers: { full_name: string; phone: string | null };
    }[];
    const totalDue = rows.reduce((s, r) => s + Number(r.balance), 0);
    return (
      <>
        <PageHeader title="Caja y pagos" description="Cuentas por cobrar de órdenes de trabajo." />
        {tabs}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Total por cobrar" value={formatHNL(totalDue)} />
          <StatCard label="Órdenes con saldo" value={rows.length} />
        </div>
        <Card bodyClassName="p-0">
          {!rows.length ? (
            <EmptyState title="No hay saldos pendientes" />
          ) : (
            <TableWrap>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th className="hidden sm:table-cell">Teléfono</th>
                    <th className="num">Total</th>
                    <th className="num hidden md:table-cell">Pagado</th>
                    <th className="num">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/ordenes/${r.id}`} className="font-medium text-brand-800 hover:underline">
                          {r.order_number}
                        </Link>
                        {r.status === "entregado" && (
                          <span className="ml-2">
                            <Badge tone="red">Entregado</Badge>
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{formatDate(r.received_at)}</td>
                      <td>{r.customers.full_name}</td>
                      <td className="hidden sm:table-cell">{r.customers.phone ?? "—"}</td>
                      <td className="num">{formatHNL(r.total)}</td>
                      <td className="num hidden md:table-cell">{formatHNL(r.amount_paid)}</td>
                      <td className="num font-semibold">{formatHNL(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </>
    );
  }

  // ------------------------------------------------------------------ cierres
  if (view === "cierres") {
    const { data } = await supabase
      .from("cash_closings")
      .select("*, profiles(full_name)")
      .order("closing_date", { ascending: false })
      .limit(90);
    const rows = (data ?? []) as unknown as (Record<string, string | number> & { id: string; closing_date: string; profiles: { full_name: string } | null })[];
    return (
      <>
        <PageHeader title="Caja y pagos" description="Cierres diarios registrados (últimos 90)." />
        {tabs}
        <Card bodyClassName="p-0">
          {!rows.length ? (
            <EmptyState title="Aún no hay cierres de caja" />
          ) : (
            <TableWrap>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="num">Efectivo</th>
                    <th className="num hidden sm:table-cell">Transf.</th>
                    <th className="num hidden sm:table-cell">Tarjeta</th>
                    <th className="num">Total</th>
                    <th className="num hidden md:table-cell">Esperado</th>
                    <th className="num hidden md:table-cell">Contado</th>
                    <th className="num">Diferencia</th>
                    <th className="hidden lg:table-cell">Cerrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/caja?fecha=${c.closing_date}`} className="font-medium text-brand-800 hover:underline">
                          {formatDate(c.closing_date)}
                        </Link>
                      </td>
                      <td className="num">{formatHNL(c.cash_income)}</td>
                      <td className="num hidden sm:table-cell">{formatHNL(c.transfer_income)}</td>
                      <td className="num hidden sm:table-cell">{formatHNL(c.card_income)}</td>
                      <td className="num font-medium">{formatHNL(c.total_income)}</td>
                      <td className="num hidden md:table-cell">{formatHNL(c.expected_cash)}</td>
                      <td className="num hidden md:table-cell">{formatHNL(c.counted_cash)}</td>
                      <td className={cx("num font-medium", Number(c.difference) === 0 ? "text-emerald-700" : "text-red-600")}>
                        {formatHNL(c.difference)}
                      </td>
                      <td className="hidden lg:table-cell">{c.profiles?.full_name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </>
    );
  }

  // ------------------------------------------------------------------ día
  const [{ data: summaryRaw, error: summaryError }, { data: paymentsRaw }, { data: openOrders }, settings] = await Promise.all([
    supabase.rpc("cash_register_summary", { p_date: date }),
    supabase
      .from("payments")
      .select("id, amount, method, reference, paid_at, voided, void_reason, cash_closing_id, work_orders(id, order_number, customers(full_name)), profiles!payments_received_by_fkey(full_name)")
      .gte("paid_at", hnDayStartISO(date))
      .lt("paid_at", hnDayStartISO(addDays(date, 1)))
      .order("paid_at", { ascending: false }),
    supabase
      .from("work_orders")
      .select("id, order_number, balance, customers(full_name)")
      .gt("balance", 0)
      .order("received_at", { ascending: false })
      .limit(300),
    loadSettings(supabase),
  ]);
  const s = (summaryRaw ?? {}) as Summary;
  const closing = s.closing;
  const payments = (paymentsRaw ?? []) as unknown as {
    id: string;
    amount: string;
    method: PaymentMethod;
    reference: string | null;
    paid_at: string;
    voided: boolean;
    void_reason: string | null;
    cash_closing_id: string | null;
    work_orders: { id: string; order_number: string; customers: { full_name: string } };
    profiles: { full_name: string } | null;
  }[];
  let closedByName: string | null = null;
  if (closing?.closed_by) {
    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", closing.closed_by).maybeSingle();
    closedByName = p?.full_name ?? null;
  }
  const orderOptions = ((openOrders ?? []) as unknown as { id: string; order_number: string; balance: string; customers: { full_name: string } }[]).map(
    (o) => ({ id: o.id, label: `${o.order_number} · ${o.customers.full_name}`, balance: Number(o.balance) }),
  );
  const isToday = date === today;

  return (
    <>
      <PageHeader title="Caja y pagos" description="Cobros, cuadre de efectivo y cierre diario." />
      {tabs}

      <form action="/caja" method="get" className="no-print mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="fecha" className="mb-1 block text-xs font-medium text-slate-700">Fecha</label>
          <input id="fecha" name="fecha" type="date" max={today} defaultValue={date} className={inputClass} />
        </div>
        <button type="submit" className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
          Ver
        </button>
        {!isToday && (
          <Link href="/caja" className="pb-2 text-sm text-brand-700 hover:underline">
            Ir a hoy
          </Link>
        )}
      </form>

      {summaryError && (
        <div className="mb-6">
          <Alert tone="red">No se pudo calcular el resumen de caja: {summaryError.message}</Alert>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Efectivo" value={formatHNL(s.cash_income)} />
        <StatCard label="Transferencias" value={formatHNL(s.transfer_income)} />
        <StatCard label="Tarjeta" value={formatHNL(s.card_income)} />
        <StatCard label="Total ingresos" value={formatHNL(s.total_income)} hint={`${s.payments_count ?? 0} pago(s)`} />
        <StatCard
          label="Gastos del día"
          value={formatHNL(s.total_expenses)}
          hint={`En efectivo: ${formatHNL(s.cash_expenses)}`}
          href={can(role, "expenses.view") ? `/gastos?desde=${date}&hasta=${date}` : undefined}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {isToday && can(role, "payments.create") && !closing && (
            <Card title="Registrar cobro">
              <CollectPayment orders={orderOptions} />
            </Card>
          )}

          <Card title={`Pagos del ${formatDate(date)}`} bodyClassName="p-0">
            {!payments.length ? (
              <EmptyState title="Sin pagos en esta fecha" />
            ) : (
              <TableWrap>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Orden</th>
                      <th className="hidden sm:table-cell">Cliente</th>
                      <th>Método</th>
                      <th className="num">Monto</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className={p.voided ? "opacity-60" : ""}>
                        <td className="whitespace-nowrap">{formatTime(p.paid_at)}</td>
                        <td>
                          <Link href={`/ordenes/${p.work_orders.id}`} className="font-medium text-brand-800 hover:underline">
                            {p.work_orders.order_number}
                          </Link>
                          {p.profiles?.full_name && <p className="text-[11px] text-slate-400">por {p.profiles.full_name}</p>}
                        </td>
                        <td className="hidden sm:table-cell">{p.work_orders.customers.full_name}</td>
                        <td>
                          {PAYMENT_METHOD_LABELS[p.method]}
                          {p.reference && <p className="text-[11px] text-slate-500">{p.reference}</p>}
                        </td>
                        <td className={cx("num font-medium", p.voided && "line-through")}>{formatHNL(p.amount)}</td>
                        <td className="text-right">
                          {p.voided ? (
                            <span title={p.void_reason ?? ""}>
                              <Badge tone="red">Anulado</Badge>
                            </span>
                          ) : (
                            !p.cash_closing_id && can(role, "payments.void") && <VoidPaymentButton paymentId={p.id} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
        </div>

        <div>
          <Card
            title="Cierre de caja"
            actions={
              closing && (
                <ClosingPdfButton
                  business={settings}
                  date={formatDate(date)}
                  closing={{ ...closing, closed_by_name: closedByName }}
                  payments={payments
                    .filter((p) => !p.voided)
                    .map((p) => [
                      formatTime(p.paid_at),
                      p.work_orders.order_number,
                      p.work_orders.customers.full_name,
                      PAYMENT_METHOD_LABELS[p.method],
                      p.reference ?? "",
                      formatHNL(p.amount),
                    ])}
                />
              )
            }
          >
            {closing ? (
              <div className="space-y-4">
                <Alert tone="green">
                  Caja cerrada el {formatDateTime(String(closing.closed_at))}
                  {closedByName ? ` por ${closedByName}` : ""}.
                </Alert>
                <dl className="tabular grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-slate-500">Fondo inicial</dt>
                  <dd className="text-right">{formatHNL(closing.opening_cash)}</dd>
                  <dt className="text-slate-500">+ Ingresos efectivo</dt>
                  <dd className="text-right">{formatHNL(closing.cash_income)}</dd>
                  <dt className="text-slate-500">− Gastos efectivo</dt>
                  <dd className="text-right">{formatHNL(closing.cash_expenses)}</dd>
                  <dt className="font-medium">Esperado</dt>
                  <dd className="text-right font-medium">{formatHNL(closing.expected_cash)}</dd>
                  <dt className="text-slate-500">Contado</dt>
                  <dd className="text-right">{formatHNL(closing.counted_cash)}</dd>
                  <dt className="font-medium">Diferencia</dt>
                  <dd className={cx("text-right font-semibold", Number(closing.difference) === 0 ? "text-emerald-700" : "text-red-600")}>
                    {formatHNL(closing.difference)}
                  </dd>
                </dl>
                {closing.notes && <p className="text-sm text-slate-600">{String(closing.notes)}</p>}
                {can(role, "cash.reopen") && (
                  <ActionButton
                    action={reopenCashRegister}
                    fields={{ id: String(closing.id) }}
                    variant="dangerGhost"
                    confirm="¿Reabrir la caja de este día? Se eliminará el cierre registrado."
                  >
                    Reabrir caja
                  </ActionButton>
                )}
              </div>
            ) : can(role, "cash.close") ? (
              <CloseCashForm date={date} cashIncome={Number(s.cash_income ?? 0)} cashExpenses={Number(s.cash_expenses ?? 0)} />
            ) : (
              <p className="text-sm text-slate-500">La caja de este día no ha sido cerrada.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
