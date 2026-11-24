"use client";

import { useState } from "react";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/forms";
import { btn, cx } from "@/components/ui";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { saveExpense } from "../caja/actions";

export interface ExpenseValues {
  id?: string;
  expense_date?: string;
  category?: string;
  description?: string;
  amount?: string | number;
  method?: string;
  reference?: string | null;
}

export function ExpenseForm({ values, today, onDone }: { values?: ExpenseValues; today: string; onDone?: () => void }) {
  const [key, setKey] = useState(0);
  return (
    <ActionForm
      key={key}
      action={saveExpense}
      onSuccess={() => {
        if (onDone) onDone();
        else setKey((k) => k + 1);
      }}
      className="space-y-4"
    >
      {values?.id && <input type="hidden" name="id" value={values.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <TextField name="expense_date" label="Fecha" type="date" max={today} required defaultValue={values?.expense_date ?? today} />
        <TextField name="category" label="Categoría" list="expense-categories" required defaultValue={values?.category ?? ""} />
        <TextField name="description" label="Descripción" required defaultValue={values?.description ?? ""} wrapperClassName="lg:col-span-2" />
        <TextField name="amount" label="Monto (L)" inputMode="decimal" required defaultValue={values?.amount != null ? String(values.amount) : ""} />
        <SelectField
          name="method"
          label="Pagado con"
          defaultValue={values?.method ?? "efectivo"}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
        />
        <TextField name="reference" label="Factura / referencia" defaultValue={values?.reference ?? ""} wrapperClassName="lg:col-span-2" />
      </div>
      <datalist id="expense-categories">
        {EXPENSE_CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="flex justify-end gap-2">
        {onDone && (
          <button type="button" className={btn.secondary} onClick={onDone}>
            Cancelar
          </button>
        )}
        <SubmitButton>{values?.id ? "Guardar cambios" : "Registrar gasto"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EditExpenseToggle({ values, today }: { values: ExpenseValues; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={cx(btn.ghost, btn.sm)} onClick={() => setOpen(true)}>
        Editar
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-20">
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true">
            <h3 className="mb-4 text-base font-semibold">Editar gasto</h3>
            <ExpenseForm values={values} today={today} onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
