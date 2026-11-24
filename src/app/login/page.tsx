import type { Metadata } from "next";
import { BrandWordmark } from "@/components/brand";
import { ActionForm, SubmitButton, TextField } from "@/components/forms";
import { Alert } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/env";
import { signIn, signOut } from "./actions";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const configured = isSupabaseConfigured();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,102,245,0.35),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <BrandWordmark />
          <div>
            <h2 className="max-w-md text-3xl leading-tight font-semibold">
              Control total del taller: órdenes, caja, clientes y reportes en un solo lugar.
            </h2>
            <p className="mt-4 max-w-md text-brand-200">Mecánica rápida · Santa Bárbara, Honduras</p>
          </div>
          <p className="text-xs text-brand-300">© {new Date().getFullYear()} INVERSAM</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandWordmark dark />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-slate-500">Ingrese con el usuario asignado por el administrador.</p>

          <div className="mt-6 space-y-3">
            {!configured && (
              <Alert tone="red">
                Falta configurar Supabase. Copie <code>.env.example</code> a <code>.env.local</code> y complete las
                variables. Consulte el README.
              </Alert>
            )}
            {sp.inactivo && (
              <Alert tone="amber">
                Su usuario está inactivo o no tiene perfil asignado. Solicite acceso al administrador.
                <form action={signOut} className="mt-2">
                  <button type="submit" className="text-sm font-medium underline">
                    Cerrar sesión
                  </button>
                </form>
              </Alert>
            )}
          </div>

          <ActionForm action={signIn} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next} />
            <TextField name="email" label="Correo electrónico" type="email" autoComplete="email" required autoFocus />
            <TextField name="password" label="Contraseña" type="password" autoComplete="current-password" required />
            <SubmitButton className="w-full" pendingText="Ingresando…">
              Ingresar
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
