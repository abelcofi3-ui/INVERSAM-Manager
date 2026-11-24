"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { dbErrorMessage, parseForm, runAction, type ActionState } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { cashCloseSchema, expenseSchema, paymentSchema, voidPaymentSchema } from "@/lib/validation";
import { formatHNL, hnDateString } from "@/lib/format";

export async function registerPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("payments.create");
    const parsed = parseForm(paymentSchema, fd);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    if (d.method !== "efectivo" && !d.reference) {
      return { fieldErrors: { reference: ["Indique la referencia o número de autorización"] }, error: "Revise los campos marcados." };
    }
    const supabase = await createClient();
    const { error } = await supabase.from("payments").insert(d);
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath(`/ordenes/${d.work_order_id}`);
    revalidatePath("/caja");
    return { ok: true, message: `Pago de ${formatHNL(d.amount)} registrado.` };
  });
}

export async function voidPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("payments.void");
    const parsed = parseForm(voidPaymentSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payments")
      .update({ voided: true, void_reason: parsed.data.void_reason })
      .eq("id", parsed.data.id)
      .select("work_order_id")
      .single();
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath(`/ordenes/${data.work_order_id}`);
    revalidatePath("/caja");
    return { ok: true, message: "Pago anulado." };
  });
}

export async function closeCashRegister(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("cash.close");
    const parsed = parseForm(cashCloseSchema, fd);
    if (!parsed.success) return parsed.state;
    const d = parsed.data;
    if (d.closing_date > hnDateString()) return { error: "No se puede cerrar una fecha futura." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("close_cash_register", {
      p_date: d.closing_date,
      p_opening_cash: d.opening_cash,
      p_counted_cash: d.counted_cash,
      p_notes: d.notes,
    });
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath("/caja");
    return { ok: true, message: "Cierre de caja registrado." };
  });
}

export async function reopenCashRegister(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("cash.reopen");
    const id = String(fd.get("id") ?? "");
    const supabase = await createClient();
    const { error } = await supabase.from("cash_closings").delete().eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath("/caja");
    return { ok: true, message: "Cierre eliminado: la caja de ese día quedó abierta." };
  });
}

export async function saveExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("expenses.edit");
    const parsed = parseForm(expenseSchema, fd);
    if (!parsed.success) return parsed.state;
    if (parsed.data.expense_date > hnDateString()) {
      return { fieldErrors: { expense_date: ["La fecha no puede ser futura"] }, error: "Revise los campos marcados." };
    }
    const id = fd.get("id");
    const supabase = await createClient();
    const { error } =
      typeof id === "string" && id
        ? await supabase.from("expenses").update(parsed.data).eq("id", id)
        : await supabase.from("expenses").insert(parsed.data);
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath("/gastos");
    revalidatePath("/caja");
    return { ok: true, message: "Gasto registrado." };
  });
}

export async function deleteExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("expenses.delete");
    const supabase = await createClient();
    const { error } = await supabase.from("expenses").delete().eq("id", String(fd.get("id") ?? ""));
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath("/gastos");
    return { ok: true };
  });
}
