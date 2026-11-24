export const WORK_ORDER_STATUSES = [
  "recibido",
  "en_diagnostico",
  "esperando_aprobacion",
  "en_reparacion",
  "finalizado",
  "entregado",
] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  recibido: "Recibido",
  en_diagnostico: "En diagnóstico",
  esperando_aprobacion: "Esperando aprobación",
  en_reparacion: "En reparación",
  finalizado: "Finalizado",
  entregado: "Entregado",
};

export const WORK_ORDER_STATUS_TONE: Record<WorkOrderStatus, Tone> = {
  recibido: "slate",
  en_diagnostico: "amber",
  esperando_aprobacion: "orange",
  en_reparacion: "blue",
  finalizado: "green",
  entregado: "teal",
};

export const QUOTE_STATUSES = ["borrador", "enviada", "aprobada", "rechazada"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};
export const QUOTE_STATUS_TONE: Record<QuoteStatus, Tone> = {
  borrador: "slate",
  enviada: "blue",
  aprobada: "green",
  rechazada: "red",
};

export const ITEM_TYPES = ["servicio", "repuesto", "mano_obra"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];
export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  servicio: "Servicio",
  repuesto: "Repuesto",
  mano_obra: "Mano de obra",
};

export const PAYMENT_METHODS = ["efectivo", "transferencia", "tarjeta"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

export const APPOINTMENT_STATUSES = ["programada", "confirmada", "atendida", "cancelada", "no_asistio"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  programada: "Programada",
  confirmada: "Confirmada",
  atendida: "Atendida",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
};
export const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, Tone> = {
  programada: "slate",
  confirmada: "blue",
  atendida: "green",
  cancelada: "red",
  no_asistio: "amber",
};

export const VEHICLE_TYPES = [
  "sedan",
  "hatchback",
  "pickup",
  "suv",
  "camioneta",
  "microbus",
  "camion",
  "motocicleta",
  "otro",
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];
export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  sedan: "Sedán",
  hatchback: "Hatchback",
  pickup: "Pick-up",
  suv: "SUV",
  camioneta: "Camioneta",
  microbus: "Microbús",
  camion: "Camión",
  motocicleta: "Motocicleta",
  otro: "Otro",
};

export const EXPENSE_CATEGORIES = [
  "Repuestos e insumos",
  "Herramientas y equipo",
  "Salarios",
  "Alquiler",
  "Energía eléctrica",
  "Agua",
  "Internet y teléfono",
  "Combustible",
  "Mantenimiento del local",
  "Impuestos y tasas",
  "Publicidad",
  "Otros",
];

export type Tone = "slate" | "blue" | "green" | "amber" | "orange" | "red" | "teal";

export function vehicleLabel(v: { brand?: string | null; model?: string | null; year?: number | null; plate?: string | null } | null | undefined) {
  if (!v) return "—";
  const base = [v.brand, v.model, v.year].filter(Boolean).join(" ");
  return v.plate ? `${base} · ${v.plate}` : base;
}
