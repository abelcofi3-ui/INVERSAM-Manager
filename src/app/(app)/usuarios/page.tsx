import type { Metadata } from "next";
import { Alert, Badge, Card, PageHeader, TableWrap } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { CreateUserForm, EditUserButton } from "./user-forms";

export const metadata: Metadata = { title: "Usuarios" };

const ROLE_HELP: Record<Role, string> = {
  admin: "Acceso total: configuración, usuarios, catálogo, reportes y respaldos.",
  recepcionista: "Clientes, vehículos, citas, órdenes, cotizaciones, cobros y cierre de caja.",
  mecanico: "Consulta órdenes; registra diagnóstico, estado, partidas y fotos. Sin datos de caja.",
  contabilidad: "Caja, pagos, anulaciones, gastos, cierres y reportes. Consulta de operación.",
};

export default async function UsersPage() {
  const session = await requirePage("users.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("active", { ascending: false }).order("full_name");
  const users = (data ?? []) as { id: string; full_name: string; email: string | null; phone: string | null; role: Role; active: boolean; created_at: string }[];
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return (
    <>
      <PageHeader title="Usuarios y empleados" description="Cuentas de acceso y permisos por rol." />
      {!hasServiceKey && (
        <div className="mb-6">
          <Alert tone="amber">
            Para crear usuarios y cambiar contraseñas configure <code>SUPABASE_SERVICE_ROLE_KEY</code> en el servidor. Mientras tanto
            puede editar roles y estado de usuarios existentes.
          </Alert>
        </div>
      )}
      <Card title="Nuevo usuario" className="mb-6">
        <CreateUserForm />
      </Card>
      <Card bodyClassName="p-0" className="mb-6">
        <TableWrap>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th className="hidden sm:table-cell">Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th className="hidden md:table-cell">Alta</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <p className="font-medium">
                      {u.full_name}
                      {u.id === session.id && <span className="ml-2 text-xs text-slate-500">(usted)</span>}
                    </p>
                    {u.phone && <p className="text-xs text-slate-500">{u.phone}</p>}
                  </td>
                  <td className="hidden sm:table-cell">{u.email}</td>
                  <td>
                    <Badge tone={u.role === "admin" ? "blue" : "slate"}>{ROLE_LABELS[u.role]}</Badge>
                  </td>
                  <td>{u.active ? <Badge tone="green">Activo</Badge> : <Badge tone="red">Inactivo</Badge>}</td>
                  <td className="hidden md:table-cell">{formatDate(u.created_at)}</td>
                  <td className="text-right">
                    <EditUserButton user={u} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      <Card title="Permisos por rol">
        <dl className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(ROLE_HELP) as Role[]).map((r) => (
            <div key={r}>
              <dt className="text-sm font-medium">{ROLE_LABELS[r]}</dt>
              <dd className="text-sm text-slate-500">{ROLE_HELP[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
