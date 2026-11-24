"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAction } from "@/lib/auth";
import { dbErrorMessage, parseForm, runAction, type ActionState } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { convertQuoteSchema, itemSchema, quoteCreateSchema, quoteStatusSchema, quoteUpdateSchema } from "@/lib/validation";

const path = (id: string) => `/cotizaciones/${id}`;

export async function createQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await runAction(async () => {
    await requireAction("quotes.edit");
    const parsed = parseForm(quoteCreateSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { data, error } = await supabase.from("quotes").insert(parsed.data).select("id").single();
    if (error) return { error: dbErrorMessage(error) };
    id = data.id;
    return { ok: true };
  });
  if (res?.ok) {
    revalidatePath("/cotizaciones");
    redirect(path(id));
  }
  return res;
}

async function assertEditable(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase.from("quotes").select("status").eq("id", id).single();
  if (!data) return "Cotización no encontrada.";
  if (data.status === "aprobada" || data.status === "rechazada") return `La cotización ya fue ${data.status}; no se puede modificar.`;
  return null;
}

export async function updateQuote(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("quotes.edit");
    const parsed = parseForm(quoteUpdateSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const locked = await assertEditable(supabase, id);
    if (locked) return { error: locked };
    const { error } = await supabase.from("quotes").update(parsed.data).eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath(path(id));
    return { ok: true, message: "Cotización actualizada." };
  });
}

export async function addQuoteItem(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("quotes.edit");
    const parsed = parseForm(itemSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { error } = await supabase.from("quote_items").insert({ ...parsed.data, quote_id: id });
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath(path(id));
    return { ok: true };
  });
}

export async function deleteQuoteItem(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("quotes.edit");
    const supabase = await createClient();
    const { error } = await supabase.from("quote_items").delete().eq("id", String(fd.get("item_id") ?? ""));
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath(path(String(fd.get("quote_id") ?? "")));
    return { ok: true };
  });
}

export async function setQuoteStatus(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("quotes.edit");
    const parsed = parseForm(quoteStatusSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { data: q } = await supabase.from("quotes").select("status, total").eq("id", id).single();
    if (!q) return { error: "Cotización no encontrada." };
    const next = parsed.data.status;
    if ((q.status === "aprobada" || q.status === "rechazada") && next !== q.status) {
      const { count } = await supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("quote_id", id);
      if (count) return { error: "La cotización ya se convirtió en orden; no se puede cambiar su estado." };
    }
    if (next === "aprobada" && Number(q.total) <= 0) return { error: "Agregue partidas antes de aprobar la cotización." };
    const { error } = await supabase
      .from("quotes")
      .update({ status: next, decision_notes: parsed.data.decision_notes })
      .eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath(path(id));
    revalidatePath("/cotizaciones");
    return { ok: true, message: "Estado actualizado." };
  });
}

export async function convertQuoteToOrder(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  let orderId = "";
  const res = await runAction(async () => {
    await requireAction("orders.create");
    const parsed = parseForm(convertQuoteSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("convert_quote_to_work_order", {
      p_quote_id: id,
      p_reported_problem: parsed.data.reported_problem,
      p_mileage_in: parsed.data.mileage_in,
      p_technician_id: parsed.data.technician_id,
    });
    if (error) return { error: dbErrorMessage(error) };
    orderId = data as string;
    return { ok: true };
  });
  if (res?.ok) {
    revalidatePath("/ordenes");
    revalidatePath(path(id));
    redirect(`/ordenes/${orderId}`);
  }
  return res;
}

export async function deleteQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await runAction(async () => {
    await requireAction("quotes.delete");
    const supabase = await createClient();
    const { error } = await supabase.from("quotes").delete().eq("id", String(fd.get("id") ?? ""));
    if (error) return { error: dbErrorMessage(error) };
    return { ok: true };
  });
  if (res?.ok) {
    revalidatePath("/cotizaciones");
    redirect("/cotizaciones");
  }
  return res;
}
