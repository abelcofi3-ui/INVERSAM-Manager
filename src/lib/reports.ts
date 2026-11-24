import { addDays, hnDateString } from "@/lib/format";

export interface ReportData {
  from: string;
  to: string;
  income_total: number;
  expenses_total: number;
  profit: number;
  income_by_method: { method: "efectivo" | "transferencia" | "tarjeta"; amount: number; count: number }[];
  expenses_by_category: { category: string; amount: number; count: number }[];
  daily: { date: string; income: number; expenses: number }[];
  orders_count: number;
  orders_delivered: number;
  orders_billed: number;
  orders_balance: number;
  average_ticket: number;
  orders_by_status: Record<string, number>;
  billed_by_type: { type: "servicio" | "repuesto" | "mano_obra"; amount: number }[];
  services_sold: { name: string; quantity: number; amount: number }[];
  recurring_customers: { id: string; full_name: string; phone: string | null; orders_in_range: number; orders_total: number; billed: number }[];
}

/** Rangos predefinidos (fechas locales de Honduras). */
export function presetRange(preset: string | undefined): { from: string; to: string } | null {
  const today = hnDateString();
  const d = new Date(`${today}T12:00:00Z`);
  switch (preset) {
    case "hoy":
      return { from: today, to: today };
    case "semana": {
      const dow = (d.getUTCDay() + 6) % 7; // lunes = 0
      return { from: addDays(today, -dow), to: today };
    }
    case "mes":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "mes_anterior": {
      const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
      return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
    }
    case "anio":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    default:
      return null;
  }
}

export function resolveRange(sp: { desde?: string; hasta?: string; rango?: string }) {
  const preset = presetRange(sp.rango);
  if (preset) return preset;
  const ok = (s?: string) => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));
  if (ok(sp.desde) && ok(sp.hasta) && sp.hasta! >= sp.desde!) return { from: sp.desde!, to: sp.hasta! };
  return presetRange("mes")!;
}
