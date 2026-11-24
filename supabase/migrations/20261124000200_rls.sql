-- =====================================================================
-- INVERSAM MANAGER — Seguridad a nivel de fila (RLS) y permisos por rol
--
--  Rol            | Lectura                         | Escritura
--  ---------------+---------------------------------+-------------------------------------------
--  admin          | todo                            | todo
--  recepcionista  | operación + caja                | clientes, vehículos, citas, órdenes,
--                 |                                 | cotizaciones, pagos, cierre de caja
--  mecanico       | clientes, vehículos, órdenes,   | órdenes (diagnóstico/estado), partidas,
--                 | catálogo, citas                 | fotos
--  contabilidad   | todo lo financiero y operativo  | pagos, anulaciones, gastos, cierre de caja
-- =====================================================================

alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.services enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_order_items enable row level security;
alter table public.work_order_photos enable row level security;
alter table public.work_order_status_history enable row level security;
alter table public.cash_closings enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.appointments enable row level security;
-- Sin políticas: solo accesible desde funciones internas
alter table public.document_counters enable row level security;

-- Atajos
-- staff = cualquier usuario activo con rol
create or replace function public.is_staff()
returns boolean language sql stable security definer
set search_path = public
as $$ select public.current_app_role() is not null $$;

-- settings
create policy settings_select on public.settings for select to authenticated using (public.is_staff());
create policy settings_update on public.settings for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- profiles: cada usuario puede ver su propio perfil aunque esté inactivo
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_update on public.profiles for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- customers
create policy customers_select on public.customers for select to authenticated using (public.is_staff());
create policy customers_insert on public.customers for insert to authenticated
  with check (public.has_role('admin', 'recepcionista'));
create policy customers_update on public.customers for update to authenticated
  using (public.has_role('admin', 'recepcionista')) with check (public.has_role('admin', 'recepcionista'));
create policy customers_delete on public.customers for delete to authenticated using (public.has_role('admin'));

-- vehicles
create policy vehicles_select on public.vehicles for select to authenticated using (public.is_staff());
create policy vehicles_insert on public.vehicles for insert to authenticated
  with check (public.has_role('admin', 'recepcionista'));
create policy vehicles_update on public.vehicles for update to authenticated
  using (public.has_role('admin', 'recepcionista')) with check (public.has_role('admin', 'recepcionista'));
create policy vehicles_delete on public.vehicles for delete to authenticated using (public.has_role('admin'));

-- services
create policy services_select on public.services for select to authenticated using (public.is_staff());
create policy services_insert on public.services for insert to authenticated with check (public.has_role('admin'));
create policy services_update on public.services for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
create policy services_delete on public.services for delete to authenticated using (public.has_role('admin'));

-- quotes
create policy quotes_select on public.quotes for select to authenticated using (public.is_staff());
create policy quotes_insert on public.quotes for insert to authenticated
  with check (public.has_role('admin', 'recepcionista'));
create policy quotes_update on public.quotes for update to authenticated
  using (public.has_role('admin', 'recepcionista')) with check (public.has_role('admin', 'recepcionista'));
create policy quotes_delete on public.quotes for delete to authenticated using (public.has_role('admin'));

create policy quote_items_select on public.quote_items for select to authenticated using (public.is_staff());
create policy quote_items_insert on public.quote_items for insert to authenticated
  with check (public.has_role('admin', 'recepcionista'));
create policy quote_items_update on public.quote_items for update to authenticated
  using (public.has_role('admin', 'recepcionista')) with check (public.has_role('admin', 'recepcionista'));
create policy quote_items_delete on public.quote_items for delete to authenticated
  using (public.has_role('admin', 'recepcionista'));

-- work orders
create policy work_orders_select on public.work_orders for select to authenticated using (public.is_staff());
create policy work_orders_insert on public.work_orders for insert to authenticated
  with check (public.has_role('admin', 'recepcionista'));
create policy work_orders_update on public.work_orders for update to authenticated
  using (public.has_role('admin', 'recepcionista', 'mecanico'))
  with check (public.has_role('admin', 'recepcionista', 'mecanico'));
create policy work_orders_delete on public.work_orders for delete to authenticated using (public.has_role('admin'));

create policy wo_items_select on public.work_order_items for select to authenticated using (public.is_staff());
create policy wo_items_insert on public.work_order_items for insert to authenticated
  with check (public.has_role('admin', 'recepcionista', 'mecanico'));
create policy wo_items_update on public.work_order_items for update to authenticated
  using (public.has_role('admin', 'recepcionista', 'mecanico'))
  with check (public.has_role('admin', 'recepcionista', 'mecanico'));
create policy wo_items_delete on public.work_order_items for delete to authenticated
  using (public.has_role('admin', 'recepcionista', 'mecanico'));

create policy wo_photos_select on public.work_order_photos for select to authenticated using (public.is_staff());
create policy wo_photos_insert on public.work_order_photos for insert to authenticated
  with check (public.has_role('admin', 'recepcionista', 'mecanico'));
create policy wo_photos_delete on public.work_order_photos for delete to authenticated
  using (public.has_role('admin', 'recepcionista'));

create policy wo_history_select on public.work_order_status_history for select to authenticated using (public.is_staff());

-- caja
create policy cash_closings_select on public.cash_closings for select to authenticated
  using (public.has_role('admin', 'recepcionista', 'contabilidad'));
create policy cash_closings_delete on public.cash_closings for delete to authenticated
  using (public.has_role('admin'));

create policy payments_select on public.payments for select to authenticated
  using (public.has_role('admin', 'recepcionista', 'contabilidad'));
create policy payments_insert on public.payments for insert to authenticated
  with check (public.has_role('admin', 'recepcionista', 'contabilidad'));
create policy payments_update on public.payments for update to authenticated
  using (public.has_role('admin', 'contabilidad')) with check (public.has_role('admin', 'contabilidad'));

create policy expenses_select on public.expenses for select to authenticated
  using (public.has_role('admin', 'contabilidad'));
create policy expenses_insert on public.expenses for insert to authenticated
  with check (public.has_role('admin', 'contabilidad'));
create policy expenses_update on public.expenses for update to authenticated
  using (public.has_role('admin', 'contabilidad')) with check (public.has_role('admin', 'contabilidad'));
create policy expenses_delete on public.expenses for delete to authenticated using (public.has_role('admin'));

-- citas
create policy appointments_select on public.appointments for select to authenticated using (public.is_staff());
create policy appointments_insert on public.appointments for insert to authenticated
  with check (public.has_role('admin', 'recepcionista'));
create policy appointments_update on public.appointments for update to authenticated
  using (public.has_role('admin', 'recepcionista')) with check (public.has_role('admin', 'recepcionista'));
create policy appointments_delete on public.appointments for delete to authenticated
  using (public.has_role('admin', 'recepcionista'));

-- ---------------------------------------------------------------------
-- Privilegios: sin acceso anónimo
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Funciones internas de triggers: no invocables vía API
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.guard_last_admin() from authenticated;
revoke execute on function public.recalc_document_subtotal() from authenticated;
revoke execute on function public.recalc_amount_paid() from authenticated;
revoke execute on function public.log_work_order_status() from authenticated;
revoke execute on function public.sync_vehicle_mileage() from authenticated;
revoke execute on function public.assign_document_number() from authenticated;
revoke all on table public.document_counters from authenticated;
