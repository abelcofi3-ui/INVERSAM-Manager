"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { dbErrorMessage, parseForm, runAction, type ActionState } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validation";

export async function saveSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("settings.manage");
    const parsed = parseForm(settingsSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { error } = await supabase.from("settings").update(parsed.data).eq("id", 1);
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath("/", "layout");
    return { ok: true, message: "Configuración guardada. El nuevo impuesto aplica a documentos nuevos." };
  });
}
