import { Sidebar, type NavItem } from "@/components/sidebar";
import { requirePage } from "@/lib/auth";
import { can, ROLE_LABELS, type Permission } from "@/lib/permissions";
import { signOut } from "@/app/login/actions";

const NAV: (NavItem & { permission: Permission })[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", section: "General", permission: "dashboard.view" },
  { href: "/citas", label: "Citas", icon: "citas", section: "Operación", permission: "appointments.view" },
  { href: "/ordenes", label: "Órdenes de trabajo", icon: "ordenes", section: "Operación", permission: "orders.view" },
  { href: "/cotizaciones", label: "Cotizaciones", icon: "cotizaciones", section: "Operación", permission: "quotes.view" },
  { href: "/clientes", label: "Clientes", icon: "clientes", section: "Operación", permission: "customers.view" },
  { href: "/vehiculos", label: "Vehículos", icon: "vehiculos", section: "Operación", permission: "vehicles.view" },
  { href: "/caja", label: "Caja y pagos", icon: "caja", section: "Finanzas", permission: "cash.view" },
  { href: "/gastos", label: "Gastos", icon: "gastos", section: "Finanzas", permission: "expenses.view" },
  { href: "/reportes", label: "Reportes", icon: "reportes", section: "Finanzas", permission: "reports.view" },
  { href: "/servicios", label: "Servicios", icon: "servicios", section: "Administración", permission: "services.view" },
  { href: "/usuarios", label: "Usuarios", icon: "usuarios", section: "Administración", permission: "users.manage" },
  { href: "/configuracion", label: "Configuración", icon: "configuracion", section: "Administración", permission: "settings.manage" },
];

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requirePage();
  const items: NavItem[] = NAV.filter((n) => can(session.role, n.permission)).map((n) => ({ href: n.href, label: n.label, icon: n.icon, section: n.section }));

  return (
    <div className="min-h-screen">
      <Sidebar
        items={items}
        user={{ name: session.full_name, role: ROLE_LABELS[session.role] }}
        signOutAction={signOut}
      />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
