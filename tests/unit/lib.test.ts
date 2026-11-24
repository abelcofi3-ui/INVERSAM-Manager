import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { addDays, formatHNL, hnDateString, hnDayStartISO, localInputToISO, toLocalInputValue } from "@/lib/format";
import { can, PERMISSIONS } from "@/lib/permissions";
import { calcTotals } from "@/lib/totals";
import { customerSchema, itemSchema, paymentSchema, vehicleSchema, workOrderCreateSchema } from "@/lib/validation";
import { presetRange } from "@/lib/reports";

describe("totales (paridad con PostgreSQL)", () => {
  it("calcTotals coincide con la fórmula SQL en 300 casos aleatorios", async () => {
    const db = new PGlite();
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 300; i++) {
      const lines = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => ({
        quantity: Math.round(rnd() * 500) / 100 + 0.01,
        unit_price: Math.round(rnd() * 500000) / 100,
      }));
      const type = rnd() > 0.5 ? "porcentaje" : "monto";
      const value = type === "porcentaje" ? Math.round(rnd() * 3000) / 100 : Math.round(rnd() * 100000) / 100;
      const tax = [0, 15, 18, 12.5][Math.floor(rnd() * 4)];
      const ts = calcTotals(lines, type, value, tax);

      const values = lines.map((l) => `(${l.quantity}::numeric(10,2), ${l.unit_price}::numeric(12,2))`).join(",");
      const { rows } = await db.query<{ subtotal: string; discount: string; tax: string; total: string }>(`
        with l(q, p) as (values ${values}),
        s as (select sum(round(q * p, 2))::numeric(12,2) as sub from l),
        d as (select sub, case when '${type}' = 'porcentaje' then round(sub * least(greatest(${value}, 0), 100) / 100, 2)
                               else least(greatest(${value}, 0), sub) end as disc from s)
        select sub as subtotal, disc as discount, round((sub - disc) * ${tax} / 100, 2) as tax,
               sub - disc + round((sub - disc) * ${tax} / 100, 2) as total from d`);
      const r = rows[0];
      expect([ts.subtotal, ts.discount, ts.tax, ts.total]).toEqual([Number(r.subtotal), Number(r.discount), Number(r.tax), Number(r.total)]);
    }
  }, 60_000);

  it("el descuento en monto no supera el subtotal", () => {
    expect(calcTotals([{ quantity: 1, unit_price: 100 }], "monto", 500, 15)).toEqual({ subtotal: 100, discount: 100, tax: 0, total: 0 });
  });
});

describe("formato y zona horaria", () => {
  it("formatea Lempiras", () => {
    expect(formatHNL(1234.5).replace(/\s/g, " ")).toBe("L 1,234.50");
    expect(formatHNL(null).replace(/\s/g, " ")).toBe("L 0.00");
  });

  it("usa la fecha de Honduras (UTC-6) y no la del servidor", () => {
    // 2026-01-01 03:00 UTC = 2025-12-31 21:00 en Tegucigalpa
    expect(hnDateString(new Date("2026-01-01T03:00:00Z"))).toBe("2025-12-31");
    expect(hnDayStartISO("2026-03-10")).toBe("2026-03-10T06:00:00.000Z");
    expect(localInputToISO("2026-03-10T08:30")).toBe("2026-03-10T14:30:00.000Z");
    expect(toLocalInputValue("2026-03-10T14:30:00.000Z")).toBe("2026-03-10T08:30");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("rangos predefinidos de reportes son coherentes", () => {
    const mes = presetRange("mes")!;
    expect(mes.from.endsWith("-01")).toBe(true);
    const ant = presetRange("mes_anterior")!;
    expect(ant.to < mes.from).toBe(true);
    expect(presetRange("semana")!.from <= presetRange("hoy")!.from).toBe(true);
  });
});

describe("validaciones", () => {
  it("cliente: nombre obligatorio, correo y RTN válidos, vacíos → null", () => {
    expect(customerSchema.safeParse({ full_name: "" }).success).toBe(false);
    expect(customerSchema.safeParse({ full_name: "Juan Pérez", email: "malo" }).success).toBe(false);
    const ok = customerSchema.parse({ full_name: " Juan Pérez ", phone: "9999-0000", email: "", rtn: "0501-1990-123456" });
    expect(ok).toMatchObject({ full_name: "Juan Pérez", email: null, rtn: "05011990123456" });
  });

  it("vehículo: normaliza placa y valida VIN", () => {
    const base = { customer_id: "3f0e2a4c-8d1b-4c5e-9f7a-1b2c3d4e5f60", brand: "Toyota", model: "Hilux", vehicle_type: "pickup" };
    expect(vehicleSchema.parse({ ...base, plate: "haa 1234" }).plate).toBe("HAA1234");
    expect(vehicleSchema.safeParse({ ...base, vin: "IOQ12345678" }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...base, year: "1800" }).success).toBe(false);
  });

  it("partidas y pagos: montos positivos", () => {
    expect(itemSchema.safeParse({ item_type: "repuesto", description: "Filtro", quantity: "0", unit_price: "10" }).success).toBe(false);
    expect(itemSchema.parse({ item_type: "repuesto", description: "Filtro", quantity: "2", unit_price: "1,250.555" }).unit_price).toBe(1250.56);
    expect(paymentSchema.safeParse({ work_order_id: "3f0e2a4c-8d1b-4c5e-9f7a-1b2c3d4e5f60", amount: "-5", method: "efectivo" }).success).toBe(false);
  });

  it("orden: requiere cliente, vehículo y problema", () => {
    const r = workOrderCreateSchema.safeParse({ reported_problem: "x", discount_value: "0", tax_rate: "15" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const keys = r.error.issues.map((i) => i.path[0]);
      expect(keys).toEqual(expect.arrayContaining(["customer_id", "vehicle_id", "reported_problem"]));
    }
  });
});

describe("permisos", () => {
  it("el mecánico no accede a caja, reportes ni usuarios", () => {
    expect(can("mecanico", "cash.view")).toBe(false);
    expect(can("mecanico", "reports.view")).toBe(false);
    expect(can("mecanico", "orders.edit")).toBe(true);
  });
  it("el administrador tiene todos los permisos", () => {
    for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) expect(can("admin", p)).toBe(true);
  });
  it("sin rol no hay permisos", () => {
    expect(can(null, "dashboard.view")).toBe(false);
  });
});
