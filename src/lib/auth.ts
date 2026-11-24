import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { can, type Permission, type Role } from "@/lib/permissions";

export interface SessionProfile {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  active: boolean;
}

/** Usuario actual con su perfil (memorizado por solicitud). */
export const getSession = cache(async (): Promise<SessionProfile | null> => {
  await cookies(); // ruta dinámica
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, active")
    .eq("id", userId)
    .maybeSingle();
  if (!data) {
    // Autenticado en Supabase pero sin perfil (p. ej. migraciones incompletas): tratar como inactivo
    return { id: userId, email: (claims.claims.email as string | undefined) ?? null, full_name: "", role: "recepcionista", active: false };
  }
  return data as SessionProfile;
});

/** Para páginas: exige sesión activa (y permiso, si se indica). */
export async function requirePage(permission?: Permission): Promise<SessionProfile> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.active) redirect("/login?inactivo=1");
  if (permission && !can(session.role, permission)) redirect("/?denegado=1");
  return session;
}

export class AuthError extends Error {}

/** Para acciones de servidor: lanza AuthError si no hay permiso. */
export async function requireAction(permission: Permission): Promise<SessionProfile> {
  const session = await getSession();
  if (!session || !session.active) throw new AuthError("Su sesión expiró. Vuelva a iniciar sesión.");
  if (!can(session.role, permission)) throw new AuthError("No tiene permiso para realizar esta acción.");
  return session;
}
