import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ButtonLink, Card, EmptyState, FilterBar, Pagination, PageHeader, TableWrap, ilikeTerm, inputClass, pageParams, str } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Clientes" };

interface Row {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  vehicles: { count: number }[];
  work_orders: { count: number }[];
}

export default async function CustomersPage({ searchParams }: PageProps<"/clientes">) {
  const session = await requirePage("customers.view");
  const sp = await searchParams;
  const q = str(sp.q);
  const sort = str(sp.orden) ?? "nombre";
  const { page, pageSize, from, to } = pageParams(sp);

  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("id, full_name, phone, email, created_at, vehicles(count), work_orders(count)", { count: "exact" });
  if (q) {
    const t = ilikeTerm(q);
    query = query.or(`full_name.ilike.${t},phone.ilike.${t},email.ilike.${t},rtn.ilike.${t}`);
  }
  query = sort === "recientes" ? query.order("created_at", { ascending: false }) : query.order("full_name");
  const { data, count, error } = await query.range(from, to);
  const rows = (data ?? []) as Row[];

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Registro de clientes, sus vehículos e historial de servicios."
        actions={
          can(session.role, "customers.edit") && (
            <ButtonLink href="/clientes/nuevo">
              <Plus className="h-4 w-4" /> Nuevo cliente
            </ButtonLink>
          )
        }
      />
      <FilterBar action="/clientes">
        <div className="w-full sm:w-80">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate-700">Buscar</label>
          <input id="q" name="q" defaultValue={q} placeholder="Nombre, teléfono, correo o RTN" className={inputClass} />
        </div>
        <div>
          <label htmlFor="orden" className="mb-1 block text-xs font-medium text-slate-700">Ordenar</label>
          <select id="orden" name="orden" defaultValue={sort} className={inputClass}>
            <option value="nombre">Nombre (A-Z)</option>
            <option value="recientes">Más recientes</option>
          </select>
        </div>
      </FilterBar>

      <Card bodyClassName="p-0">
        {error ? (
          <EmptyState title="No se pudieron cargar los clientes" description={error.message} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={q ? "Sin resultados" : "Aún no hay clientes"}
            description={q ? "Pruebe con otro término de búsqueda." : "Registre el primer cliente para comenzar."}
          />
        ) : (
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th className="hidden md:table-cell">Correo</th>
                  <th className="num">Vehículos</th>
                  <th className="num">Órdenes</th>
                  <th className="hidden sm:table-cell">Registro</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clientes/${c.id}`} className="font-medium text-brand-800 hover:underline">
                        {c.full_name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{c.phone ?? "—"}</td>
                    <td className="hidden md:table-cell">{c.email ?? "—"}</td>
                    <td className="num">{c.vehicles?.[0]?.count ?? 0}</td>
                    <td className="num">{c.work_orders?.[0]?.count ?? 0}</td>
                    <td className="hidden whitespace-nowrap sm:table-cell">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/clientes" params={{ q, orden: sort }} />
      </Card>
    </>
  );
}
