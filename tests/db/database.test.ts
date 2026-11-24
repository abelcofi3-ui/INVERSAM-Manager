import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createUser, type Db } from "./harness";

let db: Db;
let admin: string;
let recep: string;
let mech: string;
let acct: string;
let stranger: string;
let customerId: string;
let vehicleId: string;
let otherVehicleId: string;
let orderId: string;

async function expectError(p: Promise<unknown>, match: RegExp) {
  await expect(p).rejects.toThrow(match);
}

beforeAll(async () => {
  db = await createDb();
  admin = await createUser(db, "admin@inversam.test"); // primer usuario → admin
  recep = await createUser(db, "recep@inversam.test", "recepcionista");
  mech = await createUser(db, "mec@inversam.test", "mecanico", "Mecánico Uno");
  acct = await createUser(db, "conta@inversam.test", "contabilidad");
  stranger = await createUser(db, "externo@correo.test"); // registro sin rol → inactivo
}, 60_000);

describe("usuarios y roles", () => {
  it("asigna roles al crear usuarios", async () => {
    const { rows } = await db.query<{ email: string; role: string; active: boolean }>(
      "select email, role, active from profiles order by created_at, email",
    );
    const byEmail = Object.fromEntries(rows.map((r) => [r.email, r]));
    expect(byEmail["admin@inversam.test"]).toMatchObject({ role: "admin", active: true });
    expect(byEmail["mec@inversam.test"]).toMatchObject({ role: "mecanico", active: true });
    expect(byEmail["externo@correo.test"]).toMatchObject({ active: false });
  });

  it("un usuario inactivo no ve datos de negocio pero sí su perfil", async () => {
    const res = await asUser(db, stranger, async (q) => ({
      settings: (await q("select * from settings")).rows.length,
      me: (await q("select * from profiles")).rows.length,
    }));
    expect(res).toEqual({ settings: 0, me: 1 });
  });

  it("el acceso anónimo está bloqueado", async () => {
    await expectError(asUser(db, null, (q) => q("select * from customers")), /permission denied/);
  });

  it("no permite desactivar al último administrador", async () => {
    await expectError(
      asUser(db, admin, (q) => q("update profiles set active = false where id = $1", [admin])),
      /al menos un administrador/,
    );
  });

  it("solo el administrador cambia roles", async () => {
    const r = await asUser(db, recep, (q) =>
      q("update profiles set role = 'admin' where id = $1 returning id", [recep]),
    );
    expect(r.rows.length).toBe(0);
  });
});

describe("clientes y vehículos", () => {
  it("el mecánico no puede crear clientes", async () => {
    await expectError(
      asUser(db, mech, (q) => q("insert into customers (full_name) values ('Cliente X')")),
      /row-level security/,
    );
  });

  it("recepción crea clientes y vehículos", async () => {
    await asUser(db, recep, async (q) => {
      customerId = (
        await q<{ id: string }>(
          "insert into customers (full_name, phone) values ('Cliente Prueba', '9999-0000') returning id",
        )
      ).rows[0].id;
      vehicleId = (
        await q<{ id: string }>(
          "insert into vehicles (customer_id, brand, model, year, plate, mileage) values ($1, 'Toyota', 'Hilux', 2018, 'HAA1234', 50000) returning id",
          [customerId],
        )
      ).rows[0].id;
      const other = (
        await q<{ id: string }>("insert into customers (full_name) values ('Otro Cliente') returning id")
      ).rows[0].id;
      otherVehicleId = (
        await q<{ id: string }>(
          "insert into vehicles (customer_id, brand, model) values ($1, 'Nissan', 'Frontier') returning id",
          [other],
        )
      ).rows[0].id;
    });
    expect(customerId).toBeTruthy();
  });

  it("la placa es única sin importar mayúsculas", async () => {
    await expectError(
      asUser(db, recep, (q) =>
        q("insert into vehicles (customer_id, brand, model, plate) values ($1, 'X', 'Y', 'haa1234')", [customerId]),
      ),
      /duplicate key/,
    );
  });

  it("catálogo inicial sin precios inventados", async () => {
    const { rows } = await db.query<{ n: number; priced: number }>(
      "select count(*)::int n, count(*) filter (where price > 0)::int priced from services",
    );
    expect(rows[0]).toEqual({ n: 9, priced: 0 });
  });
});

describe("órdenes de trabajo", () => {
  it("rechaza un vehículo que no es del cliente", async () => {
    await expectError(
      asUser(db, recep, (q) =>
        q(
          "insert into work_orders (customer_id, vehicle_id, reported_problem) values ($1, $2, 'Ruido en frenos')",
          [customerId, otherVehicleId],
        ),
      ),
      /no pertenece al cliente/,
    );
  });

  it("numera, calcula totales con descuento e ISV y actualiza kilometraje", async () => {
    const res = await asUser(db, recep, async (q) => {
      const wo = (
        await q<{ id: string; order_number: string; tax_rate: string }>(
          `insert into work_orders (customer_id, vehicle_id, reported_problem, mileage_in, discount_type, discount_value, technician_id)
           values ($1, $2, 'Ruido en frenos delanteros', 52000, 'porcentaje', 10, $3) returning id, order_number, tax_rate`,
          [customerId, vehicleId, mech],
        )
      ).rows[0];
      orderId = wo.id;
      await q(
        `insert into work_order_items (work_order_id, item_type, description, quantity, unit_price) values
          ($1, 'servicio', 'Frenos', 1, 1000), ($1, 'repuesto', 'Pastillas', 2, 250.50), ($1, 'mano_obra', 'Mano de obra', 1.5, 200)`,
        [orderId],
      );
      const totals = (
        await q("select subtotal, discount_amount, tax_amount, total, balance from work_orders where id = $1", [orderId])
      ).rows[0];
      const mileage = (await q<{ mileage: number }>("select mileage from vehicles where id = $1", [vehicleId])).rows[0];
      return { wo, totals, mileage };
    });
    expect(res.wo.order_number).toBe("OT-000001");
    expect(Number(res.wo.tax_rate)).toBe(15);
    // subtotal = 1000 + 501 + 300 = 1801 ; desc 10% = 180.10 ; base 1620.90 ; ISV 15% = 243.14 (243.135) ; total 1864.04
    expect(res.totals).toMatchObject({
      subtotal: "1801.00",
      discount_amount: "180.10",
      tax_amount: "243.14",
      total: "1864.04",
      balance: "1864.04",
    });
    expect(res.mileage.mileage).toBe(52000);
  });

  it("el mecánico actualiza diagnóstico/estado y queda historial", async () => {
    await asUser(db, mech, (q) =>
      q("update work_orders set diagnosis = 'Pastillas gastadas', status = 'en_reparacion' where id = $1", [orderId]),
    );
    const { rows } = await db.query<{ to_status: string }>(
      "select to_status from work_order_status_history where work_order_id = $1 order by id",
      [orderId],
    );
    expect(rows.map((r) => r.to_status)).toEqual(["recibido", "en_reparacion"]);
  });

  it("el mecánico no ve pagos", async () => {
    const r = await asUser(db, mech, (q) => q("select * from payments"));
    expect(r.rows.length).toBe(0);
  });
});

describe("caja y pagos", () => {
  it("registra pagos parciales y no permite exceder el saldo", async () => {
    await asUser(db, recep, async (q) => {
      await q("insert into payments (work_order_id, amount, method) values ($1, 1000, 'efectivo')", [orderId]);
      await q("insert into payments (work_order_id, amount, method, reference) values ($1, 500, 'transferencia', 'TRX-1')", [orderId]);
    });
    await expectError(
      asUser(db, recep, (q) => q("insert into payments (work_order_id, amount, method) values ($1, 400, 'tarjeta')", [orderId])),
      /excede el saldo/,
    );
    const { rows } = await db.query("select amount_paid, balance from work_orders where id = $1", [orderId]);
    expect(rows[0]).toEqual({ amount_paid: "1500.00", balance: "364.04" });
  });

  it("los pagos no se editan y la anulación exige motivo", async () => {
    await expectError(
      asUser(db, acct, (q) => q("update payments set amount = 1 where method = 'transferencia'")),
      /no se editan/,
    );
    await expectError(
      asUser(db, acct, (q) => q("update payments set voided = true where method = 'transferencia'")),
      /motivo/,
    );
    await asUser(db, acct, (q) =>
      q("update payments set voided = true, void_reason = 'Duplicado' where method = 'transferencia'"),
    );
    const { rows } = await db.query("select balance from work_orders where id = $1", [orderId]);
    expect(rows[0]).toEqual({ balance: "864.04" });
  });

  it("recepción no puede anular pagos", async () => {
    const r = await asUser(db, recep, (q) =>
      q("update payments set voided = true, void_reason = 'x' where not voided returning id"),
    );
    expect(r.rows.length).toBe(0);
  });

  it("contabilidad registra gastos; recepción no los ve", async () => {
    await asUser(db, acct, (q) =>
      q("insert into expenses (category, description, amount, method) values ('Insumos', 'Trapos y limpiador', 150, 'efectivo')"),
    );
    const r = await asUser(db, recep, (q) => q("select * from expenses"));
    expect(r.rows.length).toBe(0);
  });

  it("cierra caja del día y bloquea movimientos posteriores en esa fecha", async () => {
    const summary = await asUser(db, recep, async (q) => {
      await q("select close_cash_register(hn_today(), 200, 1040, 'Cierre de prueba')");
      return (await q<{ c: Record<string, string> }>("select to_jsonb(c) c from cash_closings c")).rows[0].c;
    });
    // esperado = 200 inicial + 1000 efectivo - 150 gastos = 1050 ; contado 1040 → diferencia -10
    expect(Number(summary.expected_cash)).toBe(1050);
    expect(Number(summary.difference)).toBe(-10);
    expect(Number(summary.total_income)).toBe(1000);

    await expectError(
      asUser(db, recep, (q) => q("insert into payments (work_order_id, amount, method) values ($1, 10, 'efectivo')", [orderId])),
      /ya está cerrada/,
    );
    await expectError(
      asUser(db, acct, (q) => q("update payments set voided = true, void_reason = 'x' where not voided")),
      /cierre de caja/,
    );
    await expectError(
      asUser(db, recep, (q) => q("select close_cash_register(hn_today(), 0, 0)")),
      /ya fue cerrada/,
    );
  });

  it("recepción ve el resumen de caja con gastos en efectivo (para cuadrar)", async () => {
    // Se ejecuta después del cierre: el resumen incluye el cierre y los gastos del día
    const s = await asUser(db, recep, async (q) =>
      (await q<{ s: Record<string, unknown> }>("select cash_register_summary(hn_today()) s")).rows[0].s,
    );
    expect(Number(s.cash_expenses)).toBe(150);
    expect(s.closing).not.toBeNull();
    await expectError(asUser(db, mech, (q) => q("select cash_register_summary(hn_today())")), /permiso/);
  });

  it("el mecánico no puede cerrar caja", async () => {
    await expectError(asUser(db, mech, (q) => q("select close_cash_register(hn_today() - 1, 0, 0)")), /permiso/);
  });

  it("al reabrir (admin borra el cierre) se pueden registrar pagos", async () => {
    await asUser(db, admin, async (q) => {
      await q("delete from cash_closings");
      await q("insert into payments (work_order_id, amount, method) values ($1, 864.04, 'tarjeta')", [orderId]);
    });
    const { rows } = await db.query("select balance from work_orders where id = $1", [orderId]);
    expect(rows[0]).toEqual({ balance: "0.00" });
  });

  it("no permite modificar partidas de una orden entregada", async () => {
    await asUser(db, recep, (q) => q("update work_orders set status = 'entregado' where id = $1", [orderId]));
    const { rows } = await db.query<{ finished_at: string | null; delivered_at: string | null }>(
      "select finished_at, delivered_at from work_orders where id = $1",
      [orderId],
    );
    expect(rows[0].finished_at).not.toBeNull();
    expect(rows[0].delivered_at).not.toBeNull();
    await expectError(
      asUser(db, mech, (q) =>
        q("insert into work_order_items (work_order_id, item_type, description, quantity, unit_price) values ($1, 'repuesto', 'x', 1, 1)", [orderId]),
      ),
      /ya fue entregada/,
    );
  });
});

describe("cotizaciones", () => {
  it("calcula, aprueba y convierte en orden con sus partidas", async () => {
    const res = await asUser(db, recep, async (q) => {
      const quote = (
        await q<{ id: string; quote_number: string; valid_until: string | null }>(
          "insert into quotes (customer_id, vehicle_id, discount_type, discount_value) values ($1, $2, 'monto', 50) returning id, quote_number, valid_until",
          [customerId, vehicleId],
        )
      ).rows[0];
      await q(
        "insert into quote_items (quote_id, item_type, description, quantity, unit_price) values ($1, 'servicio', 'Alineamiento', 1, 500), ($1, 'servicio', 'Balanceo', 4, 100)",
        [quote.id],
      );
      const q1 = (await q("select subtotal, discount_amount, tax_amount, total from quotes where id = $1", [quote.id])).rows[0];
      await q("update quotes set status = 'aprobada' where id = $1", [quote.id]);
      const woId = (
        await q<{ id: string }>("select convert_quote_to_work_order($1, 'Según cotización', 60000) as id", [quote.id])
      ).rows[0].id;
      const wo = (await q("select order_number, total, status from work_orders where id = $1", [woId])).rows[0];
      return { quote, q1, wo };
    });
    expect(res.quote.quote_number).toBe("COT-000001");
    expect(res.quote.valid_until).not.toBeNull();
    // 900 - 50 = 850 ; ISV 127.50 ; total 977.50
    expect(res.q1).toEqual({ subtotal: "900.00", discount_amount: "50.00", tax_amount: "127.50", total: "977.50" });
    expect(res.wo).toEqual({ order_number: "OT-000002", total: "977.50", status: "en_reparacion" });
  });

  it("bloquea partidas de cotizaciones aprobadas y doble conversión", async () => {
    const qid = (await db.query<{ id: string }>("select id from quotes limit 1")).rows[0].id;
    await expectError(
      asUser(db, recep, (q) =>
        q("insert into quote_items (quote_id, item_type, description, quantity, unit_price) values ($1, 'servicio', 'x', 1, 1)", [qid]),
      ),
      /ya fue aprobada/,
    );
    await expectError(
      asUser(db, recep, (q) => q("select convert_quote_to_work_order($1, 'otra vez')", [qid])),
      /ya fue convertida/,
    );
  });
});

describe("dashboard y reportes", () => {
  it("dashboard_stats devuelve métricas coherentes", async () => {
    const s = await asUser(db, admin, async (q) => (await q<{ s: Record<string, unknown> }>("select dashboard_stats() s")).rows[0].s);
    expect(Number(s.income_today)).toBeCloseTo(1864.04, 2);
    expect(Number(s.open_orders)).toBe(1);
    expect(Number(s.in_repair)).toBe(1);
    expect(Number(s.new_customers_month)).toBe(2);
    expect((s.series as unknown[]).length).toBe(30);
    expect((s.top_services as { name: string }[]).map((t) => t.name)).toContain("Frenos");
  });

  it("el mecánico ve el dashboard sin ingresos", async () => {
    const s = await asUser(db, mech, async (q) => (await q<{ s: Record<string, unknown> }>("select dashboard_stats() s")).rows[0].s);
    expect(Number(s.income_today)).toBe(0);
    expect(Number(s.open_orders)).toBe(1);
  });

  it("report_data calcula ingresos, gastos, utilidad y recurrentes", async () => {
    const r = await asUser(db, acct, async (q) =>
      (await q<{ r: Record<string, unknown> }>("select report_data(hn_today() - 7, hn_today()) r")).rows[0].r,
    );
    expect(Number(r.income_total)).toBeCloseTo(1864.04, 2);
    expect(Number(r.expenses_total)).toBe(150);
    expect(Number(r.profit)).toBeCloseTo(1714.04, 2);
    expect(Number(r.orders_count)).toBe(2);
    expect((r.daily as unknown[]).length).toBe(8);
    expect((r.recurring_customers as { full_name: string }[])[0].full_name).toBe("Cliente Prueba");
    expect((r.income_by_method as { method: string }[]).map((m) => m.method).sort()).toEqual(["efectivo", "tarjeta"]);
  });

  it("report_data valida el rango", async () => {
    await expectError(
      asUser(db, acct, (q) => q("select report_data(hn_today(), hn_today() - 1)")),
      /Rango de fechas inválido/,
    );
  });
});
