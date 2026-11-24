"use client";

import { useState } from "react";
import { ActionForm, CheckboxField, SubmitButton, TextField } from "@/components/forms";
import { btn, cx } from "@/components/ui";
import { saveService } from "./actions";

export interface ServiceValues {
  id?: string;
  name?: string;
  category?: string | null;
  description?: string | null;
  price?: number | string;
  estimated_minutes?: number | null;
  active?: boolean;
}

export function ServiceForm({ values, categories, onDone }: { values?: ServiceValues; categories: string[]; onDone?: () => void }) {
  return (
    <ActionForm action={saveService} resetOnSuccess={!values?.id} onSuccess={onDone} className="space-y-4">
      {values?.id && <input type="hidden" name="id" value={values.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <TextField name="name" label="Nombre" required defaultValue={values?.name ?? ""} wrapperClassName="lg:col-span-2" />
        <TextField name="category" label="Categoría" list="service-categories" defaultValue={values?.category ?? ""} />
        <TextField
          name="price"
          label="Precio (L)"
          inputMode="decimal"
          required
          defaultValue={values?.price != null ? String(values.price) : ""}
          placeholder="0.00"
        />
        <TextField
          name="estimated_minutes"
          label="Tiempo estimado (min)"
          type="number"
          min={1}
          defaultValue={values?.estimated_minutes ?? ""}
        />
        <div className="flex items-end pb-2">
          <CheckboxField name="active" label="Activo" defaultChecked={values?.active ?? true} />
        </div>
        <TextField name="description" label="Descripción" defaultValue={values?.description ?? ""} wrapperClassName="sm:col-span-2 lg:col-span-6" />
      </div>
      <datalist id="service-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="flex justify-end gap-2">
        {onDone && (
          <button type="button" className={btn.secondary} onClick={onDone}>
            Cancelar
          </button>
        )}
        <SubmitButton>{values?.id ? "Guardar cambios" : "Agregar servicio"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EditServiceToggle({ values, categories }: { values: ServiceValues; categories: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={cx(btn.ghost, btn.sm)} onClick={() => setOpen((o) => !o)}>
        {open ? "Cerrar" : "Editar"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-20">
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true">
            <h3 className="mb-4 text-base font-semibold">Editar servicio</h3>
            <ServiceForm values={values} categories={categories} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
