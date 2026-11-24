import type { Metadata } from "next";
import { ActionButton } from "@/components/forms";
import { Card, EmptyState, FilterBar, Pagination, PageHeader, StatCard, TableWrap, inputClass, pageParams, str } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatHNL, hnDateString } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/labels";
import { deleteExpense } from "../caja/actions";
import { EditExpenseToggle, ExpenseForm } from "./expense-form";

export const metadata: Metadata = { title: "Gastos" };

const isDate = (s?: string) => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));

export default async function ExpensesPage({ searchParams }: PageProps<"/gastos">) {
  const session = await requirePage("expenses.view");
  const sp = await searchParams;
  const today = hnDateString();
  const desde = isDate(str(sp.desde)) ? str(sp.desde)! : `${today.slice(0, 7)}-01`;
  const hasta = isDate(str(sp.hasta)) ? str(sp.hasta)! : today;
  const categoria = str(sp.categoria);
  const { page, pageSize, from, to } = pageParams(sp, 50);
  const supabase = await createClient();

  let query = supabase.from("expenses").select("*, profiles(full_name)", { count: "exact" }).gte("expense_date", desde).lte("expense_date", hasta);
  let totalsQuery = supabase.from("expenses").select("amount, category").gte("expense_date", desde).lte("expense_date", hasta);
  if (categoria) {
    query = query.eq("category", categoria);
    totalsQuery = totalsQuery.eq("category", categoria);
  }
  const [{ data, count, error }, { data: all }, { data: cats }] = await Promise.all([
    query.order("expense_date", { ascending: false }).order("created_at", { ascending: false }).range(from, to),
    totalsQuery.limit(10000),
    supabase.from("expenses").select("category").limit(5000),
  ]);
  const rows = (data ?? []) as unknown as {
    id: string;
    expense_date: string;
    category: string;
    description: string;
    amount: string;
    method: PaymentMethod;
    reference: string | null;
    profiles: { full_name: string } | null;
  }[];
  const total = (all ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = Object.entries(
    (all ?? []).reduce<Record<string, number>>((acc, e) => ((acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount)), acc), {}),
  ).sort((a, b) => b[1] - a[1]);
  const categories = [...new Set((cats ?? []).map((c) => c.category))].sort();

  return (
    <>
      <PageHeader title="Gastos" description="Egresos del taller para el control de rentabilidad y caja." />
      {can(session.role, "expenses.edit") && (
        <Card title="Registrar gasto" className="mb-6">
          <ExpenseForm today={today} />
        </Card>
      )}
      <FilterBar action="/gastos">
        <div>
          <label htmlFor="desde" className="mb-1 block text-xs font-medium text-slate-700">Desde</label>
          <input id="desde" name="desde" type="date" defaultValue={desde} className={inputClass} />
        </div>
        <div>
          <label htmlFor="hasta" className="mb-1 block text-xs font-medium text-slate-700">Hasta</label>
          <input id="hasta" name="hasta" type="date" defaultValue={hasta} className={inputClass} />
        </div>
        <div>
          <label htmlFor="categoria" className="mb-1 block text-xs font-medium text-slate-700">Categoría</label>
          <select id="categoria" name="categoria" defaultValue={categoria ?? ""} className={inputClass}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total del período" value={formatHNL(total)} hint={`${formatDate(desde)} – ${formatDate(hasta)}`} />
        {byCategory.slice(0, 3).map(([c, v]) => (
          <StatCard key={c} label={c} value={formatHNL(v)} />
        ))}
      </div>

      <Card bodyClassName="p-0">
        {error ? (
          <EmptyState title="No se pudieron cargar los gastos" description={error.message} />
        ) : !rows.length ? (
          <EmptyState title="Sin gastos en el período" />
        ) : (
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th className="hidden sm:table-cell">Método</th>
                  <th className="num">Monto</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{formatDate(e.expense_date)}</td>
                    <td>{e.category}</td>
                    <td>
                      {e.description}
                      {e.reference && <p className="text-[11px] text-slate-500">Ref. {e.reference}</p>}
                    </td>
                    <td className="hidden sm:table-cell">{PAYMENT_METHOD_LABELS[e.method]}</td>
                    <td className="num font-medium">{formatHNL(e.amount)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {can(session.role, "expenses.edit") && <EditExpenseToggle values={e} today={today} />}
                        {can(session.role, "expenses.delete") && (
                          <ActionButton
                            action={deleteExpense}
                            fields={{ id: e.id }}
                            variant="dangerGhost"
                            className="px-2.5 py-1.5 text-xs"
                            confirm="¿Eliminar este gasto?"
                          >
                            Eliminar
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/gastos" params={{ desde, hasta, categoria }} />
      </Card>
      <p className="mt-2 text-xs text-slate-500">
        Los gastos de días con caja cerrada no se pueden modificar ni eliminar.
      </p>
    </>
  );
}
