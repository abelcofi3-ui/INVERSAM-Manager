"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms";
import { CustomerVehiclePicker, type CustomerOption, type VehicleOption } from "@/components/pickers";
import { btn, cx } from "@/components/ui";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/labels";
import { convertQuoteToOrder, createQuote, setQuoteStatus, updateQuote } from "./actions";

const discountOptions = [
  { value: "monto", label: "Monto (L)" },
  { value: "porcentaje", label: "Porcentaje (%)" },
];

export function QuoteCreateForm({
  customers,
  vehicles,
  taxRate,
  taxLabel,
  validUntil,
  defaultCustomerId,
}: {
  customers: CustomerOption[];
  vehicles: VehicleOption[];
  taxRate: number;
  taxLabel: string;
  validUntil: string;
  defaultCustomerId?: string;
}) {
  return (
    <ActionForm action={createQuote} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <CustomerVehiclePicker customers={customers} vehicles={vehicles} defaultCustomerId={defaultCustomerId} vehicleRequired={false} />
        <TextField name="valid_until" label="Válida hasta" type="date" defaultValue={validUntil} />
        <div className="grid grid-cols-3 gap-2">
          <SelectField name="discount_type" label="Descuento" defaultValue="monto" options={discountOptions} />
          <TextField name="discount_value" label="Valor" inputMode="decimal" defaultValue="0" />
          <TextField name="tax_rate" label={`${taxLabel} %`} inputMode="decimal" defaultValue={String(taxRate)} />
        </div>
        <TextAreaField name="notes" label="Observaciones para el cliente" wrapperClassName="sm:col-span-2" />
      </div>
      <p className="text-xs text-slate-500">Después de crearla podrá agregar servicios y repuestos.</p>
      <div className="flex justify-end gap-2">
        <Link href="/cotizaciones" className={btn.secondary}>
          Cancelar
        </Link>
        <SubmitButton>Crear cotización</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function QuoteEditForm({
  id,
  vehicles,
  values,
  taxLabel,
}: {
  id: string;
  vehicles: { value: string; label: string }[];
  values: { vehicle_id: string | null; valid_until: string | null; notes: string | null; discount_type: string; discount_value: number; tax_rate: number };
  taxLabel: string;
}) {
  return (
    <ActionForm action={updateQuote.bind(null, id)} className="space-y-3">
      <SelectField name="vehicle_id" label="Vehículo" placeholder="— Sin vehículo —" defaultValue={values.vehicle_id ?? ""} options={vehicles} />
      <TextField name="valid_until" label="Válida hasta" type="date" defaultValue={values.valid_until ?? ""} />
      <div className="grid grid-cols-3 gap-2">
        <SelectField name="discount_type" label="Descuento" defaultValue={values.discount_type} options={[{ value: "monto", label: "L" }, { value: "porcentaje", label: "%" }]} />
        <TextField name="discount_value" label="Valor" inputMode="decimal" defaultValue={String(values.discount_value)} />
        <TextField name="tax_rate" label={`${taxLabel} %`} inputMode="decimal" defaultValue={String(values.tax_rate)} />
      </div>
      <TextAreaField name="notes" label="Observaciones" rows={2} defaultValue={values.notes ?? ""} />
      <div className="flex justify-end">
        <SubmitButton variant="secondary">Guardar</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function QuoteDecision({ id, status }: { id: string; status: QuoteStatus }) {
  const [notes, setNotes] = useState("");
  const action = setQuoteStatus.bind(null, id);
  const choices: { status: QuoteStatus; label: string; variant: "primary" | "secondary" | "danger" }[] =
    status === "borrador"
      ? [
          { status: "enviada", label: "Marcar como enviada", variant: "secondary" },
          { status: "aprobada", label: "Registrar aprobación", variant: "primary" },
          { status: "rechazada", label: "Registrar rechazo", variant: "danger" },
        ]
      : status === "enviada"
        ? [
            { status: "aprobada", label: "Registrar aprobación", variant: "primary" },
            { status: "rechazada", label: "Registrar rechazo", variant: "danger" },
            { status: "borrador", label: "Volver a borrador", variant: "secondary" },
          ]
        : [{ status: "enviada", label: "Reabrir (enviada)", variant: "secondary" }];

  return (
    <ActionForm action={action} className="space-y-3">
      {status !== "aprobada" && status !== "rechazada" && (
        <TextAreaField
          name="decision_notes"
          label="Notas de la decisión (opcional)"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej. Aprobado por teléfono por el cliente"
        />
      )}
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <SubmitButton
            key={c.status}
            name="status"
            value={c.status}
            variant={c.variant}
            pendingText="…"
            confirm={c.status === "rechazada" ? "¿Registrar el rechazo de la cotización?" : undefined}
          >
            {c.label}
          </SubmitButton>
        ))}
      </div>
      <p className="text-xs text-slate-500">Estado actual: {QUOTE_STATUS_LABELS[status]}</p>
    </ActionForm>
  );
}

export function ConvertQuoteForm({
  id,
  technicians,
  defaultProblem,
}: {
  id: string;
  technicians: { value: string; label: string }[];
  defaultProblem: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className={cx(btn.primary, "w-full")} onClick={() => setOpen(true)}>
        Convertir en orden de trabajo
      </button>
    );
  return (
    <ActionForm action={convertQuoteToOrder.bind(null, id)} className="space-y-3">
      <TextAreaField name="reported_problem" label="Trabajo a realizar" required defaultValue={defaultProblem} rows={2} />
      <TextField name="mileage_in" label="Kilometraje de entrada" type="number" min={0} />
      <SelectField name="technician_id" label="Técnico" placeholder="— Sin asignar —" options={technicians} />
      <div className="flex justify-end gap-2">
        <button type="button" className={btn.secondary} onClick={() => setOpen(false)}>
          Cancelar
        </button>
        <SubmitButton pendingText="Creando orden…">Crear orden</SubmitButton>
      </div>
    </ActionForm>
  );
}
