"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Car,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  UserCog,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { BrandWordmark } from "@/components/brand";
import { InstallLink } from "@/components/pwa";
import { cx } from "@/components/ui";

const ICONS = {
  dashboard: LayoutDashboard,
  citas: CalendarDays,
  ordenes: ClipboardList,
  cotizaciones: FileText,
  clientes: Users,
  vehiculos: Car,
  caja: Wallet,
  gastos: Receipt,
  servicios: Wrench,
  reportes: BarChart3,
  usuarios: UserCog,
  configuracion: Settings,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; section: string };

export function Sidebar({
  items,
  user,
  signOutAction,
}: {
  items: NavItem[];
  user: { name: string; role: string };
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sections = [...new Set(items.map((i) => i.section))];

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.18em] text-brand-300/70 uppercase">{section}</p>
          <ul className="space-y-0.5">
            {items
              .filter((i) => i.section === section)
              .map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cx(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                        active ? "bg-white/10 text-white" : "text-brand-100/80 hover:bg-white/5 hover:text-white",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className={cx("h-4 w-4", active ? "text-accent-500" : "")} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 p-4">
      <p className="truncate text-sm font-medium text-white">{user.name}</p>
      <p className="text-xs text-brand-300">{user.role}</p>
      <form action={signOutAction} className="mt-3">
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-brand-200 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden /> Cerrar sesión
        </button>
      </form>
      <InstallLink onNavigate={() => setOpen(false)} />
    </div>
  );

  return (
    <>
      {/* Barra superior en móvil */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-brand-950 px-4 py-3 lg:hidden">
        <BrandWordmark />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-white hover:bg-white/10"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Menú lateral escritorio */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-brand-950 lg:flex">
        <div className="px-5 py-5">
          <BrandWordmark />
        </div>
        {nav}
        {footer}
      </aside>

      {/* Menú lateral móvil */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-brand-950">
            <div className="flex items-center justify-between px-5 py-5">
              <BrandWordmark />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-white hover:bg-white/10"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
