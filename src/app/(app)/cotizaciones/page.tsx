import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { QuoteStatusBadge } from "@/components/badges";
import { ButtonLink, Card, EmptyState, FilterBar, Pagination, PageHeader, TableWrap, ilikeTerm, inputClass, pageParams, str } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatHNL, hnDateString } from "@/lib/format";
import { QUOTE_STATUSES, QUOTE_STATUS_LABELS, vehicleLabel, type QuoteStatus } from "@/lib/labels";

export const metadata: Metadata = { title: "Cotizaciones" };

export default async function QuotesPage({ searchParams }: PageProps<"/cotizaciones">) {
  const session = await requirePage("quotes.view");
  const sp = await searchParams;
  const estado = str(sp.estado);
  const q = str(sp.q);
  const { page, pageSize, from, to } = pageParams(sp);

  const supabase = await createClient();
  let query = supabase
    .from("quotes")
    .select("id, quote_number, status, issued_at, valid_until, total, customers!inner(full_name), vehicles(brand, model, year, plate), work_orders(id, order_number)", {
      count: "exact",
    });
  if (estado && (QUOTE_STATUSES as readonly string[]).includes(estado)) query = query.eq("status", estado);
  if (q) query = query.or(`quote_number.ilike.${ilikeTerm(q)}`);
  const { data, count, error } = await query.order("issued_at", { ascending: false }).range(from, to);

  type Row = {
    id: string;
    quote_number: string;
    status: QuoteStatus;
    issued_at: string;
    valid_until: string | null;
    total: string;
    customers: { full_name: string };
    vehicles: { brand: string; model: string; year: number | null; plate: string | null } | null;
    work_orders: { id: string; order_number: string }[];
  };
  const rows = (data ?? []) as unknown as Row[];
  const today = hnDateString();

  return (
    <>
      <PageHeader
        title="Cotizaciones"
        description="Presupuestos para clientes, con aprobación y conversión a orden de trabajo."
        actions={
          can(session.role, "quotes.edit") && (
            <ButtonLink href="/cotizaciones/nueva">
              <Plus className="h-4 w-4" /> Nueva cotización
            </ButtonLink>
          )
        }
      />
      <FilterBar action="/cotizaciones">
        <div className="w-full sm:w-64">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate-700">No. de cotización</label>
          <input id="q" name="q" defaultValue={q} placeholder="COT-000001" className={inputClass} />
        </div>
        <div>
          <label htmlFor="estado" className="mb-1 block text-xs font-medium text-slate-700">Estado</label>
          <select id="estado" name="estado" defaultValue={estado ?? ""} className={inputClass}>
            <option value="">Todos</option>
            {QUOTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>
      <Card bodyClassName="p-0">
        {error ? (
          <EmptyState title="No se pudieron cargar las cotizaciones" description={error.message} />
        ) : rows.length === 0 ? (
          <EmptyState title="No hay cotizaciones" />
        ) : (
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cotización</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th className="hidden md:table-cell">Vehículo</th>
                  <th className="hidden sm:table-cell">Vigencia</th>
                  <th>Estado</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const expired = r.valid_until && r.valid_until < today && (r.status === "borrador" || r.status === "enviada");
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/cotizaciones/${r.id}`} className="font-medium text-brand-800 hover:underline">
                          {r.quote_number}
                        </Link>
                        {r.work_orders?.[0] && <p className="text-xs text-slate-500">→ {r.work_orders[0].order_number}</p>}
                      </td>
                      <td className="whitespace-nowrap">{formatDate(r.issued_at)}</td>
                      <td>{r.customers.full_name}</td>
                      <td className="hidden md:table-cell">{vehicleLabel(r.vehicles)}</td>
                      <td className={`hidden whitespace-nowrap sm:table-cell ${expired ? "text-red-600" : ""}`}>
                        {formatDate(r.valid_until)}
                        {expired ? " (vencida)" : ""}
                      </td>
                      <td>
                        <QuoteStatusBadge status={r.status} />
                      </td>
                      <td className="num">{formatHNL(r.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/cotizaciones" params={{ estado, q }} />
      </Card>
    </>
  );
}
