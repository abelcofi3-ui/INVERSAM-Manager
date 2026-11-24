"use client";

import { useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/forms";
import { PaymentForm } from "@/components/payment-form";
import { btn, inputClass } from "@/components/ui";
import { formatHNL } from "@/lib/format";
import { downloadReportPdf, type DocumentPdfData } from "@/lib/pdf";
import { closeCashRegister } from "./actions";

export function CollectPayment({ orders }: { orders: { id: string; label: string; balance: number }[] }) {
  const [filter, setFilter] = useState("");
  const [orderId, setOrderId] = useState("");
  const list = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? orders.filter((o) => o.label.toLowerCase().includes(f)) : orders;
  }, [orders, filter]);
  const selected = orders.find((o) => o.id === orderId);

  if (!orders.length) return <p className="text-sm text-slate-500">No hay órdenes con saldo pendiente.</p>;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_1fr]">
        <input className={inputClass} placeholder="Filtrar…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar órdenes" />
        <select className={inputClass} value={orderId} onChange={(e) => setOrderId(e.target.value)} aria-label="Orden a cobrar">
          <option value="">— Seleccione la orden a cobrar ({list.length}) —</option>
          {list.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} · saldo {formatHNL(o.balance)}
            </option>
          ))}
        </select>
      </div>
      {selected && <PaymentForm key={selected.id} workOrderId={selected.id} balance={selected.balance} />}
    </div>
  );
}

export function CloseCashForm({ date, cashIncome, cashExpenses }: { date: string; cashIncome: number; cashExpenses: number }) {
  const [opening, setOpening] = useState("0");
  const [counted, setCounted] = useState("");
  const expected = (Number(opening.replace(/,/g, "")) || 0) + cashIncome - cashExpenses;
  const diff = counted === "" ? null : (Number(counted.replace(/,/g, "")) || 0) - expected;

  return (
    <ActionForm action={closeCashRegister} className="space-y-3">
      <input type="hidden" name="closing_date" value={date} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="opening_cash" label="Fondo inicial de caja (L)" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} />
        <TextField name="counted_cash" label="Efectivo contado (L)" inputMode="decimal" required value={counted} onChange={(e) => setCounted(e.target.value)} />
      </div>
      <dl className="tabular grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
        <dt className="text-slate-500">Efectivo esperado</dt>
        <dd className="text-right font-medium">{formatHNL(expected)}</dd>
        <dt className="text-slate-500">Diferencia</dt>
        <dd className={`text-right font-semibold ${diff == null ? "" : Math.abs(diff) < 0.005 ? "text-emerald-700" : "text-red-600"}`}>
          {diff == null ? "—" : `${diff > 0 ? "+" : ""}${formatHNL(diff)}`}
        </dd>
      </dl>
      <TextAreaField name="notes" label="Observaciones" rows={2} />
      <div className="flex justify-end">
        <SubmitButton pendingText="Cerrando…" confirm="¿Confirmar el cierre de caja? Después no se podrán registrar ni anular pagos de este día.">
          Cerrar caja
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ClosingPdfButton({
  business,
  date,
  closing,
  payments,
}: {
  business: DocumentPdfData["business"];
  date: string;
  closing: Record<string, number | string | null>;
  payments: (string | number)[][];
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={btn.secondary}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadReportPdf({
            business,
            title: "CIERRE DE CAJA",
            subtitle: date,
            summary: [
              ["Fondo inicial", formatHNL(closing.opening_cash)],
              ["Ingresos en efectivo", formatHNL(closing.cash_income)],
              ["Transferencias", formatHNL(closing.transfer_income)],
              ["Tarjeta", formatHNL(closing.card_income)],
              ["Total ingresos", formatHNL(closing.total_income)],
              ["Gastos en efectivo", formatHNL(closing.cash_expenses)],
              ["Efectivo esperado", formatHNL(closing.expected_cash)],
              ["Efectivo contado", formatHNL(closing.counted_cash)],
              ["Diferencia", formatHNL(closing.difference)],
              ["Cerrado por", String(closing.closed_by_name ?? "—")],
            ],
            tables: [
              {
                title: "Pagos del día",
                head: ["Hora", "Orden", "Cliente", "Método", "Referencia", "Monto"],
                body: payments,
                numericColumns: [5],
              },
            ],
            fileName: `cierre-caja-${date}.pdf`,
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      <FileDown className="h-4 w-4" /> {busy ? "Generando…" : "PDF del cierre"}
    </button>
  );
}
