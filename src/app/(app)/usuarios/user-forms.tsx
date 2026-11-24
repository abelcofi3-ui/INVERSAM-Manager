"use client";

import { useState } from "react";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextField } from "@/components/forms";
import { btn, cx } from "@/components/ui";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { createUser, resetPassword, updateUser } from "./actions";

const roleOptions = (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }));

export function CreateUserForm() {
  return (
    <ActionForm action={createUser} resetOnSuccess className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <TextField name="full_name" label="Nombre completo" required />
        <TextField name="email" label="Correo" type="email" required autoComplete="off" />
        <TextField name="password" label="Contraseña inicial" type="password" required autoComplete="new-password" hint="Mínimo 8 caracteres" />
        <SelectField name="role" label="Rol" required defaultValue="recepcionista" options={roleOptions} />
        <TextField name="phone" label="Teléfono" type="tel" />
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingText="Creando…">Crear usuario</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EditUserButton({
  user,
}: {
  user: { id: string; full_name: string; role: Role; phone: string | null; active: boolean; email: string | null };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={cx(btn.ghost, btn.sm)} onClick={() => setOpen(true)}>
        Editar
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-16">
          <div className="w-full max-w-xl space-y-6 rounded-xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true">
            <div>
              <h3 className="text-base font-semibold">Editar usuario</h3>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <ActionForm action={updateUser} onSuccess={() => setOpen(false)} className="space-y-4">
              <input type="hidden" name="id" value={user.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField name="full_name" label="Nombre completo" required defaultValue={user.full_name} wrapperClassName="sm:col-span-2" />
                <SelectField name="role" label="Rol" defaultValue={user.role} options={roleOptions} />
                <TextField name="phone" label="Teléfono" defaultValue={user.phone ?? ""} />
                <CheckboxField name="active" label="Usuario activo (puede iniciar sesión)" defaultChecked={user.active} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className={btn.secondary} onClick={() => setOpen(false)}>
                  Cerrar
                </button>
                <SubmitButton>Guardar</SubmitButton>
              </div>
            </ActionForm>
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-medium">Restablecer contraseña</p>
              <ActionForm action={resetPassword} resetOnSuccess className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={user.id} />
                <TextField name="password" label="Nueva contraseña" type="password" autoComplete="new-password" wrapperClassName="flex-1" />
                <SubmitButton variant="secondary">Cambiar</SubmitButton>
              </ActionForm>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
