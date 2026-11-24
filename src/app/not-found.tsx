import Link from "next/link";
import { btn } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-brand-700">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Registro no encontrado</h1>
        <p className="mt-2 text-sm text-slate-500">El elemento no existe o fue eliminado.</p>
        <Link href="/" className={`${btn.primary} mt-6`}>
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
