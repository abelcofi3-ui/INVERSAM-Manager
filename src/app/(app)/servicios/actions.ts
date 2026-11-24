"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { dbErrorMessage, parseForm, runAction, type ActionState } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { serviceSchema } from "@/lib/validation";

export async function saveService(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("services.edit");
    const parsed = parseForm(serviceSchema, fd);
    if (!parsed.success) return parsed.state;
    const id = fd.get("id");
    const supabase = await createClient();
    const { error } =
      typeof id === "string" && id
        ? await supabase.from("services").update(parsed.data).eq("id", id)
        : await supabase.from("services").insert(parsed.data);
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath("/servicios");
    return { ok: true, message: "Servicio guardado." };
  });
}

export async function deleteService(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("services.edit");
    const id = String(fd.get("id") ?? "");
    const supabase = await createClient();
    const [{ count: used }, { count: quoted }] = await Promise.all([
      supabase.from("work_order_items").select("id", { count: "exact", head: true }).eq("service_id", id),
      supabase.from("quote_items").select("id", { count: "exact", head: true }).eq("service_id", id),
    ]);
    if ((used ?? 0) + (quoted ?? 0) > 0) {
      return { error: "El servicio ya se usó en órdenes o cotizaciones. Desactívelo en lugar de eliminarlo." };
    }
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath("/servicios");
    return { ok: true };
  });
}
