"use client";

import { useState } from "react";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms";
import { CustomerVehiclePicker, type CustomerOption, type VehicleOption } from "@/components/pickers";
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/lib/labels";
import { createAppointment, setAppointmentStatus } from "./actions";

export function AppointmentForm({
  customers,
  vehicles,
  services,
  defaultDateTime,
}: {
  customers: CustomerOption[];
  vehicles: VehicleOption[];
  services: { id: string; name: string; estimated_minutes: number | null }[];
  defaultDateTime: string;
}) {
  const [key, setKey] = useState(0);
  const [duration, setDuration] = useState("60");
  return (
    <ActionForm key={key} action={createAppointment} onSuccess={() => setKey((k) => k + 1)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <CustomerVehiclePicker customers={customers} vehicles={vehicles} vehicleRequired={false} />
        <SelectField
          name="service_id"
          label="Servicio"
          placeholder="— General —"
          options={services.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(e) => {
            const s = services.find((x) => x.id === e.target.value);
            if (s?.estimated_minutes) setDuration(String(Math.min(600, Math.max(10, s.estimated_minutes))));
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <TextField name="scheduled_at" label="Fecha y hora" type="datetime-local" required defaultValue={defaultDateTime} />
          <TextField name="duration_minutes" label="Duración (min)" type="number" min={10} max={600} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <TextAreaField name="notes" label="Notas" rows={2} wrapperClassName="sm:col-span-2" />
      </div>
      <div className="flex justify-end">
        <SubmitButton>Programar cita</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AppointmentStatusSelect({ id, status }: { id: string; status: AppointmentStatus }) {
  return (
    <ActionForm action={setAppointmentStatus.bind(null, id)} className="flex items-center gap-1" showMessages={false}>
      <select
        name="status"
        defaultValue={status}
        aria-label="Estado de la cita"
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {APPOINTMENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {APPOINTMENT_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </ActionForm>
  );
}
