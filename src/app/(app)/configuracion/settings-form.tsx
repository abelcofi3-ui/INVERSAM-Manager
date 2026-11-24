"use client";

import { ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/forms";
import type { BusinessSettingsValues } from "./types";
import { saveSettings } from "./actions";

export function SettingsForm({ values }: { values: BusinessSettingsValues }) {
  return (
    <ActionForm action={saveSettings} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="business_name" label="Nombre comercial" required defaultValue={values.business_name} />
        <TextField name="legal_name" label="Razón social" defaultValue={values.legal_name ?? ""} />
        <TextField name="rtn" label="RTN" defaultValue={values.rtn ?? ""} />
        <TextField name="phone" label="Teléfono" defaultValue={values.phone ?? ""} />
        <TextField name="email" label="Correo" type="email" defaultValue={values.email ?? ""} />
        <TextField name="address" label="Dirección" defaultValue={values.address ?? ""} />
        <TextField name="tax_label" label="Nombre del impuesto" required defaultValue={values.tax_label} hint="Ej. ISV" />
        <TextField name="tax_rate" label="Tasa de impuesto (%)" inputMode="decimal" required defaultValue={String(values.tax_rate)} />
        <TextField
          name="quote_validity_days"
          label="Vigencia de cotizaciones (días)"
          type="number"
          min={1}
          max={365}
          required
          defaultValue={String(values.quote_validity_days)}
        />
        <TextAreaField
          name="document_footer"
          label="Pie de página de documentos PDF"
          rows={2}
          defaultValue={values.document_footer ?? ""}
          wrapperClassName="sm:col-span-2"
          hint="Ej. condiciones de garantía o datos de contacto"
        />
      </div>
      <div className="flex justify-end">
        <SubmitButton>Guardar configuración</SubmitButton>
      </div>
    </ActionForm>
  );
}
