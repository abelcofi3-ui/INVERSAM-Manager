"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseForm, runAction, type ActionState } from "@/lib/actions";
import { loginSchema } from "@/lib/validation";
import { isSupabaseConfigured } from "@/lib/env";

function safeNext(next: string | undefined) {
  // Solo rutas internas, para evitar redirecciones abiertas.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "El sistema no está configurado: faltan las variables de Supabase en .env.local." };
  }
  let target = "/";
  const result = await runAction(async () => {
    const parsed = parseForm(loginSchema, formData);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      return {
        error:
          error.code === "invalid_credentials"
            ? "Correo o contraseña incorrectos."
            : error.code === "email_not_confirmed"
              ? "El correo aún no ha sido confirmado."
              : "No se pudo iniciar sesión. Intente de nuevo.",
      };
    }
    const { data: profile } = await supabase.from("profiles").select("active").eq("id", data.user.id).maybeSingle();
    if (!profile?.active) {
      await supabase.auth.signOut();
      return { error: "Su usuario está inactivo. Solicite acceso al administrador." };
    }
    target = safeNext(parsed.data.next);
    return { ok: true };
  });
  if (result?.ok) redirect(target);
  return result;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
