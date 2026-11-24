# INVERSAM Manager

Sistema web de gestión para el taller de mecánica rápida **INVERSAM** (Santa Bárbara, Honduras): clientes, vehículos, citas, órdenes de trabajo, cotizaciones, caja y pagos, gastos, catálogo de servicios, usuarios con permisos por rol y reportes exportables.

- Moneda **HNL (Lempiras)** · zona horaria **America/Tegucigalpa** · interfaz en **español**.
- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL + Auth + Storage) · Recharts · jsPDF · ExcelJS · Zod.

> El catálogo inicial de servicios trae solo **nombres de ejemplo con precio L 0.00**. No se incluyeron precios, tiempos ni datos comerciales inventados: configúrelos en **Servicios** antes de operar.

---

## 1. Módulos

| Módulo | Qué hace |
|---|---|
| **Dashboard** | Ingresos de hoy / semana / mes, órdenes abiertas, en reparación, completadas, por cobrar, citas del día, clientes nuevos, servicios más vendidos y gráficas de 30 días. Cada rol ve solo lo que le corresponde. |
| **Clientes** | Alta, edición, eliminación, búsqueda (nombre, teléfono, correo, RTN), vehículos asociados, historial de órdenes y cotizaciones, saldo. |
| **Vehículos** | Marca, modelo, año, placa y VIN (únicos), tipo, color, kilometraje, propietario e historial de mantenimiento. |
| **Órdenes de trabajo** | Número automático consecutivo **sin huecos** (`OT-000001`), cliente/vehículo, kilometraje de entrada, problema, diagnóstico, servicios, repuestos, mano de obra, técnico, fotografías, fechas de entrada/entrega estimada/finalizado/entregado, estados *Recibido → En diagnóstico → Esperando aprobación → En reparación → Finalizado → Entregado* con historial, descuento e impuesto, pagos y PDF. |
| **Cotizaciones** | `COT-000001`, partidas, descuento (monto o %), impuesto configurable, vigencia, PDF, registro de aprobación/rechazo y conversión a orden de trabajo. |
| **Caja y pagos** | Pagos en efectivo, transferencia y tarjeta; pagos parciales; saldos pendientes; anulación con motivo (no se editan ni borran pagos); cierre diario con fondo inicial, efectivo esperado vs. contado y diferencia; historial y PDF del cierre. |
| **Gastos** | Registro por categoría y método, filtros y totales; alimenta la rentabilidad y el cuadre de efectivo. |
| **Citas** | Agenda diaria y semanal, estados, y botón *Recibir* que abre una orden con el cliente/vehículo. |
| **Servicios** | Catálogo editable: nombre, categoría, precio, tiempo estimado, activo/inactivo. |
| **Usuarios** | Alta de cuentas, roles, activación/desactivación, cambio de contraseña. |
| **Reportes** | Ingresos, gastos, resultado, órdenes, facturación por tipo, servicios vendidos, clientes recurrentes; rangos predefinidos o personalizados; exportación a **Excel** y **PDF**. |
| **Configuración** | Datos del negocio (nombre, RTN, dirección…), impuesto (por defecto ISV 15 %), vigencia de cotizaciones, pie de PDF y **descarga de respaldo**. |

### Roles y permisos

Los permisos se aplican **dos veces**: en la interfaz/acciones de servidor (`src/lib/permissions.ts`) y en la base de datos con **Row Level Security** (`supabase/migrations/…_rls.sql`). Aunque alguien manipule la interfaz, PostgreSQL rechaza lo que su rol no permite.

| Rol | Puede |
|---|---|
| Administrador | Todo, incluidos usuarios, configuración, catálogo, reabrir cajas y respaldos. |
| Recepcionista | Clientes, vehículos, citas, órdenes, cotizaciones, cobros y cierre de caja. |
| Mecánico | Ver operación; registrar diagnóstico, estado, partidas y fotos. **No** ve caja ni montos de cobro. |
| Contabilidad | Caja, pagos, anulaciones, gastos, cierres y reportes; consulta de operación. |

---

## 2. Requisitos

- **Node.js 20.9 o superior** (probado con Node 24).
- Una cuenta en [Supabase](https://supabase.com) (el plan gratuito sirve para pruebas).

## 3. Instalación paso a paso

### 3.1 Crear el proyecto en Supabase

1. En Supabase cree un proyecto nuevo (región sugerida: la más cercana, p. ej. *East US*).
2. **Base de datos** — elija una opción:
   - **SQL Editor (más simple):** abra *SQL Editor → New query*, pegue el contenido completo de [`supabase/setup.sql`](supabase/setup.sql) y presione **Run**. Ejecútelo una sola vez.
   - **Supabase CLI:** `npx supabase link --project-ref <ref>` y luego `npx supabase db push` (aplica `supabase/migrations/` en orden).
3. **Autenticación** (*Authentication → Sign In / Providers*):
   - Deje habilitado **Email**.
   - **Desactive "Allow new users to sign up"**. Las cuentas las crea el administrador desde la aplicación. (Aun si alguien se registrara, su usuario queda **inactivo** sin acceso a datos.)
4. **Storage:** el script crea el bucket privado `work-order-photos` (máx. 8 MB por foto). No requiere pasos adicionales.

### 3.2 Configurar variables de entorno

```bash
cp .env.example .env.local
```

Complete en `.env.local` (Supabase → *Project Settings → API*):

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública *anon*. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor.** Necesaria para crear usuarios y cambiar contraseñas. Nunca la publique ni la use en el navegador. |

### 3.3 Instalar y crear el administrador

```bash
npm install
npm run create-admin -- admin@inversam.hn "UnaContraseñaSegura" "Nombre del Administrador"
npm run dev
```

Abra <http://localhost:3000> e inicie sesión. (Alternativa: crear el usuario en Supabase → *Authentication → Users → Add user*; **el primer usuario del sistema se convierte automáticamente en administrador**.)

### 3.4 Primeros pasos en la aplicación

1. **Configuración:** nombre comercial, RTN, dirección, teléfono, impuesto y pie de documentos.
2. **Servicios:** fije los precios y tiempos reales del taller (el sistema avisa mientras haya servicios en L 0.00).
3. **Usuarios:** cree las cuentas de recepción, mecánicos y contabilidad.
4. Registre clientes y vehículos, y empiece a abrir órdenes.

---

## 4. Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` / `npm start` | Compilación y servidor de producción. |
| `npm test` | Pruebas (unitarias + base de datos real en PGlite). |
| `npm run typecheck` | Verificación de tipos. |
| `npm run lint` | ESLint. |
| `npm run check` | Todo lo anterior + build. |
| `npm run create-admin -- <correo> <clave> [nombre]` | Crea un administrador. |
| `npm run db:bundle` | Regenera `supabase/setup.sql` a partir de `supabase/migrations/`. |

## 5. Pruebas

`npm test` ejecuta:

- **`tests/db/database.test.ts`** — levanta un **PostgreSQL real en memoria (PGlite)** con un esquema `auth` que imita a Supabase, aplica las migraciones del proyecto y verifica como cada rol: RLS, bloqueo anónimo, usuarios inactivos, último administrador, unicidad de placas, numeración consecutiva, totales con descuento e ISV, kilometraje, historial de estados, pagos parciales, sobrepago, anulaciones, cierre/reapertura de caja, bloqueo de partidas en órdenes entregadas y cotizaciones cerradas, conversión cotización→orden, dashboard y reportes.
- **`tests/unit/lib.test.ts`** — paridad exacta de los totales calculados en pantalla con los de PostgreSQL (300 casos aleatorios), zona horaria de Honduras, validaciones y permisos.

> Las migraciones de **Storage** dependen de Supabase y no se ejecutan en PGlite; la subida de fotos debe probarse contra un proyecto Supabase.

## 6. Despliegue en producción

Recomendado: **Vercel** (o cualquier hosting Node.js 20.9+).

1. Suba el repositorio a GitHub y créelo como proyecto en Vercel.
2. Defina las tres variables de entorno del punto 3.2 en Vercel (*Settings → Environment Variables*). Marque `SUPABASE_SERVICE_ROLE_KEY` solo para el entorno de servidor.
3. En Supabase → *Authentication → URL Configuration*, coloque la URL pública del sitio como *Site URL*.
4. Despliegue. La aplicación no se indexa en buscadores (`robots: noindex`).

## 6.1 Apps para teléfono y PC

Una vez publicado el sitio, comparta con el personal la dirección **`https://<su-dominio>/instalar`** (no requiere iniciar sesión). La página detecta el dispositivo y muestra los pasos:

| Plataforma | Cómo se instala | Resultado |
|---|---|---|
| **Android** | Descargar el APK desde /instalar (o Chrome → *Instalar aplicación*) | App nativa con ícono, pantalla completa, cámara y descargas. Ver [android/README.md](android/README.md) para compilar el APK (`npm run apk`). |
| **PC (Windows/Mac)** | Edge o Chrome → botón *Instalar* en la barra de direcciones | App en el menú Inicio/escritorio, ventana propia, anclable a la barra de tareas. |
| **iPhone / iPad** | Safari → *Compartir* → *Agregar a inicio* | Ícono en la pantalla de inicio, pantalla completa. |

Todas las apps muestran siempre la versión más reciente del sistema: al desplegar cambios, no hay que reinstalar nada. Sin internet muestran un aviso; no guardan datos del taller en el dispositivo.

> **¿Por qué no hay un archivo .ipa para iPhone?** Apple solo permite instalar apps nativas mediante App Store/TestFlight, lo que exige una Mac con Xcode y una cuenta Apple Developer (USD 99/año), y suele rechazar apps que solo envuelven un sitio web. La instalación desde Safari da la misma experiencia sin esos requisitos.

## 7. Respaldos

1. **Manual desde la aplicación:** *Configuración → Descargar respaldo* genera un JSON con todas las tablas (solo administradores). Recomendado: semanal, guardado fuera del equipo del taller.
2. **Automáticos de Supabase:** el plan Pro incluye respaldos diarios y *Point-in-Time Recovery*. Para operación real se recomienda este plan.
3. **`pg_dump` programado** (cadena de conexión en *Project Settings → Database*):

   ```bash
   pg_dump "postgresql://postgres:[CLAVE]@db.[REF].supabase.co:5432/postgres" \
     --schema=public --no-owner --format=custom -f respaldo-inversam-$(date +%F).dump
   ```

   Restaurar en un proyecto nuevo: aplicar primero `supabase/setup.sql` solo si la base está vacía, o usar `pg_restore --data-only`.
4. Las **fotografías** viven en Supabase Storage; respáldelas con la CLI (`supabase storage cp -r ss:///work-order-photos ./fotos`) si las necesita fuera de Supabase.

## 8. Seguridad y manejo de errores

- RLS en todas las tablas; el rol `anon` no tiene ningún permiso. Funciones internas de triggers no son invocables vía API.
- Validación doble: Zod en el servidor (mensajes por campo, en español) y restricciones/triggers en PostgreSQL (saldos, cajas cerradas, placas/VIN únicos, vehículo-propietario, estados).
- Los errores de base de datos se traducen a mensajes comprensibles (`src/lib/actions.ts`); los inesperados se registran en el servidor sin exponer detalles.
- Los pagos no se editan ni eliminan: se **anulan** con motivo y quedan auditados; un día con caja cerrada no admite movimientos hasta que un administrador la reabra.
- Las fotos están en un bucket privado y se muestran con URLs firmadas temporales.
- Encabezados de seguridad (`X-Frame-Options`, `nosniff`, `Referrer-Policy`) y redirecciones solo internas tras el login.

## 9. Estructura del proyecto

```
supabase/
  migrations/         Esquema, RLS, Storage y catálogo inicial (orden cronológico)
  setup.sql           Todas las migraciones en un solo script (npm run db:bundle)
src/
  proxy.ts            Refresco de sesión y protección de rutas (antes "middleware")
  app/
    login/            Inicio de sesión
    (app)/            Área privada: dashboard y un directorio por módulo
                      (page.tsx = vista, actions.ts = acciones de servidor)
    api/reportes/excel  Exportación Excel
    api/respaldo        Respaldo JSON
  components/         UI (tarjetas, tablas, formularios, gráficas, PDF, selectores)
  lib/                Supabase, autenticación, permisos, validación, formato HNL/fechas,
                      totales, PDF, reportes
tests/                Pruebas unitarias y de base de datos
docs/ARQUITECTURA.md  Arquitectura, modelo de datos y plan de desarrollo
```

## 10. Consideraciones y pendientes conocidos

- **Facturación fiscal SAR:** el sistema emite órdenes y cotizaciones, **no facturas fiscales** (CAI, rangos autorizados). Si INVERSAM requiere facturar desde el sistema, debe agregarse un módulo conforme al Reglamento de Facturación del SAR.
- **Inventario de repuestos:** los repuestos se registran como partidas con precio; no hay control de existencias ni costo. La rentabilidad se calcula como *ingresos cobrados − gastos registrados* (registre las compras de repuestos como gastos).
- Las fotos HEIC (iPhone) se suben sin compresión; el resto se reduce a ~1600 px antes de subir.
- Probado con pruebas automatizadas y compilación de producción; la prueba integral contra un proyecto Supabase real (login, subida de fotos, exportaciones) debe hacerse al configurar el proyecto de INVERSAM.
