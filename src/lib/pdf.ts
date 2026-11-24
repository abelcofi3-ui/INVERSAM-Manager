"use client";

import { formatDate, formatDateTime, formatHNL } from "@/lib/format";

/** Datos de un documento comercial (cotización u orden de trabajo). */
export interface DocumentPdfData {
  kind: "cotizacion" | "orden";
  number: string;
  status: string;
  issuedAt: string;
  validUntil?: string | null;
  business: {
    business_name: string;
    legal_name: string | null;
    rtn: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    tax_label: string;
    document_footer: string | null;
  };
  customer: { full_name: string; phone: string | null; email: string | null; rtn: string | null; address: string | null };
  vehicle: string | null;
  mileage?: number | null;
  technician?: string | null;
  reportedProblem?: string | null;
  diagnosis?: string | null;
  notes?: string | null;
  items: { type: string; description: string; quantity: number; unit_price: number; line_total: number }[];
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    tax_rate: number;
    total: number;
    paid?: number;
    balance?: number;
  };
}

const BRAND: [number, number, number] = [15, 30, 74];
const MUTED: [number, number, number] = [100, 116, 139];

/** jsPDF (Helvetica/WinAnsi) no tiene el espacio fino; normalizar espacios especiales. */
const t = (s: string | number | null | undefined) => String(s ?? "").replace(/[  ]/g, " ");
const money = (n: number | string | null | undefined) => t(formatHNL(n));

async function loadPdf() {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { jsPDF, autoTable };
}

function header(doc: import("jspdf").jsPDF, b: DocumentPdfData["business"], title: string, subtitle: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(t(b.business_name.toUpperCase()), 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const line = [b.legal_name, b.rtn ? `RTN ${b.rtn}` : null].filter(Boolean).join(" · ");
  const contact = [b.address, b.phone, b.email].filter(Boolean).join(" · ");
  if (line) doc.text(t(line), 14, 17.5);
  if (contact) doc.text(t(contact), 14, 21.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(t(title), w - 14, 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(t(subtitle), w - 14, 18, { align: "right" });
  doc.setTextColor(15, 23, 42);
}

function footer(doc: import("jspdf").jsPDF, text: string | null) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    if (text) doc.text(t(text), 14, h - 10, { maxWidth: w - 50 });
    doc.text(`Página ${i} de ${pages}`, w - 14, h - 10, { align: "right" });
  }
}

export async function downloadDocumentPdf(d: DocumentPdfData) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  const title = d.kind === "cotizacion" ? "COTIZACIÓN" : "ORDEN DE TRABAJO";
  header(doc, d.business, title, `${d.number} · ${d.status}`);

  // Bloque cliente / documento
  let y = 34;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("CLIENTE", 14, y);
  doc.text(d.kind === "cotizacion" ? "DATOS DE LA COTIZACIÓN" : "DATOS DE LA ORDEN", w / 2 + 4, y);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(t(d.customer.full_name), 14, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const cust = [
    d.customer.phone && `Tel: ${d.customer.phone}`,
    d.customer.email,
    d.customer.rtn && `RTN: ${d.customer.rtn}`,
    d.customer.address,
  ].filter(Boolean) as string[];
  cust.forEach((l, i) => doc.text(t(l), 14, y + 10 + i * 4.2, { maxWidth: w / 2 - 20 }));

  const meta: [string, string][] = [
    ["Fecha", d.kind === "orden" ? formatDateTime(d.issuedAt) : formatDate(d.issuedAt)],
    ...(d.validUntil ? ([["Válida hasta", formatDate(d.validUntil)]] as [string, string][]) : []),
    ...(d.vehicle ? ([["Vehículo", d.vehicle]] as [string, string][]) : []),
    ...(d.mileage != null ? ([["Kilometraje", `${d.mileage.toLocaleString("es-HN")} km`]] as [string, string][]) : []),
    ...(d.technician ? ([["Técnico", d.technician]] as [string, string][]) : []),
  ];
  meta.forEach(([k, v], i) => {
    doc.setTextColor(...MUTED);
    doc.text(t(k), w / 2 + 4, y + 5 + i * 4.6);
    doc.setTextColor(15, 23, 42);
    doc.text(t(v), w / 2 + 30, y + 5 + i * 4.6, { maxWidth: w / 2 - 44 });
  });
  y += Math.max(cust.length * 4.2 + 12, meta.length * 4.6 + 8);

  const textBlock = (label: string, value: string | null | undefined) => {
    if (!value) return;
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(t(label), 14, y);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(t(value), w - 28);
    doc.text(lines, 14, y + 4.5);
    y += 4.5 + lines.length * 4.2 + 3;
  };
  textBlock("PROBLEMA REPORTADO", d.reportedProblem);
  textBlock("DIAGNÓSTICO", d.diagnosis);

  autoTable(doc, {
    startY: y + 1,
    head: [["Tipo", "Descripción", "Cant.", "Precio unit.", "Importe"]],
    body: d.items.length
      ? d.items.map((i) => [t(i.type), t(i.description), String(i.quantity), money(i.unit_price), money(i.line_total)])
      : [["", "Sin partidas", "", "", ""]],
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 24 },
      2: { halign: "right", cellWidth: 16 },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 30 },
    },
    margin: { left: 14, right: 14 },
  });

  // Totales
  const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  let ty = lastY + 6;
  const rows: [string, string, boolean?][] = [
    ["Subtotal", money(d.totals.subtotal)],
    ...(d.totals.discount > 0 ? ([["Descuento", `- ${money(d.totals.discount)}`]] as [string, string][]) : []),
    [`${d.business.tax_label} (${d.totals.tax_rate}%)`, money(d.totals.tax)],
    ["TOTAL", money(d.totals.total), true],
    ...(d.totals.paid != null && d.totals.paid > 0
      ? ([
          ["Pagado", money(d.totals.paid)],
          ["Saldo pendiente", money(d.totals.balance), true],
        ] as [string, string, boolean][])
      : []),
  ];
  if (ty + rows.length * 6 > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    ty = 20;
  }
  rows.forEach(([k, v, bold]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10.5 : 9);
    doc.text(t(k), w - 70, ty);
    doc.text(t(v), w - 14, ty, { align: "right" });
    ty += 6;
  });
  doc.setFont("helvetica", "normal");

  if (d.notes) {
    y = ty + 4;
    textBlock("OBSERVACIONES", d.notes);
    ty = y;
  }

  if (d.kind === "cotizacion") {
    const sy = Math.max(ty + 18, doc.internal.pageSize.getHeight() - 40);
    doc.setDrawColor(148, 163, 184);
    doc.line(14, sy, 84, sy);
    doc.line(w - 84, sy, w - 14, sy);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Firma del cliente (aprobación)", 14, sy + 4);
    doc.text(t(`Por ${d.business.business_name}`), w - 84, sy + 4);
  } else {
    const sy = Math.max(ty + 18, doc.internal.pageSize.getHeight() - 40);
    doc.setDrawColor(148, 163, 184);
    doc.line(14, sy, 84, sy);
    doc.line(w - 84, sy, w - 14, sy);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Recibido / entregado conforme (cliente)", 14, sy + 4);
    doc.text("Responsable del taller", w - 84, sy + 4);
  }

  footer(doc, d.business.document_footer);
  doc.save(`${d.number}.pdf`);
}

/** Reporte tabular genérico (para el módulo de reportes y el cierre de caja). */
export async function downloadReportPdf(opts: {
  business: DocumentPdfData["business"];
  title: string;
  subtitle: string;
  summary: [string, string][];
  tables: { title: string; head: string[]; body: (string | number)[][]; numericColumns?: number[] }[];
  fileName: string;
}) {
  const { jsPDF, autoTable } = await loadPdf();
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const w = doc.internal.pageSize.getWidth();
  header(doc, opts.business, opts.title, opts.subtitle);

  let y = 34;
  // Resumen en dos columnas
  doc.setFontSize(9);
  opts.summary.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col === 0 ? 14 : w / 2 + 4;
    doc.setTextColor(...MUTED);
    doc.text(t(k), x, y + row * 5.5);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(t(v), x + (w / 2 - 22), y + row * 5.5, { align: "right" });
    doc.setFont("helvetica", "normal");
  });
  y += Math.ceil(opts.summary.length / 2) * 5.5 + 4;

  for (const table of opts.tables) {
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(t(table.title), 14, y);
    doc.setFont("helvetica", "normal");
    const columnStyles: Record<number, { halign: "right" }> = {};
    (table.numericColumns ?? []).forEach((c) => (columnStyles[c] = { halign: "right" }));
    autoTable(doc, {
      startY: y + 2,
      head: [table.head.map(t)],
      body: table.body.length ? table.body.map((r) => r.map((c) => t(c))) : [[t("Sin datos"), ...table.head.slice(1).map(() => "")]],
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: BRAND, textColor: 255 },
      columnStyles,
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  footer(doc, `Generado el ${formatDateTime(new Date())}`);
  doc.save(opts.fileName);
}
