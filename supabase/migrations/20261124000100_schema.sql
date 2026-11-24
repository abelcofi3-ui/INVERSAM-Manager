-- =====================================================================
-- INVERSAM MANAGER — Esquema principal
-- Moneda: HNL · Zona horaria de negocio: America/Tegucigalpa
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.app_role as enum ('admin', 'recepcionista', 'mecanico', 'contabilidad');

create type public.work_order_status as enum (
  'recibido', 'en_diagnostico', 'esperando_aprobacion', 'en_reparacion', 'finalizado', 'entregado'
);

create type public.quote_status as enum ('borrador', 'enviada', 'aprobada', 'rechazada');
create type public.item_type as enum ('servicio', 'repuesto', 'mano_obra');
create type public.discount_type as enum ('monto', 'porcentaje');
create type public.payment_method as enum ('efectivo', 'transferencia', 'tarjeta');
create type public.appointment_status as enum ('programada', 'confirmada', 'atendida', 'cancelada', 'no_asistio');
create type public.vehicle_type as enum (
  'sedan', 'hatchback', 'pickup', 'suv', 'camioneta', 'microbus', 'camion', 'motocicleta', 'otro'
);

-- ---------------------------------------------------------------------
-- Utilidades de fecha (zona horaria de negocio)
-- ---------------------------------------------------------------------
create or replace function public.hn_today()
returns date language sql stable
set search_path = public
as $$ select (now() at time zone 'America/Tegucigalpa')::date $$;

-- Medianoche local de una fecha, como timestamptz
create or replace function public.hn_start(p_date date)
returns timestamptz language sql immutable
set search_path = public
as $$ select (p_date::timestamp at time zone 'America/Tegucigalpa') $$;

create or replace function public.hn_date(p_ts timestamptz)
returns date language sql immutable
set search_path = public
as $$ select (p_ts at time zone 'America/Tegucigalpa')::date $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Configuración del negocio (una sola fila)
-- ---------------------------------------------------------------------
create table public.settings (
  id                  int primary key default 1 check (id = 1),
  business_name       text not null default 'INVERSAM',
  legal_name          text,
  rtn                 text,
  address             text default 'Santa Bárbara, Honduras',
  phone               text,
  email               text,
  tax_label           text not null default 'ISV',
  tax_rate            numeric(5,2) not null default 15.00 check (tax_rate >= 0 and tax_rate <= 100),
  quote_validity_days int not null default 15 check (quote_validity_days between 1 and 365),
  document_footer     text,
  updated_at          timestamptz not null default now()
);
insert into public.settings (id) values (1);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Perfiles de usuario (1:1 con auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  email      text,
  phone      text,
  role       public.app_role not null default 'recepcionista',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Rol del usuario actual (solo si está activo)
create or replace function public.current_app_role()
returns public.app_role language sql stable security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() and active $$;

create or replace function public.has_role(variadic p_roles public.app_role[])
returns boolean language sql stable security definer
set search_path = public
as $$ select coalesce(public.current_app_role() = any (p_roles), false) $$;

-- Alta automática de perfil:
--  * El primer usuario del sistema es administrador.
--  * Usuarios creados por un administrador traen app_metadata.role (solo el servidor puede fijarlo).
--  * Cualquier otro registro queda INACTIVO hasta que un administrador lo apruebe.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_role   public.app_role;
  v_active boolean;
begin
  if not exists (select 1 from public.profiles) then
    v_role := 'admin';
    v_active := true;
  elsif coalesce(new.raw_app_meta_data ->> 'role', '') in ('admin', 'recepcionista', 'mecanico', 'contabilidad') then
    v_role := (new.raw_app_meta_data ->> 'role')::public.app_role;
    v_active := true;
  else
    v_role := 'recepcionista';
    v_active := false;
  end if;

  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'usuario'), '@', 1)),
    new.email,
    v_role,
    v_active
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impide dejar el sistema sin administradores activos
create or replace function public.guard_last_admin()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if (tg_op = 'DELETE' and old.role = 'admin' and old.active)
     or (tg_op = 'UPDATE' and old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)) then
    if not exists (
      select 1 from public.profiles where role = 'admin' and active and id <> old.id
    ) then
      raise exception 'Debe existir al menos un administrador activo' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger profiles_guard_last_admin
  before update or delete on public.profiles
  for each row execute function public.guard_last_admin();

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null check (length(trim(full_name)) >= 2),
  phone      text,
  email      text,
  address    text,
  rtn        text,
  notes      text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_name_idx on public.customers (lower(full_name));
create index customers_phone_idx on public.customers (phone);
create index customers_created_idx on public.customers (created_at);
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Vehículos
-- ---------------------------------------------------------------------
create table public.vehicles (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers (id) on delete cascade,
  brand        text not null check (length(trim(brand)) >= 1),
  model        text not null check (length(trim(model)) >= 1),
  year         int check (year between 1950 and 2100),
  plate        text,
  vin          text,
  color        text,
  vehicle_type public.vehicle_type not null default 'sedan',
  mileage      int check (mileage >= 0),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index vehicles_plate_uidx on public.vehicles (upper(plate)) where plate is not null and plate <> '';
create unique index vehicles_vin_uidx on public.vehicles (upper(vin)) where vin is not null and vin <> '';
create index vehicles_customer_idx on public.vehicles (customer_id);
create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Catálogo de servicios
-- ---------------------------------------------------------------------
create table public.services (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(trim(name)) >= 2),
  description       text,
  category          text,
  price             numeric(12,2) not null default 0 check (price >= 0),
  estimated_minutes int check (estimated_minutes > 0),
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index services_name_uidx on public.services (lower(name));
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Cálculo de totales (compartido por cotizaciones y órdenes)
-- ---------------------------------------------------------------------
create or replace function public.calc_discount(p_subtotal numeric, p_type public.discount_type, p_value numeric)
returns numeric language sql immutable
set search_path = public
as $$
  select case
    when p_type = 'porcentaje' then round(p_subtotal * least(greatest(coalesce(p_value, 0), 0), 100) / 100, 2)
    else least(greatest(coalesce(p_value, 0), 0), p_subtotal)
  end
$$;

-- Trigger BEFORE: recalcula descuento, impuesto y total a partir del subtotal
create or replace function public.apply_document_totals()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if new.tax_rate is null then
    select tax_rate into new.tax_rate from public.settings where id = 1;
  end if;
  new.subtotal        := coalesce(new.subtotal, 0);
  new.discount_amount := public.calc_discount(new.subtotal, new.discount_type, new.discount_value);
  new.tax_amount      := round((new.subtotal - new.discount_amount) * new.tax_rate / 100, 2);
  new.total           := new.subtotal - new.discount_amount + new.tax_amount;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Numeración consecutiva SIN huecos (transaccional: un INSERT fallido no consume número)
-- ---------------------------------------------------------------------
create table public.document_counters (
  name       text primary key,
  last_value bigint not null default 0
);
insert into public.document_counters (name) values ('quote'), ('work_order');

create or replace function public.assign_document_number()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  update public.document_counters set last_value = last_value + 1
   where name = tg_argv[0] returning last_value into v_next;
  if tg_table_name = 'quotes' then
    new.quote_number := tg_argv[1] || lpad(v_next::text, 6, '0');
  else
    new.order_number := tg_argv[1] || lpad(v_next::text, 6, '0');
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Cotizaciones
-- ---------------------------------------------------------------------

create table public.quotes (
  id              uuid primary key default gen_random_uuid(),
  quote_number    text not null unique,
  customer_id     uuid not null references public.customers (id) on delete restrict,
  vehicle_id      uuid references public.vehicles (id) on delete set null,
  status          public.quote_status not null default 'borrador',
  issued_at       timestamptz not null default now(),
  valid_until     date,
  notes           text,
  discount_type   public.discount_type not null default 'monto',
  discount_value  numeric(12,2) not null default 0 check (discount_value >= 0),
  tax_rate        numeric(5,2) not null check (tax_rate >= 0 and tax_rate <= 100),
  subtotal        numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount      numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  decided_at      timestamptz,
  decision_notes  text,
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index quotes_customer_idx on public.quotes (customer_id);
create index quotes_issued_idx on public.quotes (issued_at);

create trigger quotes_totals before insert or update on public.quotes
  for each row execute function public.apply_document_totals();
-- zz_: se ejecuta al final de los BEFORE (orden alfabético), después de las validaciones
create trigger quotes_zz_number before insert on public.quotes
  for each row execute function public.assign_document_number('quote', 'COT-');
create trigger quotes_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();

create or replace function public.quote_status_change()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if new.status in ('aprobada', 'rechazada') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.decided_at := now();
  elsif new.status in ('borrador', 'enviada') then
    new.decided_at := null;
  end if;
  if tg_op = 'INSERT' and new.valid_until is null then
    select public.hn_today() + quote_validity_days into new.valid_until from public.settings where id = 1;
  end if;
  return new;
end $$;
create trigger quotes_status before insert or update on public.quotes
  for each row execute function public.quote_status_change();

create table public.quote_items (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.quotes (id) on delete cascade,
  item_type   public.item_type not null,
  service_id  uuid references public.services (id) on delete set null,
  description text not null check (length(trim(description)) >= 1),
  quantity    numeric(10,2) not null check (quantity > 0),
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  line_total  numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at  timestamptz not null default now()
);
create index quote_items_quote_idx on public.quote_items (quote_id);

-- ---------------------------------------------------------------------
-- Órdenes de trabajo
-- ---------------------------------------------------------------------
create table public.work_orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique,
  customer_id      uuid not null references public.customers (id) on delete restrict,
  vehicle_id       uuid not null references public.vehicles (id) on delete restrict,
  quote_id         uuid references public.quotes (id) on delete set null,
  mileage_in       int check (mileage_in >= 0),
  reported_problem text not null check (length(trim(reported_problem)) >= 3),
  diagnosis        text,
  notes            text,
  technician_id    uuid references public.profiles (id) on delete set null,
  status           public.work_order_status not null default 'recibido',
  received_at      timestamptz not null default now(),
  promised_at      timestamptz,
  finished_at      timestamptz,
  delivered_at     timestamptz,
  discount_type    public.discount_type not null default 'monto',
  discount_value   numeric(12,2) not null default 0 check (discount_value >= 0),
  tax_rate         numeric(5,2) not null check (tax_rate >= 0 and tax_rate <= 100),
  subtotal         numeric(12,2) not null default 0,
  discount_amount  numeric(12,2) not null default 0,
  tax_amount       numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  amount_paid      numeric(12,2) not null default 0,
  balance          numeric(12,2) generated always as (total - amount_paid) stored,
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index work_orders_customer_idx on public.work_orders (customer_id);
create index work_orders_vehicle_idx on public.work_orders (vehicle_id);
create index work_orders_status_idx on public.work_orders (status);
create index work_orders_received_idx on public.work_orders (received_at);
create unique index work_orders_quote_uidx on public.work_orders (quote_id) where quote_id is not null;

create trigger work_orders_totals before insert or update on public.work_orders
  for each row execute function public.apply_document_totals();
create trigger work_orders_zz_number before insert on public.work_orders
  for each row execute function public.assign_document_number('work_order', 'OT-');
create trigger work_orders_updated_at before update on public.work_orders
  for each row execute function public.set_updated_at();

-- El vehículo debe pertenecer al cliente (órdenes, cotizaciones y citas)
create or replace function public.check_vehicle_owner()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if new.vehicle_id is not null and not exists (
    select 1 from public.vehicles v where v.id = new.vehicle_id and v.customer_id = new.customer_id
  ) then
    raise exception 'El vehículo seleccionado no pertenece al cliente' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger work_orders_vehicle_owner before insert or update of customer_id, vehicle_id on public.work_orders
  for each row execute function public.check_vehicle_owner();
create trigger quotes_vehicle_owner before insert or update of customer_id, vehicle_id on public.quotes
  for each row execute function public.check_vehicle_owner();

-- Fechas automáticas según el estado
create or replace function public.work_order_status_dates()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if new.status in ('finalizado', 'entregado') and new.finished_at is null then
    new.finished_at := now();
  end if;
  if new.status = 'entregado' and new.delivered_at is null then
    new.delivered_at := now();
  end if;
  if new.status not in ('finalizado', 'entregado') then
    new.finished_at := null;
  end if;
  if new.status <> 'entregado' then
    new.delivered_at := null;
  end if;
  return new;
end $$;
create trigger work_orders_status_dates before insert or update of status on public.work_orders
  for each row execute function public.work_order_status_dates();

-- Historial de estados
create table public.work_order_status_history (
  id            bigint generated always as identity primary key,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  from_status   public.work_order_status,
  to_status     public.work_order_status not null,
  changed_by    uuid references public.profiles (id) on delete set null,
  changed_at    timestamptz not null default now()
);
create index wo_history_order_idx on public.work_order_status_history (work_order_id);

create or replace function public.log_work_order_status()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.work_order_status_history (work_order_id, from_status, to_status, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return null;
end $$;
create trigger work_orders_log_status after insert or update of status on public.work_orders
  for each row execute function public.log_work_order_status();

-- Actualiza el kilometraje del vehículo con el de entrada
create or replace function public.sync_vehicle_mileage()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.mileage_in is not null then
    update public.vehicles
       set mileage = greatest(coalesce(mileage, 0), new.mileage_in)
     where id = new.vehicle_id;
  end if;
  return null;
end $$;
create trigger work_orders_mileage after insert or update of mileage_in on public.work_orders
  for each row execute function public.sync_vehicle_mileage();

create table public.work_order_items (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  item_type     public.item_type not null,
  service_id    uuid references public.services (id) on delete set null,
  description   text not null check (length(trim(description)) >= 1),
  quantity      numeric(10,2) not null check (quantity > 0),
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  line_total    numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at    timestamptz not null default now()
);
create index wo_items_order_idx on public.work_order_items (work_order_id);
create index wo_items_service_idx on public.work_order_items (service_id);

create table public.work_order_photos (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  storage_path  text not null unique,
  caption       text,
  uploaded_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index wo_photos_order_idx on public.work_order_photos (work_order_id);

-- Bloqueo de partidas en documentos cerrados
create or replace function public.guard_document_items()
returns trigger language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  if tg_table_name = 'work_order_items' then
    select status::text into v_status from public.work_orders
     where id = coalesce(new.work_order_id, old.work_order_id);
    if v_status = 'entregado' then
      raise exception 'La orden ya fue entregada; no se pueden modificar sus partidas' using errcode = 'P0001';
    end if;
  else
    select status::text into v_status from public.quotes
     where id = coalesce(new.quote_id, old.quote_id);
    if v_status in ('aprobada', 'rechazada') then
      raise exception 'La cotización ya fue %; no se pueden modificar sus partidas', v_status using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger wo_items_guard before insert or update or delete on public.work_order_items
  for each row execute function public.guard_document_items();
create trigger quote_items_guard before insert or update or delete on public.quote_items
  for each row execute function public.guard_document_items();

-- Recalcula subtotales cuando cambian las partidas
create or replace function public.recalc_document_subtotal()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if tg_table_name = 'work_order_items' then
    update public.work_orders w
       set subtotal = coalesce((select sum(line_total) from public.work_order_items i where i.work_order_id = w.id), 0)
     where w.id in (new.work_order_id, old.work_order_id);
  else
    update public.quotes q
       set subtotal = coalesce((select sum(line_total) from public.quote_items i where i.quote_id = q.id), 0)
     where q.id in (new.quote_id, old.quote_id);
  end if;
  return null;
end $$;
create trigger wo_items_recalc after insert or update or delete on public.work_order_items
  for each row execute function public.recalc_document_subtotal();
create trigger quote_items_recalc after insert or update or delete on public.quote_items
  for each row execute function public.recalc_document_subtotal();

-- ---------------------------------------------------------------------
-- Caja: cierres, pagos y gastos
-- ---------------------------------------------------------------------
create table public.cash_closings (
  id                uuid primary key default gen_random_uuid(),
  closing_date      date not null unique,
  opening_cash      numeric(12,2) not null default 0 check (opening_cash >= 0),
  cash_income       numeric(12,2) not null default 0,
  transfer_income   numeric(12,2) not null default 0,
  card_income       numeric(12,2) not null default 0,
  total_income      numeric(12,2) not null default 0,
  cash_expenses     numeric(12,2) not null default 0,
  total_expenses    numeric(12,2) not null default 0,
  expected_cash     numeric(12,2) not null default 0,
  counted_cash      numeric(12,2) not null check (counted_cash >= 0),
  difference        numeric(12,2) not null default 0,
  payments_count    int not null default 0,
  notes             text,
  closed_by         uuid references public.profiles (id) on delete set null default auth.uid(),
  closed_at         timestamptz not null default now()
);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  work_order_id   uuid not null references public.work_orders (id) on delete restrict,
  amount          numeric(12,2) not null check (amount > 0),
  method          public.payment_method not null,
  reference       text,
  notes           text,
  paid_at         timestamptz not null default now(),
  received_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  cash_closing_id uuid references public.cash_closings (id) on delete set null,
  voided          boolean not null default false,
  voided_at       timestamptz,
  voided_by       uuid references public.profiles (id) on delete set null,
  void_reason     text,
  created_at      timestamptz not null default now()
);
create index payments_order_idx on public.payments (work_order_id);
create index payments_paid_idx on public.payments (paid_at);

create table public.expenses (
  id              uuid primary key default gen_random_uuid(),
  expense_date    date not null default public.hn_today(),
  category        text not null check (length(trim(category)) >= 2),
  description     text not null check (length(trim(description)) >= 2),
  amount          numeric(12,2) not null check (amount > 0),
  method          public.payment_method not null default 'efectivo',
  reference       text,
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create index expenses_date_idx on public.expenses (expense_date);

-- Valida pagos: no exceder saldo, no registrar en días cerrados, anulación controlada
create or replace function public.guard_payment()
returns trigger language plpgsql
set search_path = public
as $$
declare
  v_balance numeric;
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.cash_closings where closing_date = public.hn_date(new.paid_at)) then
      raise exception 'La caja del % ya está cerrada', to_char(public.hn_date(new.paid_at), 'DD/MM/YYYY') using errcode = 'P0001';
    end if;
    select balance into v_balance from public.work_orders where id = new.work_order_id for update;
    if v_balance is null then
      raise exception 'Orden de trabajo no encontrada' using errcode = 'P0001';
    end if;
    if new.amount > v_balance then
      raise exception 'El pago (L %) excede el saldo pendiente (L %)', to_char(new.amount, 'FM999G999G990D00'), to_char(v_balance, 'FM999G999G990D00') using errcode = 'P0001';
    end if;
    new.voided := false;
    new.voided_at := null;
    new.voided_by := null;
    new.cash_closing_id := null;
  else
    if old.voided and not new.voided then
      raise exception 'Un pago anulado no se puede reactivar' using errcode = 'P0001';
    end if;
    if new.amount <> old.amount or new.work_order_id <> old.work_order_id or new.paid_at <> old.paid_at or new.method <> old.method then
      raise exception 'Los pagos no se editan; anule el pago y regístrelo de nuevo' using errcode = 'P0001';
    end if;
    if new.voided and not old.voided then
      if old.cash_closing_id is not null then
        raise exception 'El pago pertenece a un cierre de caja; no se puede anular' using errcode = 'P0001';
      end if;
      if coalesce(trim(new.void_reason), '') = '' then
        raise exception 'Indique el motivo de la anulación' using errcode = 'P0001';
      end if;
      new.voided_at := now();
      new.voided_by := auth.uid();
    end if;
  end if;
  return new;
end $$;
create trigger payments_guard before insert or update on public.payments
  for each row execute function public.guard_payment();

create or replace function public.recalc_amount_paid()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  update public.work_orders w
     set amount_paid = coalesce((select sum(amount) from public.payments p where p.work_order_id = w.id and not p.voided), 0)
   where w.id in (new.work_order_id, old.work_order_id);
  return null;
end $$;
create trigger payments_recalc after insert or update or delete on public.payments
  for each row execute function public.recalc_amount_paid();

create or replace function public.guard_expense()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.cash_closings
     where closing_date in (new.expense_date, case when tg_op = 'UPDATE' then old.expense_date end)
  ) then
    raise exception 'La caja de esa fecha ya está cerrada' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger expenses_guard before insert or update on public.expenses
  for each row execute function public.guard_expense();

create or replace function public.guard_expense_delete()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.cash_closings where closing_date = old.expense_date) then
    raise exception 'La caja de esa fecha ya está cerrada' using errcode = 'P0001';
  end if;
  return old;
end $$;
create trigger expenses_guard_delete before delete on public.expenses
  for each row execute function public.guard_expense_delete();

-- Resumen de caja de un día. SECURITY DEFINER para que recepción vea los gastos en
-- efectivo del día (necesarios para cuadrar) aunque no tenga acceso al módulo de gastos.
create or replace function public.cash_register_summary(p_date date)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.has_role('admin', 'contabilidad', 'recepcionista') then
    raise exception 'No tiene permiso para consultar la caja' using errcode = '42501';
  end if;
  return (
  with p as (
    select method, amount from public.payments
     where not voided and paid_at >= public.hn_start(p_date) and paid_at < public.hn_start(p_date + 1)
  ), e as (
    select method, amount from public.expenses where expense_date = p_date
  )
  select jsonb_build_object(
    'date', p_date,
    'cash_income',     coalesce((select sum(amount) from p where method = 'efectivo'), 0),
    'transfer_income', coalesce((select sum(amount) from p where method = 'transferencia'), 0),
    'card_income',     coalesce((select sum(amount) from p where method = 'tarjeta'), 0),
    'total_income',    coalesce((select sum(amount) from p), 0),
    'payments_count',  (select count(*) from p),
    'cash_expenses',   coalesce((select sum(amount) from e where method = 'efectivo'), 0),
    'total_expenses',  coalesce((select sum(amount) from e), 0),
    'closing',         (select to_jsonb(c) from public.cash_closings c where c.closing_date = p_date)
  ));
end $$;

-- Cierre diario de caja
create or replace function public.close_cash_register(
  p_date date, p_opening_cash numeric, p_counted_cash numeric, p_notes text default null
) returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_s  jsonb;
  v_expected numeric;
begin
  if not public.has_role('admin', 'contabilidad', 'recepcionista') then
    raise exception 'No tiene permiso para cerrar caja' using errcode = '42501';
  end if;
  if p_date > public.hn_today() then
    raise exception 'No se puede cerrar una fecha futura' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.cash_closings where closing_date = p_date) then
    raise exception 'La caja del % ya fue cerrada', to_char(p_date, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  if coalesce(p_opening_cash, 0) < 0 or coalesce(p_counted_cash, -1) < 0 then
    raise exception 'Montos de caja inválidos' using errcode = 'P0001';
  end if;

  v_s := public.cash_register_summary(p_date);
  v_expected := coalesce(p_opening_cash, 0) + (v_s ->> 'cash_income')::numeric - (v_s ->> 'cash_expenses')::numeric;

  insert into public.cash_closings (
    closing_date, opening_cash, cash_income, transfer_income, card_income, total_income,
    cash_expenses, total_expenses, expected_cash, counted_cash, difference, payments_count, notes
  ) values (
    p_date, coalesce(p_opening_cash, 0),
    (v_s ->> 'cash_income')::numeric, (v_s ->> 'transfer_income')::numeric, (v_s ->> 'card_income')::numeric,
    (v_s ->> 'total_income')::numeric, (v_s ->> 'cash_expenses')::numeric, (v_s ->> 'total_expenses')::numeric,
    v_expected, p_counted_cash, p_counted_cash - v_expected, (v_s ->> 'payments_count')::int, nullif(trim(p_notes), '')
  ) returning id into v_id;

  update public.payments set cash_closing_id = v_id
   where not voided and paid_at >= public.hn_start(p_date) and paid_at < public.hn_start(p_date + 1);

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Citas
-- ---------------------------------------------------------------------
create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references public.customers (id) on delete cascade,
  vehicle_id       uuid references public.vehicles (id) on delete set null,
  service_id       uuid references public.services (id) on delete set null,
  scheduled_at     timestamptz not null,
  duration_minutes int not null default 60 check (duration_minutes between 10 and 600),
  status           public.appointment_status not null default 'programada',
  notes            text,
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index appointments_scheduled_idx on public.appointments (scheduled_at);
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();
create trigger appointments_vehicle_owner before insert or update of customer_id, vehicle_id on public.appointments
  for each row execute function public.check_vehicle_owner();

-- ---------------------------------------------------------------------
-- Convertir cotización aprobada en orden de trabajo
-- ---------------------------------------------------------------------
create or replace function public.convert_quote_to_work_order(
  p_quote_id uuid, p_reported_problem text, p_mileage_in int default null, p_technician_id uuid default null
) returns uuid language plpgsql
set search_path = public
as $$
declare
  q    public.quotes%rowtype;
  v_id uuid;
begin
  select * into q from public.quotes where id = p_quote_id;
  if not found then
    raise exception 'Cotización no encontrada' using errcode = 'P0001';
  end if;
  if q.status <> 'aprobada' then
    raise exception 'Solo se pueden convertir cotizaciones aprobadas' using errcode = 'P0001';
  end if;
  if q.vehicle_id is null then
    raise exception 'La cotización no tiene vehículo asignado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.work_orders where quote_id = p_quote_id) then
    raise exception 'Esta cotización ya fue convertida en orden' using errcode = 'P0001';
  end if;

  insert into public.work_orders (
    customer_id, vehicle_id, quote_id, mileage_in, reported_problem, technician_id,
    discount_type, discount_value, tax_rate, status
  ) values (
    q.customer_id, q.vehicle_id, q.id, p_mileage_in, p_reported_problem, p_technician_id,
    q.discount_type, q.discount_value, q.tax_rate, 'en_reparacion'
  ) returning id into v_id;

  insert into public.work_order_items (work_order_id, item_type, service_id, description, quantity, unit_price)
  select v_id, item_type, service_id, description, quantity, unit_price
    from public.quote_items where quote_id = p_quote_id order by created_at;

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Dashboard (respeta RLS: cada rol ve solo lo que puede leer)
-- ---------------------------------------------------------------------
create or replace function public.dashboard_stats()
returns jsonb language sql stable
set search_path = public
as $$
  with d as (
    select public.hn_today() as today,
           date_trunc('week', public.hn_today())::date as week_start,
           date_trunc('month', public.hn_today())::date as month_start
  ), r as (
    select d.*,
           public.hn_start(d.today) as t0, public.hn_start(d.today + 1) as t1,
           public.hn_start(d.week_start) as w0, public.hn_start(d.month_start) as m0,
           public.hn_start(d.today - 29) as s0
      from d
  ), pay as (
    select p.amount, p.paid_at from public.payments p, r where not p.voided and p.paid_at >= least(r.m0, r.w0, r.s0)
  )
  select jsonb_build_object(
    'today', r.today,
    'income_today', (select coalesce(sum(amount), 0) from pay where paid_at >= r.t0 and paid_at < r.t1),
    'income_week',  (select coalesce(sum(amount), 0) from pay where paid_at >= r.w0 and paid_at < r.t1),
    'income_month', (select coalesce(sum(amount), 0) from pay where paid_at >= r.m0 and paid_at < r.t1),
    'open_orders',  (select count(*) from public.work_orders where status not in ('finalizado', 'entregado')),
    'in_repair',    (select count(*) from public.work_orders where status = 'en_reparacion'),
    'ready_for_delivery', (select count(*) from public.work_orders where status = 'finalizado'),
    'completed_month', (select count(*) from public.work_orders where finished_at >= r.m0),
    'receivables',  (select coalesce(sum(balance), 0) from public.work_orders where balance > 0),
    'appointments_today', (select count(*) from public.appointments
                            where scheduled_at >= r.t0 and scheduled_at < r.t1 and status not in ('cancelada')),
    'new_customers_month', (select count(*) from public.customers where created_at >= r.m0),
    'orders_by_status', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
        from (select status, count(*) n from public.work_orders
               where status <> 'entregado' or delivered_at >= r.m0 group by status) s
    ),
    'top_services', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'count', n, 'amount', amt) order by n desc, amt desc), '[]'::jsonb)
        from (
          select i.description as name, count(*) as n, sum(i.line_total) as amt
            from public.work_order_items i
            join public.work_orders w on w.id = i.work_order_id
           where i.item_type = 'servicio' and w.received_at >= r.m0
           group by i.description
           order by count(*) desc, sum(i.line_total) desc
           limit 6
        ) t
    ),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object('date', g.day, 'income', coalesce(pi.amt, 0), 'orders', coalesce(oi.n, 0)) order by g.day), '[]'::jsonb)
        from (select generate_series(r.today - 29, r.today, interval '1 day')::date as day) g
        left join (select public.hn_date(paid_at) as day, sum(amount) amt from pay where paid_at >= r.s0 group by 1) pi on pi.day = g.day
        left join (select public.hn_date(received_at) as day, count(*) n from public.work_orders where received_at >= r.s0 group by 1) oi on oi.day = g.day
    ),
    'upcoming_appointments', (
      select coalesce(jsonb_agg(x order by x.scheduled_at), '[]'::jsonb) from (
        select a.id, a.scheduled_at, a.status, c.full_name as customer,
               nullif(trim(coalesce(v.brand, '') || ' ' || coalesce(v.model, '') || coalesce(' · ' || v.plate, '')), '') as vehicle,
               s.name as service
          from public.appointments a
          join public.customers c on c.id = a.customer_id
          left join public.vehicles v on v.id = a.vehicle_id
          left join public.services s on s.id = a.service_id
         where a.scheduled_at >= r.t0 and a.scheduled_at < r.t1 and a.status not in ('cancelada')
         order by a.scheduled_at
         limit 10
      ) x
    )
  )
  from r
$$;

-- ---------------------------------------------------------------------
-- Reportes por rango de fechas (inclusive, fechas locales)
-- ---------------------------------------------------------------------
create or replace function public.report_data(p_from date, p_to date)
returns jsonb language plpgsql stable
set search_path = public
as $$
declare
  v_t0 timestamptz;
  v_t1 timestamptz;
  v_res jsonb;
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Rango de fechas inválido' using errcode = 'P0001';
  end if;
  if p_to - p_from > 366 then
    raise exception 'El rango máximo es de un año' using errcode = 'P0001';
  end if;
  v_t0 := public.hn_start(p_from);
  v_t1 := public.hn_start(p_to + 1);

  with pay as (
    select * from public.payments where not voided and paid_at >= v_t0 and paid_at < v_t1
  ), exp as (
    select * from public.expenses where expense_date between p_from and p_to
  ), wo as (
    select * from public.work_orders where received_at >= v_t0 and received_at < v_t1
  ), items as (
    select i.* from public.work_order_items i join wo on wo.id = i.work_order_id
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'income_total',   (select coalesce(sum(amount), 0) from pay),
    'expenses_total', (select coalesce(sum(amount), 0) from exp),
    'income_by_method', (
      select coalesce(jsonb_agg(jsonb_build_object('method', method, 'amount', amt, 'count', n)), '[]'::jsonb)
        from (select method, sum(amount) amt, count(*) n from pay group by method) m
    ),
    'expenses_by_category', (
      select coalesce(jsonb_agg(jsonb_build_object('category', category, 'amount', amt, 'count', n) order by amt desc), '[]'::jsonb)
        from (select category, sum(amount) amt, count(*) n from exp group by category) c
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('date', g.day, 'income', coalesce(pi.amt, 0), 'expenses', coalesce(ei.amt, 0)) order by g.day), '[]'::jsonb)
        from (select generate_series(p_from, p_to, interval '1 day')::date as day) g
        left join (select public.hn_date(paid_at) as day, sum(amount) amt from pay group by 1) pi on pi.day = g.day
        left join (select expense_date as day, sum(amount) amt from exp group by 1) ei on ei.day = g.day
    ),
    'orders_count',     (select count(*) from wo),
    'orders_delivered', (select count(*) from wo where status = 'entregado'),
    'orders_billed',    (select coalesce(sum(total), 0) from wo),
    'orders_balance',   (select coalesce(sum(balance), 0) from wo),
    'average_ticket',   (select coalesce(round(avg(total), 2), 0) from wo where total > 0),
    'orders_by_status', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
        from (select status, count(*) n from wo group by status) s
    ),
    'billed_by_type', (
      select coalesce(jsonb_agg(jsonb_build_object('type', item_type, 'amount', amt)), '[]'::jsonb)
        from (select item_type, sum(line_total) amt from items group by item_type) t
    ),
    'services_sold', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'quantity', qty, 'amount', amt) order by amt desc), '[]'::jsonb)
        from (select description as name, sum(quantity) qty, sum(line_total) amt
                from items where item_type = 'servicio' group by description) s
    ),
    'recurring_customers', (
      select coalesce(jsonb_agg(x order by x.orders_in_range desc, x.billed desc), '[]'::jsonb) from (
        select c.id, c.full_name, c.phone,
               count(wo.id) as orders_in_range,
               (select count(*) from public.work_orders w2 where w2.customer_id = c.id) as orders_total,
               coalesce(sum(wo.total), 0) as billed
          from wo join public.customers c on c.id = wo.customer_id
         group by c.id, c.full_name, c.phone
        having (select count(*) from public.work_orders w2 where w2.customer_id = c.id) >= 2
         limit 100
      ) x
    )
  ) into v_res;

  return v_res || jsonb_build_object(
    'profit', (v_res ->> 'income_total')::numeric - (v_res ->> 'expenses_total')::numeric
  );
end $$;
