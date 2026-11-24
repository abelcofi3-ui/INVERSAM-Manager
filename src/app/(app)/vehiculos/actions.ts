"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { dbErrorMessage, parseForm, runAction, type ActionState } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { vehicleSchema } from "@/lib/validation";

export async function createVehicle(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await runAction(async () => {
    await requireAction("vehicles.edit");
    const parsed = parseForm(vehicleSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { data, error } = await supabase.from("vehicles").insert(parsed.data).select("id").single();
    if (error) return { error: dbErrorMessage(error) };
    id = data.id;
    return { ok: true };
  });
  if (res?.ok) {
    revalidatePath("/vehiculos");
    redirect(`/vehiculos/${id}`);
  }
  return res;
}

export async function updateVehicle(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const res = await runAction(async () => {
    await requireAction("vehicles.edit");
    const parsed = parseForm(vehicleSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { error } = await supabase.from("vehicles").update(parsed.data).eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
    return { ok: true };
  });
  if (res?.ok) {
    revalidatePath("/vehiculos");
    redirect(`/vehiculos/${id}`);
  }
  return res;
}

export async function deleteVehicle(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id") ?? "");
  const res = await runAction(async () => {
    await requireAction("vehicles.delete");
    const supabase = await createClient();
    const { count } = await supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("vehicle_id", id);
    if (count) return { error: `No se puede eliminar: el vehículo tiene ${count} orden(es) registradas.` };
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
    return { ok: true };
  });
  if (res?.ok) {
    revalidatePath("/vehiculos");
    redirect("/vehiculos");
  }
  return res;
}
