import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { AuthError } from "@/lib/auth";

import type { ActionState } from "@/lib/action-state";
export type { ActionState };

interface DbError {
  code?: string;
  message?: string;
  details?: string | null;
}

/** Traduce errores de PostgreSQL/PostgREST a mensajes en español para el usuario. */
export function dbErrorMessage(err: DbError): string {
  const msg = err.message ?? "";
  switch (err.code) {
    case "P0001": // RAISE EXCEPTION de nuestras reglas de negocio (ya en español)
      return msg;
    case "23505":
      if (msg.includes("plate")) return "Ya existe un vehículo con esa placa.";
      if (msg.includes("vin")) return "Ya existe un vehículo con ese VIN.";
      if (msg.includes("services_name")) return "Ya existe un servicio con ese nombre.";
      if (msg.includes("closing_date")) return "La caja de esa fecha ya fue cerrada.";
      if (msg.includes("work_orders_quote")) return "Esta cotización ya fue convertida en orden.";
      return "Ya existe un registro con esos datos.";
    case "23503":
      return "No se puede completar: el registro está relacionado con otros datos (órdenes, pagos o cotizaciones).";
    case "23514":
      return "Algún valor está fuera del rango permitido. Revise los datos.";
    case "23502":
      return "Falta un dato obligatorio.";
    case "22P02":
      return "Formato de dato inválido.";
    case "42501":
      return msg.includes("row-level security") || !msg ? "No tiene permiso para realizar esta acción." : msg;
    case "PGRST116":
      return "Registro no encontrado.";
    default:
      if (msg.includes("row-level security")) return "No tiene permiso para realizar esta acción.";
      console.error("[db]", err);
      return "Ocurrió un error al guardar. Intente de nuevo.";
  }
}

/** Ejecuta una acción con manejo uniforme de errores (respeta redirect()/notFound()). */
export async function runAction(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AuthError) return { error: e.message };
    console.error("[action]", e);
    return { error: "Ocurrió un error inesperado. Intente de nuevo." };
  }
}

/** Convierte FormData en objeto plano (los campos repetidos se vuelven arreglos). */
export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const v = typeof value === "string" ? value : value;
    if (key in out) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, v] : [prev, v];
    } else {
      out[key] = v;
    }
  }
  return out;
}

export function parseForm<T extends z.ZodType>(schema: T, fd: FormData):
  | { success: true; data: z.infer<T> }
  | { success: false; state: ActionState } {
  const result = schema.safeParse(formToObject(fd));
  if (result.success) return { success: true, data: result.data };
  const flat = z.flattenError(result.error);
  return {
    success: false,
    state: {
      error: flat.formErrors[0] ?? "Revise los campos marcados.",
      fieldErrors: flat.fieldErrors as Record<string, string[] | undefined>,
    },
  };
}
