import type { Metadata } from "next";
import { ActionButton } from "@/components/forms";
import { Alert, Badge, Card, EmptyState, PageHeader, TableWrap } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatHNL } from "@/lib/format";
import { deleteService } from "./actions";
import { EditServiceToggle, ServiceForm } from "./service-form";

export const metadata: Metadata = { title: "Servicios" };

function formatMinutes(m: number | null) {
  if (!m) return "—";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h ? `${h} h${min ? ` ${min} min` : ""}` : `${min} min`;
}

export default async function ServicesPage() {
  const session = await requirePage("services.view");
  const editable = can(session.role, "services.edit");
  const supabase = await createClient();
  const { data, error } = await supabase.from("services").select("*").order("category").order("name");
  const services = data ?? [];
  const categories = [...new Set(services.map((s) => s.category).filter(Boolean))] as string[];
  const unpriced = services.filter((s) => s.active && Number(s.price) === 0).length;

  return (
    <>
      <PageHeader title="Catálogo de servicios" description="Servicios, precios de referencia y tiempos estimados." />
      {editable && unpriced > 0 && (
        <div className="mb-4">
          <Alert tone="amber">
            Hay {unpriced} servicio(s) activo(s) con precio L 0.00. Configure los precios reales de INVERSAM antes de
            usarlos en cotizaciones y órdenes.
          </Alert>
        </div>
      )}
      {editable && (
        <Card title="Agregar servicio" className="mb-6">
          <ServiceForm categories={categories} />
        </Card>
      )}
      <Card bodyClassName="p-0">
        {error ? (
          <EmptyState title="No se pudo cargar el catálogo" description={error.message} />
        ) : !services.length ? (
          <EmptyState title="El catálogo está vacío" />
        ) : (
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th className="hidden sm:table-cell">Categoría</th>
                  <th className="num">Precio</th>
                  <th className="num hidden sm:table-cell">Tiempo est.</th>
                  <th>Estado</th>
                  {editable && <th className="text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <p className="font-medium">{s.name}</p>
                      {s.description && <p className="text-xs text-slate-500">{s.description}</p>}
                    </td>
                    <td className="hidden sm:table-cell">{s.category ?? "—"}</td>
                    <td className="num">{formatHNL(s.price)}</td>
                    <td className="num hidden sm:table-cell">{formatMinutes(s.estimated_minutes)}</td>
                    <td>{s.active ? <Badge tone="green">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                    {editable && (
                      <td>
                        <div className="flex justify-end gap-1">
                          <EditServiceToggle values={s} categories={categories} />
                          <ActionButton
                            action={deleteService}
                            fields={{ id: s.id }}
                            variant="dangerGhost"
                            className="px-2.5 py-1.5 text-xs"
                            confirm={`¿Eliminar el servicio "${s.name}"?`}
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
    </>
  );
}
