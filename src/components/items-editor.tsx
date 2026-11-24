"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ActionButton, ActionForm, SubmitButton, useFieldError } from "@/components/forms";
import { EmptyState, TableWrap, cx, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { formatHNL } from "@/lib/format";
import { ITEM_TYPES, ITEM_TYPE_LABELS, type ItemType } from "@/lib/labels";
import { lineTotal } from "@/lib/totals";

export interface ItemRow {
  id: string;
  item_type: ItemType;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  line_total: number | string;
}

export interface ServiceOption {
  id: string;
  name: string;
  price: number;
}

type Action = (s: ActionState, fd: FormData) => Promise<ActionState>;

function Err({ name }: { name: string }) {
  const e = useFieldError(name);
  return e ? <p className="mt-1 text-xs text-red-600">{e}</p> : null;
}

function AddItemFields({ services }: { services: ServiceOption[] }) {
  const [type, setType] = useState<ItemType>("servicio");
  const [serviceId, setServiceId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const preview = lineTotal({ quantity: Number(quantity) || 0, unit_price: Number(price.replace(/,/g, "")) || 0 });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
      <div className="lg:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="item_type">Tipo</label>
        <select
          id="item_type"
          name="item_type"
          className={inputClass}
          value={type}
          onChange={(e) => {
            setType(e.target.value as ItemType);
            setServiceId("");
          }}
        >
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>
              {ITEM_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      {type === "servicio" && (
        <div className="lg:col-span-3">
          <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="service_id">Del catálogo</label>
          <select
            id="service_id"
            name="service_id"
            className={inputClass}
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              const s = services.find((x) => x.id === e.target.value);
              if (s) {
                setDescription(s.name);
                setPrice(String(s.price));
              }
            }}
          >
            <option value="">— Servicio libre —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({formatHNL(s.price)})
              </option>
            ))}
          </select>
        </div>
      )}
      <div className={type === "servicio" ? "lg:col-span-3" : "lg:col-span-6"}>
        <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="description">
          Descripción <span className="text-red-500">*</span>
        </label>
        <input
          id="description"
          name="description"
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type === "repuesto" ? "Ej. Filtro de aceite" : type === "mano_obra" ? "Ej. Mano de obra" : ""}
        />
        <Err name="description" />
      </div>
      <div className="lg:col-span-1">
        <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="quantity">Cant.</label>
        <input id="quantity" name="quantity" inputMode="decimal" className={inputClass} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <Err name="quantity" />
      </div>
      <div className="lg:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="unit_price">Precio unit. (L)</label>
        <input id="unit_price" name="unit_price" inputMode="decimal" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
        <Err name="unit_price" />
      </div>
      <div className="flex items-end justify-between gap-3 sm:col-span-2 lg:col-span-1 lg:flex-col lg:items-stretch lg:justify-end">
        <p className="tabular text-right text-xs text-slate-500 lg:hidden">Importe: {formatHNL(preview)}</p>
        <SubmitButton pendingText="…">Agregar</SubmitButton>
      </div>
    </div>
  );
}

export function ItemsEditor({
  items,
  services,
  addAction,
  deleteAction,
  deleteFields,
  editable,
  lockedMessage,
}: {
  items: ItemRow[];
  services: ServiceOption[];
  addAction: Action;
  deleteAction: Action;
  deleteFields: (item: ItemRow) => Record<string, string>;
  editable: boolean;
  lockedMessage?: string;
}) {
  const [formKey, setFormKey] = useState(0);
  return (
    <div>
      {items.length === 0 ? (
        <EmptyState title="Sin partidas" description="Agregue servicios, repuestos y mano de obra." />
      ) : (
        <TableWrap>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Descripción</th>
                <th className="num">Cant.</th>
                <th className="num">Precio unit.</th>
                <th className="num">Importe</th>
                {editable && <th />}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="whitespace-nowrap text-xs text-slate-500">{ITEM_TYPE_LABELS[it.item_type]}</td>
                  <td>{it.description}</td>
                  <td className="num">{Number(it.quantity)}</td>
                  <td className="num">{formatHNL(it.unit_price)}</td>
                  <td className="num font-medium">{formatHNL(it.line_total)}</td>
                  {editable && (
                    <td className="w-10 text-right">
                      <ActionButton
                        action={deleteAction}
                        fields={deleteFields(it)}
                        variant="ghost"
                        className="px-2 py-1 text-red-600"
                        confirm={`¿Quitar "${it.description}"?`}
                        pendingText="…"
                      >
                        <Trash2 className="h-4 w-4" aria-label="Quitar partida" />
                      </ActionButton>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      {editable ? (
        <div className={cx("border-t border-slate-100 bg-slate-50/60 p-4")}>
          <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Agregar partida</p>
          <ActionForm key={formKey} action={addAction} onSuccess={() => setFormKey((k) => k + 1)}>
            <AddItemFields services={services} />
          </ActionForm>
        </div>
      ) : (
        lockedMessage && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{lockedMessage}</p>
      )}
    </div>
  );
}
