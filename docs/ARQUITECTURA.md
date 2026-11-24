# Arquitectura y plan de desarrollo — INVERSAM Manager

## 1. Decisiones de arquitectura

| Tema | Decisión | Motivo |
|---|---|---|
| Framework | Next.js 16 App Router, Server Components + Server Actions | Datos leídos en el servidor con la sesión del usuario; formularios funcionan con acciones de servidor, sin API REST propia. |
| Datos | Supabase PostgreSQL, acceso vía PostgREST con el JWT del usuario | La seguridad vive en la base de datos (RLS), no solo en el frontend. |
| Reglas de negocio | Triggers y funciones en PostgreSQL | Totales, saldos, numeración, bloqueos de caja y estados son consistentes aunque se acceda desde otro cliente. |
| Autenticación | Supabase Auth (correo + contraseña), cookies con `@supabase/ssr`, `proxy.ts` refresca la sesión | Estándar de Supabase para SSR. Sin registro público: el administrador crea cuentas. |
| Roles | Tabla `profiles.role` + funciones `current_app_role()` / `has_role()` usadas por las políticas RLS | Un solo lugar define quién puede qué; la UI replica la matriz en `src/lib/permissions.ts`. |
| Renderizado | Dinámico por solicitud (`cacheComponents: false`) | Todas las pantallas son privadas y por usuario; no hay contenido estático que cachear. |
| Validación | Zod en acciones de servidor + `CHECK`/triggers en BD | Mensajes claros por campo y garantía final en la base. |
| PDF | jsPDF + autotable en el navegador | Sin servidor de renderizado; se generan al instante con los datos ya cargados. |
| Excel | ExcelJS en una ruta de servidor (`/api/reportes/excel`) | Mantiene la librería fuera del bundle del navegador y aplica RLS. |
| Gráficas | Recharts, paleta categórica validada (CVD/contraste) | Requisito del proyecto; dos series máximo por gráfica, un solo eje. |
| Fechas | `timestamptz` en BD; funciones `hn_today()`, `hn_start()`, `hn_date()` con `America/Tegucigalpa`; formato `es-HN` en la UI | Los cortes de día (caja, dashboard, reportes) usan la hora de Honduras sin importar dónde corra el servidor. |
| Dinero | `numeric(12,2)` en BD; la vista previa en pantalla usa aritmética entera en centavos (BigInt) idéntica a PostgreSQL | Sin errores de punto flotante; verificado con 300 casos aleatorios. |

## 2. Modelo de datos

```
auth.users 1─1 profiles (rol, activo)
customers 1─* vehicles
customers 1─* work_orders *─1 vehicles
work_orders 1─* work_order_items       (servicio | repuesto | mano_obra)
work_orders 1─* work_order_photos      (Storage: work-order-photos/<orden>/<uuid>.jpg)
work_orders 1─* work_order_status_history
work_orders 1─* payments *─0..1 cash_closings
quotes 1─* quote_items ; quotes 0..1─1 work_orders (conversión)
appointments → customers, vehicles?, services?
expenses ; services ; settings (fila única) ; document_counters (numeración)
```

### Reglas implementadas en la base de datos

- **Numeración** `OT-` / `COT-` consecutiva y sin huecos (contador transaccional; un alta fallida no consume número).
- **Totales**: `line_total = round(cant × precio, 2)`; descuento por monto (tope = subtotal) o porcentaje (tope 100 %); impuesto sobre (subtotal − descuento); `balance = total − pagado` (columna generada).
- **Pagos**: no pueden exceder el saldo; no se editan; anulación con motivo (solo admin/contabilidad); no se registran ni anulan en días con caja cerrada.
- **Caja**: `close_cash_register()` congela totales por método, gastos en efectivo, esperado = fondo + efectivo − gastos en efectivo, contado y diferencia; marca los pagos del día.
- **Estados de orden**: fechas de finalizado/entregado automáticas; historial con usuario; partidas bloqueadas al entregar.
- **Cotizaciones**: vigencia por defecto desde configuración; partidas bloqueadas al aprobar/rechazar; `convert_quote_to_work_order()` copia partidas y condiciones.
- **Integridad**: vehículo debe pertenecer al cliente; placa/VIN únicos sin distinguir mayúsculas; siempre queda al menos un administrador activo.
- **Altas de usuario**: el primer usuario es administrador; los creados por un administrador traen su rol; cualquier otro registro queda inactivo.

## 3. Plan de desarrollo (ejecutado)

1. **Análisis y arquitectura** — este documento.
2. **Base de datos** — `supabase/migrations/` (esquema, funciones, RLS, Storage, catálogo).
3. **Autenticación** — login, proxy de sesión, perfiles, roles, usuarios inactivos.
4. **Módulos** — clientes, vehículos, servicios, órdenes, cotizaciones, caja, gastos, citas, usuarios, configuración.
5. **Conexión a BD** — cada pantalla lee y escribe en Supabase con RLS; acciones de servidor con validación y mensajes de error.
6. **Reportes** — `report_data()` y `dashboard_stats()` en SQL; gráficas; exportación Excel y PDF; respaldo JSON.
7. **Pruebas** — 40 pruebas automáticas (BD real en PGlite + unitarias), typecheck, lint y build de producción.
8. **Corrección de errores** — hallazgos corregidos durante las pruebas:
   - Huecos en la numeración de órdenes al fallar un alta → contador transaccional.
   - Diferencias de 1 centavo entre la vista previa y la BD por punto flotante → aritmética en centavos.
   - Recepción veía un efectivo esperado distinto al del cierre (sin acceso a gastos) → resumen de caja como función de definidor con control de rol.
   - Formularios que perdían lo escrito al mostrar errores (reinicio automático de React 19) → envío controlado.
   - Bucle de redirección para usuarios desactivados con sesión vigente → pantalla de aviso con cierre de sesión.

## 4. Siguientes pasos sugeridos

- Módulo de facturación fiscal SAR (CAI) si se requiere emitir facturas desde el sistema.
- Inventario de repuestos con costo para rentabilidad por margen.
- Notificaciones por WhatsApp/SMS de citas y vehículos listos.
- Pruebas end-to-end (Playwright) contra un proyecto Supabase de pruebas.
