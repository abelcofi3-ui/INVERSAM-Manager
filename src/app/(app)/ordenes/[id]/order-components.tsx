"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms";
import { btn, cx, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/client";
import { WORK_ORDER_STATUSES, WORK_ORDER_STATUS_LABELS, type WorkOrderStatus } from "@/lib/labels";
import { changeWorkOrderStatus, deleteWorkOrderPhoto, registerWorkOrderPhoto, updateWorkOrder, updateWorkOrderPricing } from "../actions";
import { voidPayment } from "@/app/(app)/caja/actions";

export function StatusControl({ id, status, allowDeliver }: { id: string; status: WorkOrderStatus; allowDeliver: boolean }) {
  const action = changeWorkOrderStatus.bind(null, id);
  const options = WORK_ORDER_STATUSES.filter((s) => allowDeliver || s !== "entregado").map((s) => ({
    value: s,
    label: WORK_ORDER_STATUS_LABELS[s],
  }));
  return (
    <ActionForm action={action} className="flex flex-wrap items-end gap-2">
      <SelectField name="status" label="Cambiar estado" defaultValue={status} options={options} wrapperClassName="min-w-52" />
      <SubmitButton variant="secondary" pendingText="…">
        Actualizar
      </SubmitButton>
    </ActionForm>
  );
}

export function OrderInfoForm({
  id,
  values,
  technicians,
}: {
  id: string;
  values: {
    mileage_in: number | null;
    reported_problem: string;
    diagnosis: string | null;
    technician_id: string | null;
    promised_at: string;
    notes: string | null;
  };
  technicians: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className={cx(btn.secondary, btn.sm)} onClick={() => setOpen(true)}>
        Editar diagnóstico y datos
      </button>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-16">
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true">
        <h3 className="mb-4 text-base font-semibold">Editar orden</h3>
        <ActionForm action={updateWorkOrder.bind(null, id)} onSuccess={() => setOpen(false)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextAreaField name="reported_problem" label="Problema reportado" required defaultValue={values.reported_problem} wrapperClassName="sm:col-span-2" />
            <TextAreaField name="diagnosis" label="Diagnóstico técnico" rows={4} defaultValue={values.diagnosis ?? ""} wrapperClassName="sm:col-span-2" />
            <TextField name="mileage_in" label="Kilometraje de entrada" type="number" min={0} defaultValue={values.mileage_in ?? ""} />
            <SelectField
              name="technician_id"
              label="Técnico responsable"
              placeholder="— Sin asignar —"
              defaultValue={values.technician_id ?? ""}
              options={technicians}
            />
            <TextField name="promised_at" label="Entrega estimada" type="datetime-local" defaultValue={values.promised_at} />
            <TextAreaField name="notes" label="Observaciones" rows={2} defaultValue={values.notes ?? ""} wrapperClassName="sm:col-span-2" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={btn.secondary} onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <SubmitButton>Guardar</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}

export function PricingForm({
  id,
  discountType,
  discountValue,
  taxRate,
  taxLabel,
}: {
  id: string;
  discountType: string;
  discountValue: number;
  taxRate: number;
  taxLabel: string;
}) {
  return (
    <ActionForm action={updateWorkOrderPricing.bind(null, id)} className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <SelectField
          name="discount_type"
          label="Descuento"
          defaultValue={discountType}
          options={[
            { value: "monto", label: "L" },
            { value: "porcentaje", label: "%" },
          ]}
        />
        <TextField name="discount_value" label="Valor" inputMode="decimal" defaultValue={String(discountValue)} />
        <TextField name="tax_rate" label={`${taxLabel} %`} inputMode="decimal" defaultValue={String(taxRate)} />
      </div>
      <div className="flex justify-end">
        <SubmitButton variant="secondary" pendingText="…">
          Aplicar
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function VoidPaymentButton({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className={cx(btn.dangerGhost, btn.sm)} onClick={() => setOpen(true)}>
        Anular
      </button>
    );
  return (
    <ActionForm action={voidPayment} onSuccess={() => setOpen(false)} className="flex flex-wrap items-start gap-2">
      <input type="hidden" name="id" value={paymentId} />
      <TextField name="void_reason" label="Motivo de anulación" required wrapperClassName="min-w-48" />
      <div className="flex gap-1 pt-5">
        <SubmitButton variant="danger" className={btn.sm} pendingText="…">
          Confirmar
        </SubmitButton>
        <button type="button" className={cx(btn.ghost, btn.sm)} onClick={() => setOpen(false)}>
          No
        </button>
      </div>
    </ActionForm>
  );
}

/** Reduce fotos de teléfono (varios MB) a ~1600px JPEG antes de subirlas. */
async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/heic") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function PhotoUploader({ orderId }: { orderId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) throw new Error(`"${file.name}" supera 20 MB.`);
        const blob = await compressImage(file);
        if (blob.size > 8 * 1024 * 1024) throw new Error(`"${file.name}" supera 8 MB después de comprimir.`);
        const isJpeg = blob.type === "image/jpeg";
        const ext = isJpeg ? "jpg" : (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${orderId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("work-order-photos")
          .upload(path, blob, { contentType: blob.type || file.type, upsert: false });
        if (upErr) throw new Error(upErr.message.includes("mime") ? "Formato de imagen no permitido." : "No se pudo subir la foto.");
        const res: ActionState = await registerWorkOrderPhoto(orderId, path, caption.trim() || null);
        if (res?.error) throw new Error(res.error);
      }
      setCaption("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir la foto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1">
        <label htmlFor="caption" className="mb-1 block text-xs font-medium text-slate-700">Descripción (opcional)</label>
        <input id="caption" className={inputClass} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Ej. Estado de llegada, pieza dañada…" />
      </div>
      <label className={cx(btn.primary, busy && "pointer-events-none opacity-60", "cursor-pointer")}>
        <Camera className="h-4 w-4" /> {busy ? "Subiendo…" : "Agregar fotos"}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          capture="environment"
          multiple
          className="sr-only"
          disabled={busy}
          onChange={(e) => upload(e.target.files)}
        />
      </label>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function DeletePhotoButton({ photoId }: { photoId: string }) {
  return (
    <ActionButton
      action={deleteWorkOrderPhoto}
      fields={{ photo_id: photoId }}
      variant="ghost"
      className="bg-white/90 px-2 py-1 text-red-600 shadow"
      confirm="¿Eliminar esta foto?"
      pendingText="…"
    >
      <Trash2 className="h-4 w-4" aria-label="Eliminar foto" />
    </ActionButton>
  );
}
