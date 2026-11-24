"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms";
import { CustomerVehiclePicker, type CustomerOption, type VehicleOption } from "@/components/pickers";
import { btn } from "@/components/ui";
import { formatHNL, formatNumber } from "@/lib/format";
import { createWorkOrder } from "../actions";

export function OrderCreateForm({
  customers,
  vehicles,
  technicians,
  services,
  taxRate,
  taxLabel,
  defaultCustomerId,
  defaultVehicleId,
  nowLocal,
}: {
  customers: CustomerOption[];
  vehicles: VehicleOption[];
  technicians: { value: string; label: string }[];
  services: { id: string; name: string; price: number }[];
  taxRate: number;
  taxLabel: string;
  defaultCustomerId?: string;
  defaultVehicleId?: string;
  nowLocal: string;
}) {
  const [vehicle, setVehicle] = useState<VehicleOption | undefined>(vehicles.find((v) => v.id === defaultVehicleId));

  return (
    <ActionForm action={createWorkOrder} className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Cliente y vehículo</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <CustomerVehiclePicker
            customers={customers}
            vehicles={vehicles}
            defaultCustomerId={defaultCustomerId}
            defaultVehicleId={defaultVehicleId}
            onVehicleChange={setVehicle}
          />
          <TextField
            name="mileage_in"
            label="Kilometraje de entrada"
            type="number"
            min={0}
            inputMode="numeric"
            hint={vehicle?.mileage != null ? `Último registrado: ${formatNumber(vehicle.mileage)} km` : undefined}
          />
          <TextField name="received_at" label="Fecha y hora de entrada" type="datetime-local" defaultValue={nowLocal} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Trabajo solicitado</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextAreaField
            name="reported_problem"
            label="Problema reportado por el cliente"
            required
            rows={3}
            wrapperClassName="sm:col-span-2"
          />
          <SelectField name="technician_id" label="Técnico responsable" placeholder="— Sin asignar —" options={technicians} />
          <TextField name="promised_at" label="Entrega estimada" type="datetime-local" />
        </div>
        {services.length > 0 && (
          <fieldset className="mt-4">
            <legend className="mb-2 text-xs font-medium text-slate-700">Servicios solicitados (del catálogo)</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50"
                >
                  <span className="flex items-center gap-2">
                    <input type="checkbox" name="service_ids" value={s.id} className="h-4 w-4 rounded border-slate-300" />
                    {s.name}
                  </span>
                  <span className="tabular text-xs text-slate-500">{formatHNL(s.price)}</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Repuestos y mano de obra se agregan en el detalle de la orden.</p>
          </fieldset>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Condiciones</h3>
        <div className="grid gap-4 sm:grid-cols-4">
          <SelectField
            name="discount_type"
            label="Tipo de descuento"
            defaultValue="monto"
            options={[
              { value: "monto", label: "Monto (L)" },
              { value: "porcentaje", label: "Porcentaje (%)" },
            ]}
          />
          <TextField name="discount_value" label="Descuento" inputMode="decimal" defaultValue="0" />
          <TextField name="tax_rate" label={`${taxLabel} (%)`} inputMode="decimal" defaultValue={String(taxRate)} />
          <TextAreaField name="notes" label="Observaciones internas" rows={1} wrapperClassName="sm:col-span-4" />
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Link href="/ordenes" className={btn.secondary}>
          Cancelar
        </Link>
        <SubmitButton pendingText="Creando…">Crear orden</SubmitButton>
      </div>
    </ActionForm>
  );
}
