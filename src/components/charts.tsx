"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatHNL, formatNumber } from "@/lib/format";

// Paleta categórica validada (CVD y contraste) — slots en orden fijo.
export const SERIES = { s1: "#2a78d6", s2: "#eb6834" } as const;
const GRID = "#e2e8f0";
const AXIS = "#64748b";

const shortDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const compactL = (v: number) => (Math.abs(v) >= 1000 ? `L ${formatNumber(Math.round(v / 100) / 10)}k` : `L ${formatNumber(v)}`);

const axisProps = { stroke: AXIS, fontSize: 11, tickLine: false, axisLine: false } as const;

function TooltipBox({
  label,
  rows,
}: {
  label: string;
  rows: { name: string; value: string; color?: string }[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-900">{label}</p>
      {rows.map((r) => (
        <p key={r.name} className="flex items-center gap-2 text-slate-600">
          {r.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />}
          {r.name}: <span className="tabular font-medium text-slate-900">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Serie única de ingresos diarios (área). */
export function IncomeAreaChart({ data }: { data: { date: string; income: number }[] }) {
  return (
    <div className="h-64" role="img" aria-label="Ingresos diarios de los últimos 30 días">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES.s1} stopOpacity={0.25} />
              <stop offset="100%" stopColor={SERIES.s1} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps} minTickGap={16} />
          <YAxis tickFormatter={compactL} {...axisProps} width={64} />
          <Tooltip
            cursor={{ stroke: AXIS, strokeDasharray: "3 3" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox label={shortDate(String(label))} rows={[{ name: "Ingresos", value: formatHNL(Number(payload[0].value)) }]} />
              ) : null
            }
          />
          <Area type="monotone" dataKey="income" stroke={SERIES.s1} strokeWidth={2} fill="url(#incomeFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Conteo diario de órdenes recibidas (barras). */
export function OrdersBarChart({ data }: { data: { date: string; orders: number }[] }) {
  return (
    <div className="h-48" role="img" aria-label="Órdenes recibidas por día">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps} minTickGap={16} />
          <YAxis allowDecimals={false} {...axisProps} width={32} />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.15)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox label={shortDate(String(label))} rows={[{ name: "Órdenes", value: String(payload[0].value) }]} />
              ) : null
            }
          />
          <Bar dataKey="orders" fill={SERIES.s1} radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ingresos vs. gastos por día (dos series, mismo eje en L). */
export function IncomeExpenseChart({ data }: { data: { date: string; income: number; expenses: number }[] }) {
  return (
    <div className="h-72" role="img" aria-label="Ingresos y gastos por día">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps} minTickGap={16} />
          <YAxis tickFormatter={compactL} {...axisProps} width={64} />
          <Tooltip
            cursor={{ stroke: AXIS, strokeDasharray: "3 3" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  label={shortDate(String(label))}
                  rows={payload.map((p) => ({
                    name: p.dataKey === "income" ? "Ingresos" : "Gastos",
                    value: formatHNL(Number(p.value)),
                    color: String(p.color),
                  }))}
                />
              ) : null
            }
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="plainline"
            height={28}
            formatter={(v) => <span className="text-xs text-slate-600">{v === "income" ? "Ingresos" : "Gastos"}</span>}
          />
          <Line type="monotone" dataKey="income" stroke={SERIES.s1} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
          <Line type="monotone" dataKey="expenses" stroke={SERIES.s2} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras horizontales con valor rotulado (rankings: servicios, categorías, métodos). */
export function RankBars({
  data,
  money = true,
  empty = "Sin datos en el período",
}: {
  data: { name: string; value: number; hint?: string }[];
  money?: boolean;
  empty?: string;
}) {
  if (!data.length) return <p className="py-6 text-center text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.name} className="group" title={`${d.name}: ${money ? formatHNL(d.value) : formatNumber(d.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-slate-700">{d.name}</span>
            <span className="tabular shrink-0 font-medium text-slate-900">
              {money ? formatHNL(d.value) : formatNumber(d.value)}
              {d.hint && <span className="ml-1 text-xs font-normal text-slate-500">{d.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full transition-[filter] group-hover:brightness-110"
              style={{ width: `${Math.max((d.value / max) * 100, 2)}%`, background: SERIES.s1 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
