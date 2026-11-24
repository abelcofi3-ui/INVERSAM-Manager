"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { btn } from "@/components/ui";
import { formatDate, formatHNL, formatNumber } from "@/lib/format";
import { ITEM_TYPE_LABELS, PAYMENT_METHOD_LABELS, WORK_ORDER_STATUS_LABELS, type WorkOrderStatus } from "@/lib/labels";
import { downloadReportPdf, type DocumentPdfData } from "@/lib/pdf";
import type { ReportData } from "@/lib/reports";

export function ReportExport({ data, business }: { data: ReportData; business: DocumentPdfData["business"] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pdf() {
    setBusy(true);
    setError(null);
    try {
      await downloadReportPdf({
        business,
        title: "REPORTE GERENCIAL",
        subtitle: `${formatDate(data.from)} – ${formatDate(data.to)}`,
        summary: [
          ["Ingresos cobrados", formatHNL(data.income_total)],
          ["Gastos registrados", formatHNL(data.expenses_total)],
          ["Resultado (ingresos − gastos)", formatHNL(data.profit)],
          ["Órdenes recibidas", formatNumber(data.orders_count)],
          ["Facturado en órdenes", formatHNL(data.orders_billed)],
          ["Ticket promedio", formatHNL(data.average_ticket)],
          ["Saldo pendiente de esas órdenes", formatHNL(data.orders_balance)],
          ["Órdenes entregadas", formatNumber(data.orders_delivered)],
        ],
        tables: [
          {
            title: "Ingresos por método de pago",
            head: ["Método", "Pagos", "Monto"],
            body: data.income_by_method.map((m) => [PAYMENT_METHOD_LABELS[m.method], m.count, formatHNL(m.amount)]),
            numericColumns: [1, 2],
          },
          {
            title: "Gastos por categoría",
            head: ["Categoría", "Registros", "Monto"],
            body: data.expenses_by_category.map((c) => [c.category, c.count, formatHNL(c.amount)]),
            numericColumns: [1, 2],
          },
          {
            title: "Facturación por tipo de partida",
            head: ["Tipo", "Monto"],
            body: data.billed_by_type.map((b) => [ITEM_TYPE_LABELS[b.type], formatHNL(b.amount)]),
            numericColumns: [1],
          },
          {
            title: "Órdenes por estado",
            head: ["Estado", "Órdenes"],
            body: Object.entries(data.orders_by_status).map(([k, v]) => [WORK_ORDER_STATUS_LABELS[k as WorkOrderStatus] ?? k, v]),
            numericColumns: [1],
          },
          {
            title: "Servicios vendidos",
            head: ["Servicio", "Cantidad", "Monto"],
            body: data.services_sold.map((s) => [s.name, formatNumber(s.quantity), formatHNL(s.amount)]),
            numericColumns: [1, 2],
          },
          {
            title: "Clientes recurrentes",
            head: ["Cliente", "Teléfono", "Órdenes en período", "Órdenes totales", "Facturado"],
            body: data.recurring_customers.map((c) => [c.full_name, c.phone ?? "", c.orders_in_range, c.orders_total, formatHNL(c.billed)]),
            numericColumns: [2, 3, 4],
          },
        ],
        fileName: `reporte-${data.from}_${data.to}.pdf`,
      });
    } catch (e) {
      console.error(e);
      setError("No se pudo generar el PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <a className={btn.secondary} href={`/api/reportes/excel?desde=${data.from}&hasta=${data.to}`}>
        <FileSpreadsheet className="h-4 w-4" /> Excel
      </a>
      <button type="button" className={btn.secondary} onClick={pdf} disabled={busy}>
        <FileDown className="h-4 w-4" /> {busy ? "Generando…" : "PDF"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
