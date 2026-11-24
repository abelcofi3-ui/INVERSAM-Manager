"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { dbErrorMessage, parseForm, runAction, type ActionState } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { localInputToISO } from "@/lib/format";
import { appointmentSchema, appointmentStatusSchema } from "@/lib/validation";

export async function createAppointment(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("appointments.edit");
    const parsed = parseForm(appointmentSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { error } = await supabase
      .from("appointments")
      .insert({ ...parsed.data, scheduled_at: localInputToISO(parsed.data.scheduled_at) });
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath("/citas");
    revalidatePath("/");
    return { ok: true, message: "Cita programada." };
  });
}

export async function setAppointmentStatus(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("appointments.edit");
    const parsed = parseForm(appointmentStatusSchema, fd);
    if (!parsed.success) return parsed.state;
    const supabase = await createClient();
    const { error } = await supabase.from("appointments").update({ status: parsed.data.status }).eq("id", id);
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath("/citas");
    revalidatePath("/");
    return { ok: true };
  });
}

export async function deleteAppointment(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("appointments.edit");
    const supabase = await createClient();
    const { error } = await supabase.from("appointments").delete().eq("id", String(fd.get("id") ?? ""));
    if (error) return { error: dbErrorMessage(error) };
    revalidatePath("/citas");
    return { ok: true };
  });
}
