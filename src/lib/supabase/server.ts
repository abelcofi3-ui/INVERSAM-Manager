import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/env";

/** Cliente con la sesión del usuario (RLS activo). Crear uno por solicitud. */
export async function createClient() {
  // Leer cookies primero: marca la ruta como dinámica antes de cualquier validación.
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: el proxy se encarga de refrescar la sesión.
        }
      },
    },
  });
}

/**
 * Cliente administrativo (service role). SOLO para acciones de servidor que ya
 * verificaron que el usuario es administrador (gestión de usuarios).
 */
export function createAdminClient() {
  const { url } = supabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createPlainClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
