export type Role = "admin" | "recepcionista" | "mecanico" | "contabilidad";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  recepcionista: "Recepcionista",
  mecanico: "Mecánico",
  contabilidad: "Contabilidad",
};

/**
 * Permisos de la interfaz. La base de datos (RLS) aplica las mismas reglas:
 * esto solo decide qué se muestra y qué acciones de servidor se aceptan.
 */
export const PERMISSIONS = {
  "dashboard.view": ["admin", "recepcionista", "mecanico", "contabilidad"],
  "dashboard.finance": ["admin", "recepcionista", "contabilidad"],
  "customers.view": ["admin", "recepcionista", "mecanico", "contabilidad"],
  "customers.edit": ["admin", "recepcionista"],
  "customers.delete": ["admin"],
  "vehicles.view": ["admin", "recepcionista", "mecanico", "contabilidad"],
  "vehicles.edit": ["admin", "recepcionista"],
  "vehicles.delete": ["admin"],
  "orders.view": ["admin", "recepcionista", "mecanico", "contabilidad"],
  "orders.create": ["admin", "recepcionista"],
  "orders.edit": ["admin", "recepcionista", "mecanico"],
  "orders.pricing": ["admin", "recepcionista"],
  "orders.delete": ["admin"],
  "photos.delete": ["admin", "recepcionista"],
  "quotes.view": ["admin", "recepcionista", "mecanico", "contabilidad"],
  "quotes.edit": ["admin", "recepcionista"],
  "quotes.delete": ["admin"],
  "appointments.view": ["admin", "recepcionista", "mecanico", "contabilidad"],
  "appointments.edit": ["admin", "recepcionista"],
  "cash.view": ["admin", "recepcionista", "contabilidad"],
  "payments.create": ["admin", "recepcionista", "contabilidad"],
  "payments.void": ["admin", "contabilidad"],
  "cash.close": ["admin", "recepcionista", "contabilidad"],
  "cash.reopen": ["admin"],
  "expenses.view": ["admin", "contabilidad"],
  "expenses.edit": ["admin", "contabilidad"],
  "expenses.delete": ["admin"],
  "services.view": ["admin", "recepcionista", "mecanico", "contabilidad"],
  "services.edit": ["admin"],
  "reports.view": ["admin", "contabilidad"],
  "users.manage": ["admin"],
  "settings.manage": ["admin"],
  "backup.download": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
