"use client";

import Link from "next/link";
import { ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/forms";
import { btn } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export interface CustomerValues {
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  rtn?: string | null;
  notes?: string | null;
}

export function CustomerForm({
  action,
  values = {},
  cancelHref,
  next,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  values?: CustomerValues;
  cancelHref: string;
  next?: string;
}) {
  return (
    <ActionForm action={action} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="full_name" label="Nombre completo" required defaultValue={values.full_name ?? ""} wrapperClassName="sm:col-span-2" />
        <TextField name="phone" label="Teléfono" type="tel" placeholder="9999-9999" defaultValue={values.phone ?? ""} />
        <TextField name="email" label="Correo electrónico" type="email" defaultValue={values.email ?? ""} />
        <TextField name="rtn" label="RTN" placeholder="14 dígitos" hint="Opcional, para facturación" defaultValue={values.rtn ?? ""} />
        <TextField name="address" label="Dirección" defaultValue={values.address ?? ""} />
        <TextAreaField name="notes" label="Notas" defaultValue={values.notes ?? ""} wrapperClassName="sm:col-span-2" />
      </div>
      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className={btn.secondary}>
          Cancelar
        </Link>
        <SubmitButton>Guardar cliente</SubmitButton>
      </div>
    </ActionForm>
  );
}
