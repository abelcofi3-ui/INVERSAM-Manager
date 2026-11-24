"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { btn } from "@/components/ui";
import { downloadDocumentPdf, type DocumentPdfData } from "@/lib/pdf";

export function DocumentPdfButton({ data, label = "Descargar PDF" }: { data: DocumentPdfData; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        className={btn.secondary}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await downloadDocumentPdf(data);
          } catch (e) {
            console.error(e);
            setError("No se pudo generar el PDF.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <FileDown className="h-4 w-4" /> {busy ? "Generando…" : label}
      </button>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}
