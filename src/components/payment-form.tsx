"use client";

import { useState } from "react";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/forms";
import { formatHNL } from "@/lib/format";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/labels";
import { registerPayment } from "@/app/(app)/caja/actions";

/** Registro de pago (total o parcial) para una orden de trabajo. */
export function PaymentForm({ workOrderId, balance }: { workOrderId: string; balance: number }) {
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [key, setKey] = useState(0);
  return (
    <ActionForm key={key} action={registerPayment} onSuccess={() => setKey((k) => k + 1)} className="space-y-3">
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          name="amount"
          label="Monto (L)"
          inputMode="decimal"
          required
          defaultValue={balance > 0 ? balance.toFixed(2) : ""}
          hint={`Saldo pendiente: ${formatHNL(balance)}`}
        />
        <SelectField
          name="method"
          label="Método"
          required
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
        />
        <TextField
          name="reference"
          label={method === "efectivo" ? "Referencia (opcional)" : "Referencia / No. autorización"}
          required={method !== "efectivo"}
        />
        <TextField name="notes" label="Nota" />
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingText="Registrando…">Registrar pago</SubmitButton>
      </div>
    </ActionForm>
  );
}
