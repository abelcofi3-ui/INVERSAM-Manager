import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { hnDateString } from "@/lib/format";


const TABLES = [
  "settings",
  "profiles",
  "services",
  "customers",
  "vehicles",
  "quotes",
  "quote_items",
  "work_orders",
  "work_order_items",
  "work_order_photos",
  "work_order_status_history",
  "cash_closings",
  "payments",
  "expenses",
  "appointments",
] as const;

const PAGE = 1000;

/** Respaldo lógico completo en JSON (solo administradores). */
export async function GET() {
  const session = await getSession();
  if (!session?.active) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!can(session.role, "backup.download")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const supabase = await createClient();
  const data: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data: chunk, error } = await supabase.from(table).select("*").range(from, from + PAGE - 1);
      if (error) {
        console.error("[respaldo]", table, error);
        return NextResponse.json({ error: `No se pudo leer la tabla ${table}` }, { status: 500 });
      }
      rows.push(...(chunk ?? []));
      if (!chunk || chunk.length < PAGE) break;
    }
    data[table] = rows;
  }

  const body = JSON.stringify(
    { app: "INVERSAM Manager", version: 1, generated_at: new Date().toISOString(), generated_by: session.email, tables: data },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="respaldo-inversam-${hnDateString()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
