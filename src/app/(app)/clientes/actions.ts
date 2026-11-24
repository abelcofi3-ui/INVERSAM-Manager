"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { dbErrorMessage, parseForm, runAction, type ActionState } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { customerSchema } from "@/lib/validation";

export async function createCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await runAction(async () => {
    await requireAction("customers.edit");
    const parsed = parseForm(customerSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { data, error } = await supabase.from("customers").insert(parsed.data).select("id").single();
    if (error) return { error: dbErrorMessage(error) };
    id = data.id;
    return { ok: true };
  });
  if (res?.ok) {
    revalidatePath("/clientes");
    const next = fd.get("next");
    redirect(typeof next === "string" && next.startsWith("/") ? next.replace("{id}", id) : `/clientes/${id}`);
  }
  return res;
}

export async function updateCustomer(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const res = await runAction(async () => {
    await requireAction("customers.edit");
    const parsed = parseForm(customerSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { error } = await supabase.from("customers").update(parsed.data).eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
    return { ok: true };
  });
  if (res?.ok) {
    revalidatePath("/clientes");
    redirect(`/clientes/${id}`);
  }
  return res;
}

export async function deleteCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id") ?? "");
  const res = await runAction(async () => {
    await requireAction("customers.delete");
    const supabase = await createClient();
    const { count } = await supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", id);
    if (count) {
      return { error: `No se puede eliminar: el cliente tiene ${count} orden(es) de trabajo registradas.` };
    }
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
    return { ok: true };
  });
  if (res?.ok) {
    revalidatePath("/clientes");
    redirect("/clientes");
  }
  return res;
}
