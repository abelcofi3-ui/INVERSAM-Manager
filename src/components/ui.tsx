import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Tone } from "@/lib/labels";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------
export const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap";
export const btn = {
  primary: `${btnBase} bg-brand-900 text-white shadow-sm hover:bg-brand-800`,
  secondary: `${btnBase} border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50`,
  danger: `${btnBase} bg-red-600 text-white shadow-sm hover:bg-red-700`,
  ghost: `${btnBase} text-slate-600 hover:bg-slate-100`,
  dangerGhost: `${btnBase} text-red-600 hover:bg-red-50`,
  sm: "px-2.5 py-1.5 text-xs",
};

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof Omit<typeof btn, "sm"> }) {
  return <Link {...props} className={cx(btn[variant], className)} />;
}

// ---------------------------------------------------------------------
// Estructura de página
// ---------------------------------------------------------------------
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-sm text-slate-500 hover:text-brand-700">
            ← {back.label}
          </Link>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && <p className="text-xs text-slate-500">{description}</p>}
          </div>
          {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cx("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

const toneClasses: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
};

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  href?: string;
}) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
        <p className="tabular mt-1.5 truncate text-2xl font-semibold text-slate-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      {icon && <div className="rounded-lg bg-brand-50 p-2 text-brand-700">{icon}</div>}
    </div>
  );
  const cls = "block rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
  return href ? (
    <Link href={href} className={cx(cls, "transition hover:border-brand-300 hover:shadow")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function DescriptionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs font-medium text-slate-500">{it.label}</dt>
          <dd className="mt-0.5 text-sm break-words text-slate-900">{it.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Alert({ tone = "amber", children }: { tone?: "amber" | "red" | "blue" | "green"; children: ReactNode }) {
  const cls = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-brand-200 bg-brand-50 text-brand-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[tone];
  return <div className={cx("rounded-lg border px-4 py-3 text-sm", cls)}>{children}</div>;
}

// ---------------------------------------------------------------------
// Paginación y búsqueda (formularios GET: funcionan sin JavaScript)
// ---------------------------------------------------------------------
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="px-5 py-3 text-xs text-slate-500">{total} registro(s)</p>;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && sp.set(k, v));
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm">
      <span className="text-xs text-slate-500">
        Página {page} de {pages} · {total} registro(s)
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className={cx(btn.secondary, btn.sm)} href={href(page - 1)}>
            Anterior
          </Link>
        ) : (
          <span className={cx(btn.secondary, btn.sm, "pointer-events-none opacity-50")}>Anterior</span>
        )}
        {page < pages ? (
          <Link className={cx(btn.secondary, btn.sm)} href={href(page + 1)}>
            Siguiente
          </Link>
        ) : (
          <span className={cx(btn.secondary, btn.sm, "pointer-events-none opacity-50")}>Siguiente</span>
        )}
      </div>
    </div>
  );
}

export const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 aria-[invalid=true]:border-red-400";

export function FilterBar({ children, action }: { children: ReactNode; action: string }) {
  return (
    <form action={action} method="get" className="no-print mb-4 flex flex-wrap items-end gap-3">
      {children}
      <button type="submit" className={btn.secondary}>
        Filtrar
      </button>
    </form>
  );
}

export function pageParams(sp: Record<string, string | string[] | undefined>, pageSize = 25) {
  const raw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

export function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== "" ? s.trim() : undefined;
}

/** Escapa texto para filtros ilike de PostgREST (evita romper la sintaxis de .or()). */
export function ilikeTerm(q: string) {
  return `%${q.replace(/[%_,()\\*]/g, " ").trim()}%`;
}
