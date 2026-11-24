import { z } from "zod";
import {
  APPOINTMENT_STATUSES,
  ITEM_TYPES,
  PAYMENT_METHODS,
  QUOTE_STATUSES,
  VEHICLE_TYPES,
  WORK_ORDER_STATUSES,
} from "@/lib/labels";

// ---------------------------------------------------------------------
// Primitivas reutilizables (los formularios envían cadenas; "" = vacío)
// ---------------------------------------------------------------------
const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const reqText = (label: string, min = 1, max = 500) =>
  z
    .string({ error: `${label} es obligatorio` })
    .trim()
    .min(min, min <= 1 ? `${label} es obligatorio` : `${label} debe tener al menos ${min} caracteres`)
    .max(max, `${label} no debe exceder ${max} caracteres`);

export const optText = (max = 1000) =>
  z.preprocess(emptyToUndef, z.string().trim().max(max, `Máximo ${max} caracteres`).optional()).transform((v) => v ?? null);

export const optEmail = z
  .preprocess(emptyToUndef, z.email("Correo electrónico inválido").optional())
  .transform((v) => v ?? null);

export const optPhone = z
  .preprocess(
    emptyToUndef,
    z
      .string()
      .trim()
      .regex(/^[+\d][\d\s-]{6,19}$/, "Teléfono inválido (ej. 9999-9999 o +504 9999-9999)")
      .optional(),
  )
  .transform((v) => v ?? null);

export const uuid = (label: string) => z.uuid(`Seleccione ${label}`);
export const optUuid = z.preprocess(emptyToUndef, z.uuid().optional()).transform((v) => v ?? null);

export const money = (label: string, { positive = false } = {}) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/,/g, "").trim() : v),
    z.coerce
      .number({ error: `${label} debe ser un número` })
      .refine((n) => Number.isFinite(n), `${label} debe ser un número`)
      .refine((n) => (positive ? n > 0 : n >= 0), positive ? `${label} debe ser mayor que 0` : `${label} no puede ser negativo`)
      .refine((n) => n <= 99_999_999, `${label} es demasiado alto`)
      .transform((n) => Math.round(n * 100) / 100),
  );

export const optInt = (label: string, min: number, max: number) =>
  z
    .preprocess(
      emptyToUndef,
      z.coerce
        .number({ error: `${label} debe ser un número` })
        .int(`${label} debe ser un número entero`)
        .min(min, `${label} mínimo ${min}`)
        .max(max, `${label} máximo ${max}`)
        .optional(),
    )
    .transform((v) => v ?? null);

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const dateTimeStr = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha y hora inválidas");
export const optDateTime = z.preprocess(emptyToUndef, dateTimeStr.optional()).transform((v) => v ?? null);
export const optDate = z.preprocess(emptyToUndef, dateStr.optional()).transform((v) => v ?? null);

// ---------------------------------------------------------------------
// Esquemas por módulo
// ---------------------------------------------------------------------
export const customerSchema = z.object({
  full_name: reqText("El nombre", 2, 150),
  phone: optPhone,
  email: optEmail,
  address: optText(300),
  rtn: z
    .preprocess(emptyToUndef, z.string().trim().regex(/^\d{4}-?\d{4}-?\d{6}$/, "RTN inválido (14 dígitos)").optional())
    .transform((v) => (v ? v.replace(/-/g, "") : null)),
  notes: optText(1000),
});

export const vehicleSchema = z.object({
  customer_id: uuid("el cliente propietario"),
  brand: reqText("La marca", 1, 60),
  model: reqText("El modelo", 1, 60),
  year: optInt("El año", 1950, new Date().getFullYear() + 1),
  plate: z
    .preprocess(emptyToUndef, z.string().trim().toUpperCase().max(15, "Placa demasiado larga").optional())
    .transform((v) => (v ? v.replace(/\s+/g, "") : null)),
  vin: z
    .preprocess(
      emptyToUndef,
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-HJ-NPR-Z0-9]{11,17}$/, "VIN inválido (11 a 17 caracteres, sin I, O ni Q)")
        .optional(),
    )
    .transform((v) => v ?? null),
  color: optText(30),
  vehicle_type: z.enum(VEHICLE_TYPES, { error: "Tipo de vehículo inválido" }),
  mileage: optInt("El kilometraje", 0, 3_000_000),
  notes: optText(1000),
});

export const serviceSchema = z.object({
  name: reqText("El nombre", 2, 100),
  category: optText(60),
  description: optText(500),
  price: money("El precio"),
  estimated_minutes: optInt("El tiempo estimado", 1, 6000),
  active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

const discountFields = {
  discount_type: z.enum(["monto", "porcentaje"]).default("monto"),
  discount_value: money("El descuento"),
  tax_rate: money("El impuesto").refine((n) => n <= 100, "El impuesto no puede exceder 100%"),
};

export const workOrderCreateSchema = z.object({
  customer_id: uuid("el cliente"),
  vehicle_id: uuid("el vehículo"),
  mileage_in: optInt("El kilometraje", 0, 3_000_000),
  reported_problem: reqText("El problema reportado", 3, 2000),
  technician_id: optUuid,
  promised_at: optDateTime,
  received_at: optDateTime,
  notes: optText(2000),
  ...discountFields,
});

export const workOrderUpdateSchema = z.object({
  mileage_in: optInt("El kilometraje", 0, 3_000_000),
  reported_problem: reqText("El problema reportado", 3, 2000),
  diagnosis: optText(4000),
  technician_id: optUuid,
  promised_at: optDateTime,
  notes: optText(2000),
});

export const workOrderPricingSchema = z.object(discountFields).refine(
  (v) => v.discount_type !== "porcentaje" || v.discount_value <= 100,
  { message: "El descuento porcentual no puede exceder 100%", path: ["discount_value"] },
);

export const statusSchema = z.object({ status: z.enum(WORK_ORDER_STATUSES, { error: "Estado inválido" }) });

export const itemSchema = z.object({
  item_type: z.enum(ITEM_TYPES, { error: "Tipo de partida inválido" }),
  service_id: optUuid,
  description: reqText("La descripción", 1, 300),
  quantity: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.coerce.number({ error: "Cantidad inválida" }).positive("La cantidad debe ser mayor que 0").max(100000, "Cantidad demasiado alta"),
  ),
  unit_price: money("El precio unitario"),
});

export const quoteCreateSchema = z
  .object({
    customer_id: uuid("el cliente"),
    vehicle_id: optUuid,
    valid_until: optDate,
    notes: optText(2000),
    ...discountFields,
  })
  .refine((v) => v.discount_type !== "porcentaje" || v.discount_value <= 100, {
    message: "El descuento porcentual no puede exceder 100%",
    path: ["discount_value"],
  });

export const quoteUpdateSchema = z
  .object({
    vehicle_id: optUuid,
    valid_until: optDate,
    notes: optText(2000),
    ...discountFields,
  })
  .refine((v) => v.discount_type !== "porcentaje" || v.discount_value <= 100, {
    message: "El descuento porcentual no puede exceder 100%",
    path: ["discount_value"],
  });

export const quoteStatusSchema = z.object({
  status: z.enum(QUOTE_STATUSES),
  decision_notes: optText(1000),
});

export const convertQuoteSchema = z.object({
  reported_problem: reqText("El problema / trabajo a realizar", 3, 2000),
  mileage_in: optInt("El kilometraje", 0, 3_000_000),
  technician_id: optUuid,
});

export const paymentSchema = z.object({
  work_order_id: uuid("la orden de trabajo"),
  amount: money("El monto", { positive: true }),
  method: z.enum(PAYMENT_METHODS, { error: "Seleccione el método de pago" }),
  reference: optText(100),
  notes: optText(500),
});

export const voidPaymentSchema = z.object({
  id: z.uuid(),
  void_reason: reqText("El motivo", 3, 300),
});

export const expenseSchema = z.object({
  expense_date: dateStr,
  category: reqText("La categoría", 2, 60),
  description: reqText("La descripción", 2, 300),
  amount: money("El monto", { positive: true }),
  method: z.enum(PAYMENT_METHODS, { error: "Seleccione el método de pago" }),
  reference: optText(100),
});

export const cashCloseSchema = z.object({
  closing_date: dateStr,
  opening_cash: money("El fondo inicial"),
  counted_cash: money("El efectivo contado"),
  notes: optText(1000),
});

export const appointmentSchema = z.object({
  customer_id: uuid("el cliente"),
  vehicle_id: optUuid,
  service_id: optUuid,
  scheduled_at: dateTimeStr,
  duration_minutes: z.coerce.number().int().min(10, "Mínimo 10 minutos").max(600, "Máximo 600 minutos"),
  notes: optText(1000),
});

export const appointmentStatusSchema = z.object({ status: z.enum(APPOINTMENT_STATUSES) });

export const settingsSchema = z.object({
  business_name: reqText("El nombre comercial", 2, 100),
  legal_name: optText(150),
  rtn: optText(20),
  address: optText(300),
  phone: optText(40),
  email: optEmail,
  tax_label: reqText("La etiqueta del impuesto", 1, 20),
  tax_rate: money("La tasa de impuesto").refine((n) => n <= 100, "Máximo 100%"),
  quote_validity_days: z.coerce.number().int().min(1, "Mínimo 1 día").max(365, "Máximo 365 días"),
  document_footer: optText(500),
});

export const ROLES = ["admin", "recepcionista", "mecanico", "contabilidad"] as const;

export const userCreateSchema = z.object({
  full_name: reqText("El nombre", 2, 120),
  email: z.email("Correo electrónico inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
  role: z.enum(ROLES, { error: "Seleccione un rol" }),
  phone: optPhone,
});

export const userUpdateSchema = z.object({
  id: z.uuid(),
  full_name: reqText("El nombre", 2, 120),
  role: z.enum(ROLES, { error: "Seleccione un rol" }),
  phone: optPhone,
  active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const passwordResetSchema = z.object({
  id: z.uuid(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(72),
});

export const loginSchema = z.object({
  email: z.email("Correo electrónico inválido"),
  password: z.string().min(1, "Ingrese su contraseña"),
  next: z.string().optional(),
});

export const reportRangeSchema = z
  .object({ from: dateStr, to: dateStr })
  .refine((v) => v.to >= v.from, { message: "La fecha final debe ser posterior a la inicial", path: ["to"] });
