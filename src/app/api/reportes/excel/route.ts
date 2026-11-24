import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatDateTime, hnDayStartISO } from "@/lib/format";
import { ITEM_TYPE_LABELS, PAYMENT_METHOD_LABELS, WORK_ORDER_STATUS_LABELS, type ItemType, type PaymentMethod, type WorkOrderStatus } from "@/lib/labels";
import { resolveRange, type ReportData } from "@/lib/reports";


const MONEY = '"L" #,##0.00';

function sheet(wb: ExcelJS.Workbook, name: string, columns: { header: string; key: string; width?: number; money?: boolean }[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16, style: c.money ? { numFmt: MONEY } : undefined }));
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F1E4A" } };
  header.alignment = { vertical: "middle" };
  return ws;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.active) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!can(session.role, "reports.view")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const { from, to } = resolveRange({ desde: sp.get("desde") ?? undefined, hasta: sp.get("hasta") ?? undefined });
  const t0 = hnDayStartISO(from);
  const t1 = hnDayStartISO(addDays(to, 1));
  const supabase = await createClient();

  const [report, payments, expenses, orders] = await Promise.all([
    supabase.rpc("report_data", { p_from: from, p_to: to }),
    supabase
      .from("payments")
      .select("paid_at, amount, method, reference, voided, void_reason, work_orders(order_number, customers(full_name))")
      .gte("paid_at", t0)
      .lt("paid_at", t1)
      .order("paid_at")
      .limit(20000),
    supabase.from("expenses").select("expense_date, category, description, amount, method, reference").gte("expense_date", from).lte("expense_date", to).order("expense_date").limit(20000),
    supabase
      .from("work_orders")
      .select("order_number, received_at, status, subtotal, discount_amount, tax_amount, total, amount_paid, balance, customers(full_name), vehicles(brand, model, plate), work_order_items(item_type, description, quantity, unit_price, line_total)")
      .gte("received_at", t0)
      .lt("received_at", t1)
      .order("received_at")
      .limit(20000),
  ]);
  const err = report.error ?? payments.error ?? expenses.error ?? orders.error;
  if (err || !report.data) {
    console.error("[excel]", err);
    return NextResponse.json({ error: "No se pudo generar el reporte" }, { status: 500 });
  }
  const r = report.data as ReportData;

  const wb = new ExcelJS.Workbook();
  wb.creator = "INVERSAM Manager";
  wb.created = new Date();

  const resumen = sheet(wb, "Resumen", [
    { header: "Indicador", key: "k", width: 36 },
    { header: "Valor", key: "v", width: 20 },
  ]);
  const rows: [string, number | string, boolean?][] = [
    ["Desde", from],
    ["Hasta", to],
    ["Ingresos cobrados", Number(r.income_total), true],
    ["Gastos registrados", Number(r.expenses_total), true],
    ["Resultado (ingresos − gastos)", Number(r.profit), true],
    ["Órdenes recibidas", Number(r.orders_count)],
    ["Órdenes entregadas", Number(r.orders_delivered)],
    ["Facturado en órdenes", Number(r.orders_billed), true],
    ["Ticket promedio", Number(r.average_ticket), true],
    ["Saldo pendiente de esas órdenes", Number(r.orders_balance), true],
  ];
  rows.forEach(([k, v, m]) => {
    const row = resumen.addRow({ k, v });
    if (m) row.getCell(2).numFmt = MONEY;
  });
  resumen.addRow({});
  r.income_by_method.forEach((m) => {
    const row = resumen.addRow({ k: `Ingresos · ${PAYMENT_METHOD_LABELS[m.method]}`, v: Number(m.amount) });
    row.getCell(2).numFmt = MONEY;
  });

  const ing = sheet(wb, "Ingresos", [
    { header: "Fecha y hora", key: "fecha", width: 22 },
    { header: "Orden", key: "orden", width: 14 },
    { header: "Cliente", key: "cliente", width: 30 },
    { header: "Método", key: "metodo", width: 15 },
    { header: "Referencia", key: "ref", width: 18 },
    { header: "Monto", key: "monto", money: true },
    { header: "Estado", key: "estado", width: 12 },
    { header: "Motivo anulación", key: "motivo", width: 28 },
  ]);
  for (const p of (payments.data ?? []) as unknown as {
    paid_at: string;
    amount: string;
    method: PaymentMethod;
    reference: string | null;
    voided: boolean;
    void_reason: string | null;
    work_orders: { order_number: string; customers: { full_name: string } };
  }[]) {
    ing.addRow({
      fecha: formatDateTime(p.paid_at),
      orden: p.work_orders.order_number,
      cliente: p.work_orders.customers.full_name,
      metodo: PAYMENT_METHOD_LABELS[p.method],
      ref: p.reference ?? "",
      monto: Number(p.amount),
      estado: p.voided ? "Anulado" : "Válido",
      motivo: p.void_reason ?? "",
    });
  }

  const gas = sheet(wb, "Gastos", [
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Categoría", key: "cat", width: 24 },
    { header: "Descripción", key: "desc", width: 40 },
    { header: "Método", key: "metodo", width: 15 },
    { header: "Referencia", key: "ref", width: 18 },
    { header: "Monto", key: "monto", money: true },
  ]);
  for (const e of expenses.data ?? []) {
    gas.addRow({
      fecha: e.expense_date,
      cat: e.category,
      desc: e.description,
      metodo: PAYMENT_METHOD_LABELS[e.method as PaymentMethod],
      ref: e.reference ?? "",
      monto: Number(e.amount),
    });
  }

  const ord = sheet(wb, "Órdenes", [
    { header: "Orden", key: "orden", width: 14 },
    { header: "Entrada", key: "fecha", width: 22 },
    { header: "Cliente", key: "cliente", width: 30 },
    { header: "Vehículo", key: "vehiculo", width: 26 },
    { header: "Estado", key: "estado", width: 20 },
    { header: "Subtotal", key: "sub", money: true },
    { header: "Descuento", key: "desc", money: true },
    { header: "Impuesto", key: "imp", money: true },
    { header: "Total", key: "total", money: true },
    { header: "Pagado", key: "pagado", money: true },
    { header: "Saldo", key: "saldo", money: true },
  ]);
  const det = sheet(wb, "Detalle de partidas", [
    { header: "Orden", key: "orden", width: 14 },
    { header: "Tipo", key: "tipo", width: 15 },
    { header: "Descripción", key: "desc", width: 40 },
    { header: "Cantidad", key: "cant", width: 10 },
    { header: "Precio unit.", key: "pu", money: true },
    { header: "Importe", key: "imp", money: true },
  ]);
  for (const o of (orders.data ?? []) as unknown as {
    order_number: string;
    received_at: string;
    status: WorkOrderStatus;
    subtotal: string;
    discount_amount: string;
    tax_amount: string;
    total: string;
    amount_paid: string;
    balance: string;
    customers: { full_name: string };
    vehicles: { brand: string; model: string; plate: string | null } | null;
    work_order_items: { item_type: ItemType; description: string; quantity: string; unit_price: string; line_total: string }[];
  }[]) {
    ord.addRow({
      orden: o.order_number,
      fecha: formatDateTime(o.received_at),
      cliente: o.customers.full_name,
      vehiculo: o.vehicles ? `${o.vehicles.brand} ${o.vehicles.model}${o.vehicles.plate ? ` · ${o.vehicles.plate}` : ""}` : "",
      estado: WORK_ORDER_STATUS_LABELS[o.status],
      sub: Number(o.subtotal),
      desc: Number(o.discount_amount),
      imp: Number(o.tax_amount),
      total: Number(o.total),
      pagado: Number(o.amount_paid),
      saldo: Number(o.balance),
    });
    for (const i of o.work_order_items) {
      det.addRow({
        orden: o.order_number,
        tipo: ITEM_TYPE_LABELS[i.item_type],
        desc: i.description,
        cant: Number(i.quantity),
        pu: Number(i.unit_price),
        imp: Number(i.line_total),
      });
    }
  }

  const srv = sheet(wb, "Servicios vendidos", [
    { header: "Servicio", key: "s", width: 36 },
    { header: "Cantidad", key: "q", width: 12 },
    { header: "Monto", key: "m", money: true },
  ]);
  r.services_sold.forEach((s) => srv.addRow({ s: s.name, q: Number(s.quantity), m: Number(s.amount) }));

  const rec = sheet(wb, "Clientes recurrentes", [
    { header: "Cliente", key: "c", width: 32 },
    { header: "Teléfono", key: "t", width: 16 },
    { header: "Órdenes en período", key: "p", width: 18 },
    { header: "Visitas totales", key: "v", width: 16 },
    { header: "Facturado", key: "f", money: true },
  ]);
  r.recurring_customers.forEach((c) =>
    rec.addRow({ c: c.full_name, t: c.phone ?? "", p: c.orders_in_range, v: c.orders_total, f: Number(c.billed) }),
  );

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reporte-inversam-${from}_${to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
