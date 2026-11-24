"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { dbErrorMessage, parseForm, runAction, type ActionState } from "@/lib/actions";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { passwordResetSchema, userCreateSchema, userUpdateSchema } from "@/lib/validation";

const NO_KEY = "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor; no se pueden administrar cuentas de acceso (ver README).";

export async function createUser(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("users.manage");
    const parsed = parseForm(userCreateSchema, fd);
    if (!parsed.success) return parsed.state;
    const admin = createAdminClient();
    if (!admin) return { error: NO_KEY };
    const d = parsed.data;
    const { data, error } = await admin.auth.admin.createUser({
      email: d.email,
      password: d.password,
      email_confirm: true,
      app_metadata: { role: d.role },
      user_metadata: { full_name: d.full_name },
    });
    if (error) {
      return {
        error:
          error.code === "email_exists" || /already/i.test(error.message)
            ? "Ya existe un usuario con ese correo."
            : error.code === "weak_password"
              ? "La contraseña es demasiado débil."
              : `No se pudo crear el usuario: ${error.message}`,
      };
    }
    // El trigger crea el perfil; completar teléfono
    if (d.phone) {
      const supabase = await createClient();
      await supabase.from("profiles").update({ phone: d.phone }).eq("id", data.user.id);
    }
    revalidatePath("/usuarios");
    return { ok: true, message: `Usuario ${d.email} creado.` };
  });
}

export async function updateUser(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const session = await requireAction("users.manage");
    const parsed = parseForm(userUpdateSchema, fd);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    if (d.id === session.id && (!d.active || d.role !== "admin")) {
      return { error: "No puede quitarse el rol de administrador ni desactivar su propia cuenta." };
    }
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: d.full_name, role: d.role, phone: d.phone, active: d.active })
      .eq("id", d.id);
    if (error) return { error: dbErrorMessage(error) };

    // Mantener el rol también en app_metadata y bloquear el acceso si se desactiva
    const admin = createAdminClient();
    if (admin) {
      await admin.auth.admin.updateUserById(d.id, {
        app_metadata: { role: d.role },
        ban_duration: d.active ? "none" : "876000h",
      });
    }
    revalidatePath("/usuarios");
    return { ok: true, message: "Usuario actualizado." };
  });
}

export async function resetPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("users.manage");
    const parsed = parseForm(passwordResetSchema, fd);
    if (!parsed.success) return parsed.state;
    const admin = createAdminClient();
    if (!admin) return { error: NO_KEY };
    const { error } = await admin.auth.admin.updateUserById(parsed.data.id, { password: parsed.data.password });
    if (error) return { error: `No se pudo cambiar la contraseña: ${error.message}` };
    return { ok: true, message: "Contraseña actualizada." };
  });
}
