import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ButtonLink, Card, EmptyState, FilterBar, Pagination, PageHeader, TableWrap, ilikeTerm, inputClass, pageParams, str } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";
import { VEHICLE_TYPES, VEHICLE_TYPE_LABELS, type VehicleType } from "@/lib/labels";

export const metadata: Metadata = { title: "Vehículos" };

export default async function VehiclesPage({ searchParams }: PageProps<"/vehiculos">) {
  const session = await requirePage("vehicles.view");
  const sp = await searchParams;
  const q = str(sp.q);
  const tipo = str(sp.tipo);
  const { page, pageSize, from, to } = pageParams(sp);

  const supabase = await createClient();
  let query = supabase
    .from("vehicles")
    .select("id, brand, model, year, plate, vin, vehicle_type, mileage, customers(id, full_name)", { count: "exact" });
  if (q) {
    const t = ilikeTerm(q);
    query = query.or(`brand.ilike.${t},model.ilike.${t},plate.ilike.${t},vin.ilike.${t}`);
  }
  if (tipo && (VEHICLE_TYPES as readonly string[]).includes(tipo)) query = query.eq("vehicle_type", tipo);
  const { data, count, error } = await query.order("brand").order("model").range(from, to);

  type Row = {
    id: string;
    brand: string;
    model: string;
    year: number | null;
    plate: string | null;
    vin: string | null;
    vehicle_type: VehicleType;
    mileage: number | null;
    customers: { id: string; full_name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        title="Vehículos"
        description="Flota de clientes con kilometraje e historial de mantenimiento."
        actions={
          can(session.role, "vehicles.edit") && (
            <ButtonLink href="/vehiculos/nuevo">
              <Plus className="h-4 w-4" /> Nuevo vehículo
            </ButtonLink>
          )
        }
      />
      <FilterBar action="/vehiculos">
        <div className="w-full sm:w-80">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-slate-700">Buscar</label>
          <input id="q" name="q" defaultValue={q} placeholder="Marca, modelo, placa o VIN" className={inputClass} />
        </div>
        <div>
          <label htmlFor="tipo" className="mb-1 block text-xs font-medium text-slate-700">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={tipo ?? ""} className={inputClass}>
            <option value="">Todos</option>
            {VEHICLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {VEHICLE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>
      <Card bodyClassName="p-0">
        {error ? (
          <EmptyState title="No se pudieron cargar los vehículos" description={error.message} />
        ) : rows.length === 0 ? (
          <EmptyState title={q || tipo ? "Sin resultados" : "Aún no hay vehículos"} />
        ) : (
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vehículo</th>
                  <th>Placa</th>
                  <th className="hidden lg:table-cell">VIN</th>
                  <th className="hidden sm:table-cell">Tipo</th>
                  <th>Propietario</th>
                  <th className="num">Kilometraje</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/vehiculos/${v.id}`} className="font-medium text-brand-800 hover:underline">
                        {[v.brand, v.model, v.year].filter(Boolean).join(" ")}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{v.plate ?? "—"}</td>
                    <td className="hidden font-mono text-xs lg:table-cell">{v.vin ?? "—"}</td>
                    <td className="hidden sm:table-cell">{VEHICLE_TYPE_LABELS[v.vehicle_type]}</td>
                    <td>
                      {v.customers ? (
                        <Link href={`/clientes/${v.customers.id}`} className="hover:underline">
                          {v.customers.full_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num">{v.mileage != null ? `${formatNumber(v.mileage)} km` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} basePath="/vehiculos" params={{ q, tipo }} />
      </Card>
    </>
  );
}
