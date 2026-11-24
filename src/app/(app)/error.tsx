"use client";

import { useEffect } from "react";
import { btn } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">Ocurrió un error</h1>
      <p className="mt-2 text-sm text-slate-600">
        No se pudo cargar esta sección. Verifique su conexión e intente de nuevo. Si el problema continúa, informe al administrador
        {error.digest ? ` (código ${error.digest})` : ""}.
      </p>
      <button type="button" onClick={reset} className={`${btn.primary} mt-6`}>
        Reintentar
      </button>
    </div>
  );
}
