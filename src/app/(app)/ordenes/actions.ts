"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAction } from "@/lib/auth";
import { dbErrorMessage, parseForm, runAction, type ActionState } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { localInputToISO } from "@/lib/format";
import { can } from "@/lib/permissions";
import { itemSchema, statusSchema, workOrderCreateSchema, workOrderPricingSchema, workOrderUpdateSchema } from "@/lib/validation";

const path = (id: string) => `/ordenes/${id}`;

export async function createWorkOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await runAction(async () => {
    await requireAction("orders.create");
    const parsed = parseForm(workOrderCreateSchema, fd);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    if (d.discount_type === "porcentaje" && d.discount_value > 100) {
      return { fieldErrors: { discount_value: ["El descuento porcentual no puede exceder 100%"] }, error: "Revise los campos marcados." };
    }
    const serviceIds = fd.getAll("service_ids").filter((v): v is string => typeof v === "string" && z.uuid().safeParse(v).success);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("work_orders")
      .insert({
        customer_id: d.customer_id,
        vehicle_id: d.vehicle_id,
        mileage_in: d.mileage_in,
        reported_problem: d.reported_problem,
        technician_id: d.technician_id,
        promised_at: d.promised_at ? localInputToISO(d.promised_at) : null,
        received_at: d.received_at ? localInputToISO(d.received_at) : undefined,
        notes: d.notes,
        discount_type: d.discount_type,
        discount_value: d.discount_value,
        tax_rate: d.tax_rate,
      })
      .select("id")
      .single();
    if (error) return { error: dbErrorMessage(error) };
    id = data.id;

    if (serviceIds.length) {
      const { data: services } = await supabase.from("services").select("id, name, price").in("id", serviceIds);
      if (services?.length) {
        const { error: itemsError } = await supabase.from("work_order_items").insert(
          services.map((s) => ({
            work_order_id: id,
            item_type: "servicio",
            service_id: s.id,
            description: s.name,
            quantity: 1,
            unit_price: s.price,
          })),
        );
        if (itemsError) console.error("[orden] servicios iniciales", itemsError);
      }
    }
    return { ok: true };
  });
  if (res?.ok) {
    revalidatePath("/ordenes");
    redirect(path(id));
  }
  return res;
}

export async function updateWorkOrder(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("orders.edit");
    const parsed = parseForm(workOrderUpdateSchema, fd);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    const supabase = await createClient();
    const { error } = await supabase
      .from("work_orders")
      .update({ ...d, promised_at: d.promised_at ? localInputToISO(d.promised_at) : null })
      .eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath(path(id));
    return { ok: true, message: "Orden actualizada." };
  });
}

export async function updateWorkOrderPricing(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("orders.pricing");
    const parsed = parseForm(workOrderPricingSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { error } = await supabase.from("work_orders").update(parsed.data).eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath(path(id));
    return { ok: true, message: "Descuento e impuesto actualizados." };
  });
}

export async function changeWorkOrderStatus(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const session = await requireAction("orders.edit");
    const parsed = parseForm(statusSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { data: current } = await supabase.from("work_orders").select("status, balance").eq("id", id).single();
    if (!current) return { error: "Orden no encontrada." };
    if (current.status === "entregado" && session.role !== "admin") {
      return { error: "Solo un administrador puede reabrir una orden entregada." };
    }
    if (parsed.data.status === "entregado" && !can(session.role, "orders.pricing")) {
      return { error: "La entrega del vehículo la registra recepción o administración." };
    }
    const { error } = await supabase.from("work_orders").update({ status: parsed.data.status }).eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath(path(id));
    revalidatePath("/ordenes");
    const warn =
      parsed.data.status === "entregado" && Number(current.balance) > 0
        ? " Atención: el vehículo se entregó con saldo pendiente."
        : "";
    return { ok: true, message: `Estado actualizado.${warn}` };
  });
}

export async function addWorkOrderItem(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("orders.edit");
    const parsed = parseForm(itemSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { error } = await supabase.from("work_order_items").insert({ ...parsed.data, work_order_id: id });
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath(path(id));
    return { ok: true };
  });
}

export async function deleteWorkOrderItem(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("orders.edit");
    const itemId = String(fd.get("item_id") ?? "");
    const orderId = String(fd.get("order_id") ?? "");
    const supabase = await createClient();
    const { error } = await supabase.from("work_order_items").delete().eq("id", itemId);
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath(path(orderId));
    return { ok: true };
  });
}

export async function deleteWorkOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id") ?? "");
  const res = await runAction(async () => {
    await requireAction("orders.delete");
    const supabase = await createClient();
    const { count } = await supabase.from("payments").select("id", { count: "exact", head: true }).eq("work_order_id", id);
    if (count) return { error: "No se puede eliminar: la orden tiene pagos registrados." };
    const { data: photos } = await supabase.from("work_order_photos").select("storage_path").eq("work_order_id", id);
    const { error } = await supabase.from("work_orders").delete().eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
    if (photos?.length) {
      await supabase.storage.from("work-order-photos").remove(photos.map((p) => p.storage_path));
    }
    return { ok: true };
  });
  if (res?.ok) {
    revalidatePath("/ordenes");
    redirect("/ordenes");
  }
  return res;
}

// ---------------------------------------------------------------------
// Fotografías (el archivo se sube desde el navegador a Storage; aquí se registra)
// ---------------------------------------------------------------------
export async function registerWorkOrderPhoto(id: string, storagePath: string, caption: string | null): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("orders.edit");
    if (!storagePath.startsWith(`${id}/`)) return { error: "Ruta de archivo inválida." };
    const supabase = await createClient();
    const { error } = await supabase
      .from("work_order_photos")
      .insert({ work_order_id: id, storage_path: storagePath, caption: caption?.slice(0, 200) || null });
    if (error) {
      await supabase.storage.from("work-order-photos").remove([storagePath]);
      return { error: dbErrorMessage(error) };
    }
    revalidatePath(path(id));
    return { ok: true };
  });
}

export async function deleteWorkOrderPhoto(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("photos.delete");
    const photoId = String(fd.get("photo_id") ?? "");
    const supabase = await createClient();
    const { data: photo } = await supabase
      .from("work_order_photos")
      .select("work_order_id, storage_path")
      .eq("id", photoId)
      .maybeSingle();
    if (!photo) return { error: "Foto no encontrada." };
    const { error: storageError } = await supabase.storage.from("work-order-photos").remove([photo.storage_path]);
    if (storageError) return { error: "No se pudo eliminar el archivo de la foto." };
    const { error } = await supabase.from("work_order_photos").delete().eq("id", photoId);
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath(path(photo.work_order_id));
    return { ok: true };
  });
}
