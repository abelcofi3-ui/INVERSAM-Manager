export const TIME_ZONE = "America/Tegucigalpa";
export const LOCALE = "es-HN";

const currency = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "HNL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

/** Formato de moneda Lempiras: L 1,234.50 */
export function formatHNL(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return currency.format(Number.isFinite(n) ? n : 0);
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return number.format(Number.isFinite(n) ? n : 0);
}

function toDate(value: string | Date): Date {
  // Una fecha "YYYY-MM-DD" se interpreta como día calendario (sin desplazamiento de zona).
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00-06:00`);
  }
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(
    toDate(value),
  );
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(toDate(value));
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: true }).format(
    toDate(value),
  );
}

/** Fecha local de Honduras en formato YYYY-MM-DD. */
export function hnDateString(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Valor para <input type="datetime-local"> en hora de Honduras. */
export function toLocalInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = toDate(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Convierte "YYYY-MM-DDTHH:mm" (hora local de Honduras) a ISO UTC.
 * Honduras usa UTC-6 todo el año (sin horario de verano).
 */
export function localInputToISO(value: string): string {
  return new Date(`${value}:00-06:00`).toISOString();
}

/** Inicio del día local (YYYY-MM-DD) como ISO UTC. */
export function hnDayStartISO(date: string): string {
  return new Date(`${date}T00:00:00-06:00`).toISOString();
}
