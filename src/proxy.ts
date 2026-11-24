import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /instalar es pública para poder compartir el enlace de instalación con el personal
const PUBLIC_PATHS = ["/login", "/instalar"];

/** Refresca la sesión de Supabase en cada solicitud y protege las rutas privadas. */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!url || !anonKey) {
    // Sin configuración: mostrar la pantalla de login, que explica qué falta.
    return isPublic ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(loginUrl);
  }
  // ?inactivo=1: sesión válida pero usuario desactivado/sin perfil → mostrar aviso (evita bucles)
  if (signedIn && pathname === "/login" && !request.nextUrl.searchParams.has("inactivo")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  // Excluye archivos estáticos y de la app instalable (manifiesto, service worker, íconos,
  // verificación de Android y descargas), que deben servirse sin sesión.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|descargas/|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|apk)$).*)",
  ],
};
