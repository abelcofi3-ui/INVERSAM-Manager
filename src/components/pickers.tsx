"use client";

import { useMemo, useState } from "react";
import { inputClass } from "@/components/ui";
import { useFieldError } from "@/components/forms";

export interface CustomerOption {
  id: string;
  full_name: string;
  phone: string | null;
}
export interface VehicleOption {
  id: string;
  customer_id: string;
  label: string;
  mileage: number | null;
}

function FieldError({ name }: { name: string }) {
  const e = useFieldError(name);
  return e ? <p className="mt-1 text-xs text-red-600">{e}</p> : null;
}

/** Selector de cliente con búsqueda y, opcionalmente, de vehículo filtrado por ese cliente. */
export function CustomerVehiclePicker({
  customers,
  vehicles,
  defaultCustomerId,
  defaultVehicleId,
  withVehicle = true,
  vehicleRequired = true,
  onVehicleChange,
}: {
  customers: CustomerOption[];
  vehicles?: VehicleOption[];
  defaultCustomerId?: string;
  defaultVehicleId?: string;
  withVehicle?: boolean;
  vehicleRequired?: boolean;
  onVehicleChange?: (v: VehicleOption | undefined) => void;
}) {
  const [filter, setFilter] = useState("");
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [vehicleId, setVehicleId] = useState(defaultVehicleId ?? "");

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = f
      ? customers.filter((c) => c.full_name.toLowerCase().includes(f) || (c.phone ?? "").includes(f))
      : customers;
    // Mantener visible el cliente seleccionado aunque no coincida con el filtro
    if (customerId && !list.some((c) => c.id === customerId)) {
      const sel = customers.find((c) => c.id === customerId);
      if (sel) return [sel, ...list];
    }
    return list;
  }, [customers, filter, customerId]);

  const customerVehicles = useMemo(
    () => (vehicles ?? []).filter((v) => v.customer_id === customerId),
    [vehicles, customerId],
  );

  return (
    <>
      <div className="sm:col-span-2">
        <label htmlFor="customer_id" className="mb-1 block text-xs font-medium text-slate-700">
          Cliente <span className="text-red-500">*</span>
        </label>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
          <input
            type="search"
            placeholder="Filtrar por nombre o teléfono"
            className={inputClass}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filtrar clientes"
          />
          <select
            id="customer_id"
            name="customer_id"
            className={inputClass}
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              const first = (vehicles ?? []).filter((v) => v.customer_id === e.target.value);
              const next = first.length === 1 ? first[0].id : "";
              setVehicleId(next);
              onVehicleChange?.(first.length === 1 ? first[0] : undefined);
            }}
          >
            <option value="">— Seleccione un cliente ({filtered.length}) —</option>
            {filtered.slice(0, 500).map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
                {c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
          </select>
        </div>
        <FieldError name="customer_id" />
      </div>
      {withVehicle && (
        <div className="sm:col-span-2">
          <label htmlFor="vehicle_id" className="mb-1 block text-xs font-medium text-slate-700">
            Vehículo {vehicleRequired && <span className="text-red-500">*</span>}
          </label>
          <select
            id="vehicle_id"
            name="vehicle_id"
            className={inputClass}
            value={vehicleId}
            disabled={!customerId}
            onChange={(e) => {
              setVehicleId(e.target.value);
              onVehicleChange?.(customerVehicles.find((v) => v.id === e.target.value));
            }}
          >
            <option value="">
              {!customerId
                ? "Seleccione primero el cliente"
                : customerVehicles.length
                  ? "— Seleccione el vehículo —"
                  : "El cliente no tiene vehículos registrados"}
            </option>
            {customerVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          {customerId && customerVehicles.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              <a className="text-brand-700 underline" href={`/vehiculos/nuevo?cliente=${customerId}`}>
                Registrar un vehículo
              </a>{" "}
              para este cliente.
            </p>
          )}
          <FieldError name="vehicle_id" />
        </div>
      )}
    </>
  );
}
