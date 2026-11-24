"use client";

import Link from "next/link";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms";
import { CustomerVehiclePicker, type CustomerOption } from "@/components/pickers";
import { btn } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { VEHICLE_TYPES, VEHICLE_TYPE_LABELS } from "@/lib/labels";

export interface VehicleValues {
  customer_id?: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  plate?: string | null;
  vin?: string | null;
  color?: string | null;
  vehicle_type?: string | null;
  mileage?: number | null;
  notes?: string | null;
}

export function VehicleForm({
  action,
  customers,
  values = {},
  cancelHref,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  customers: CustomerOption[];
  values?: VehicleValues;
  cancelHref: string;
}) {
  return (
    <ActionForm action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <CustomerVehiclePicker customers={customers} defaultCustomerId={values.customer_id} withVehicle={false} />
        <TextField name="brand" label="Marca" required placeholder="Toyota" defaultValue={values.brand ?? ""} />
        <TextField name="model" label="Modelo" required placeholder="Hilux" defaultValue={values.model ?? ""} />
        <TextField name="year" label="Año" type="number" inputMode="numeric" min={1950} defaultValue={values.year ?? ""} />
        <SelectField
          name="vehicle_type"
          label="Tipo de vehículo"
          required
          defaultValue={values.vehicle_type ?? "sedan"}
          options={VEHICLE_TYPES.map((t) => ({ value: t, label: VEHICLE_TYPE_LABELS[t] }))}
        />
        <TextField name="plate" label="Placa" placeholder="HAA1234" defaultValue={values.plate ?? ""} className="uppercase" />
        <TextField name="vin" label="VIN" hint="17 caracteres (opcional)" defaultValue={values.vin ?? ""} className="uppercase" />
        <TextField name="color" label="Color" defaultValue={values.color ?? ""} />
        <TextField
          name="mileage"
          label="Kilometraje actual"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={values.mileage ?? ""}
        />
        <TextAreaField name="notes" label="Notas" defaultValue={values.notes ?? ""} wrapperClassName="sm:col-span-2" />
      </div>
      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className={btn.secondary}>
          Cancelar
        </Link>
        <SubmitButton>Guardar vehículo</SubmitButton>
      </div>
    </ActionForm>
  );
}
