-- Fase 2 — Inventario básico: categorías, productos, saldos y movimientos.
--
-- Estrategia de stock (ver docs/decisiones/0002-stock-y-costo-promedio.md):
--   * inventory_balances es un saldo materializado (cantidad y costo promedio).
--     Solo lo modifican las funciones de esta migración, bloqueando la fila
--     (FOR UPDATE) en la misma transacción en que insertan el movimiento.
--   * stock_movements es el historial: nunca se actualiza ni se borra. Una
--     corrección es un movimiento nuevo (ajuste).
--   * La vista stock_reconciliation debe estar siempre vacía.
--   * Costo promedio ponderado: solo las entradas con costo lo recalculan.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

-- sale, sale_reversal y return quedan reservados para la Fase 4 (ventas).
create type public.movement_type as enum
  ('initial', 'purchase', 'output', 'adjustment', 'sale', 'sale_reversal', 'return');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 60),
  created_at  timestamptz not null default now(),
  unique (business_id, id)
);

create unique index categories_name_uq on public.categories (business_id, lower(name));

create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses (id) on delete cascade,
  name                text not null check (length(btrim(name)) between 1 and 200),
  sku                 text check (length(sku) between 1 and 60),
  barcode             text check (length(barcode) between 1 and 60),
  category_id         uuid,
  unit                text not null default 'unidad'
                      check (unit in ('unidad', 'kg', 'g', 'l', 'ml', 'm', 'caja', 'paquete', 'docena', 'par')),
  sale_price          numeric(14,2) not null default 0 check (sale_price >= 0),
  low_stock_threshold numeric(14,3) not null default 0 check (low_stock_threshold >= 0),
  is_active           boolean not null default true,
  idempotency_key     uuid,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, category_id)
    references public.categories (business_id, id) on delete set null (category_id)
);

create unique index products_sku_uq on public.products (business_id, lower(sku)) where sku is not null;
create unique index products_barcode_uq on public.products (business_id, barcode) where barcode is not null;
create unique index products_idem_uq on public.products (business_id, idempotency_key)
  where idempotency_key is not null;
create index products_name_idx on public.products (business_id, lower(name));
create index products_category_idx on public.products (business_id, category_id);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

create table public.inventory_balances (
  business_id  uuid not null references public.businesses (id) on delete cascade,
  product_id   uuid not null,
  quantity     numeric(14,3) not null default 0 check (quantity >= 0),
  average_cost numeric(14,4) not null default 0 check (average_cost >= 0),
  updated_at   timestamptz not null default now(),
  primary key (business_id, product_id),
  foreign key (business_id, product_id)
    references public.products (business_id, id) on delete cascade
);

create table public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  product_id      uuid not null,
  movement_type   public.movement_type not null,
  quantity_delta  numeric(14,3) not null check (quantity_delta <> 0),
  -- Costo unitario de esta línea: el de compra en entradas, el promedio vigente en salidas.
  unit_cost       numeric(14,4) not null check (unit_cost >= 0),
  -- Saldo y costo promedio resultantes, para leer el historial sin recalcular.
  balance_after   numeric(14,3) not null check (balance_after >= 0),
  average_cost_after numeric(14,4) not null check (average_cost_after >= 0),
  reference_type  text,
  reference_id    uuid,
  reason          text check (length(reason) <= 200),
  idempotency_key uuid,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  foreign key (business_id, product_id)
    references public.products (business_id, id) on delete cascade
);

create index stock_movements_product_idx
  on public.stock_movements (business_id, product_id, created_at desc);
create index stock_movements_business_idx
  on public.stock_movements (business_id, created_at desc);
create unique index stock_movements_idem_uq
  on public.stock_movements (business_id, idempotency_key) where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- RLS: lectura
-- ---------------------------------------------------------------------------

alter table public.categories         enable row level security;
alter table public.products           enable row level security;
alter table public.inventory_balances enable row level security;
alter table public.stock_movements    enable row level security;

revoke all on public.categories, public.products, public.inventory_balances, public.stock_movements
  from anon, authenticated;
grant select on public.categories, public.products, public.inventory_balances, public.stock_movements
  to authenticated;

create policy categories_select on public.categories
  for select to authenticated
  using ((select private.is_member(business_id)));

create policy products_select on public.products
  for select to authenticated
  using ((select private.is_member(business_id)));

create policy inventory_balances_select on public.inventory_balances
  for select to authenticated
  using ((select private.is_member(business_id)));

create policy stock_movements_select on public.stock_movements
  for select to authenticated
  using ((select private.is_member(business_id)));

-- ---------------------------------------------------------------------------
-- Vistas de lectura (security_invoker: aplican la RLS de quien consulta)
-- ---------------------------------------------------------------------------

-- Agotado siempre cuenta como stock bajo; el umbral permite avisar antes.
create view public.product_overview
with (security_invoker = true) as
select
  p.id,
  p.business_id,
  p.name,
  p.sku,
  p.barcode,
  p.category_id,
  c.name as category_name,
  p.unit,
  p.sale_price,
  p.low_stock_threshold,
  p.is_active,
  b.quantity,
  b.average_cost,
  round(b.quantity * b.average_cost, 2) as stock_value,
  (p.is_active and b.quantity <= p.low_stock_threshold) as is_low_stock,
  p.created_at,
  p.updated_at
from public.products p
join public.inventory_balances b
  on b.business_id = p.business_id and b.product_id = p.id
left join public.categories c
  on c.business_id = p.business_id and c.id = p.category_id;

create view public.inventory_summary
with (security_invoker = true) as
select
  business_id,
  count(*) filter (where is_active) as active_products,
  count(*) filter (where is_low_stock) as low_stock_products,
  coalesce(sum(stock_value) filter (where is_active), 0) as stock_value
from public.product_overview
group by business_id;

create view public.movement_history
with (security_invoker = true) as
select
  m.id,
  m.business_id,
  m.product_id,
  p.name as product_name,
  p.unit,
  m.movement_type,
  m.quantity_delta,
  m.unit_cost,
  m.balance_after,
  m.average_cost_after,
  m.reason,
  m.created_by,
  m.created_at
from public.stock_movements m
join public.products p
  on p.business_id = m.business_id and p.id = m.product_id;

-- Debe estar vacía: saldo materializado = suma del historial.
create view public.stock_reconciliation
with (security_invoker = true) as
select
  b.business_id,
  b.product_id,
  b.quantity as balance_quantity,
  coalesce(sum(m.quantity_delta), 0) as movements_quantity
from public.inventory_balances b
left join public.stock_movements m
  on m.business_id = b.business_id and m.product_id = b.product_id
group by b.business_id, b.product_id, b.quantity
having b.quantity <> coalesce(sum(m.quantity_delta), 0);

revoke all on public.product_overview, public.inventory_summary, public.movement_history,
  public.stock_reconciliation from anon, authenticated;
grant select on public.product_overview, public.inventory_summary, public.movement_history,
  public.stock_reconciliation to authenticated;

-- ---------------------------------------------------------------------------
-- Validaciones compartidas
-- ---------------------------------------------------------------------------

-- Cantidad positiva, con máximo 3 decimales y dentro de numeric(14,3).
create function private.assert_quantity(p_value numeric, p_allow_zero boolean default false)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null
     or p_value < 0
     or (p_value = 0 and not p_allow_zero)
     or p_value <> round(p_value, 3)
     or p_value >= 100000000000 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
end;
$$;

create function private.assert_money(p_value numeric, p_error text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or p_value < 0 or p_value <> round(p_value, 4) or p_value >= 10000000000 then
    raise exception '%', p_error using errcode = '22023';
  end if;
end;
$$;

create function private.normalize_reason(p_reason text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(p_reason), '');
begin
  if length(v_reason) > 200 then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  return v_reason;
end;
$$;

-- Valida y normaliza los datos editables de un producto.
create function private.validate_product(
  p_business_id uuid,
  p_name text,
  p_sale_price numeric,
  p_unit text,
  p_sku text,
  p_barcode text,
  p_category_id uuid,
  p_low_stock_threshold numeric,
  out name text,
  out sku text,
  out barcode text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  name := btrim(p_name);
  sku := nullif(btrim(p_sku), '');
  barcode := nullif(btrim(p_barcode), '');

  if name is null or length(name) not between 1 and 200 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_sale_price is null or p_sale_price < 0 or p_sale_price <> round(p_sale_price, 2)
     or p_sale_price >= 1000000000000 then
    raise exception 'invalid_price' using errcode = '22023';
  end if;
  if p_unit is null or p_unit not in ('unidad', 'kg', 'g', 'l', 'ml', 'm', 'caja', 'paquete', 'docena', 'par') then
    raise exception 'invalid_unit' using errcode = '22023';
  end if;
  if length(sku) > 60 then
    raise exception 'invalid_sku' using errcode = '22023';
  end if;
  if length(barcode) > 60 then
    raise exception 'invalid_barcode' using errcode = '22023';
  end if;
  begin
    perform private.assert_quantity(p_low_stock_threshold, true);
  exception when sqlstate '22023' then
    raise exception 'invalid_threshold' using errcode = '22023';
  end;
  if p_category_id is not null and not exists (
    select 1 from public.categories c
    where c.business_id = p_business_id and c.id = p_category_id
  ) then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Traduce violaciones de unicidad de productos a errores entendibles.
create function private.raise_product_conflict(p_constraint text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_constraint = 'products_sku_uq' then
    raise exception 'duplicate_sku' using errcode = '23505';
  elsif p_constraint = 'products_barcode_uq' then
    raise exception 'duplicate_barcode' using errcode = '23505';
  end if;
  raise exception 'duplicate_product' using errcode = '23505';
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: categorías
-- ---------------------------------------------------------------------------

create function public.create_category(p_business_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_id   uuid;
begin
  perform private.assert_can_write(p_business_id);

  if v_name is null or length(v_name) not between 1 and 60 then
    raise exception 'invalid_category_name' using errcode = '22023';
  end if;

  insert into public.categories (business_id, name)
  values (p_business_id, v_name)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'duplicate_category' using errcode = '23505';
end;
$$;

create function public.rename_category(p_business_id uuid, p_category_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
begin
  perform private.assert_can_write(p_business_id);

  if v_name is null or length(v_name) not between 1 and 60 then
    raise exception 'invalid_category_name' using errcode = '22023';
  end if;

  update public.categories
  set name = v_name
  where business_id = p_business_id and id = p_category_id;
  if not found then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
exception
  when unique_violation then
    raise exception 'duplicate_category' using errcode = '23505';
end;
$$;

-- Los productos de la categoría quedan sin categoría; no se borra ningún producto.
create function public.delete_category(p_business_id uuid, p_category_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_can_write(p_business_id, array['owner', 'admin']::public.member_role[]);

  delete from public.categories
  where business_id = p_business_id and id = p_category_id;
  if not found then
    raise exception 'category_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: productos
-- ---------------------------------------------------------------------------

-- Crea el producto y su saldo. Si trae existencias iniciales, registra un
-- movimiento 'initial' con su costo. Con la misma clave idempotente devuelve
-- el producto ya creado en lugar de duplicarlo.
create function public.create_product(
  p_business_id         uuid,
  p_name                text,
  p_sale_price          numeric,
  p_unit                text default 'unidad',
  p_sku                 text default null,
  p_barcode             text default null,
  p_category_id         uuid default null,
  p_low_stock_threshold numeric default 0,
  p_initial_quantity    numeric default 0,
  p_initial_unit_cost   numeric default null,
  p_idempotency_key     uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v      record;
  v_id   uuid;
  v_constraint text;
begin
  perform private.assert_can_write(p_business_id);

  if p_idempotency_key is not null then
    select id into v_id from public.products
    where business_id = p_business_id and idempotency_key = p_idempotency_key;
    if found then
      return v_id;
    end if;
  end if;

  select * into v from private.validate_product(
    p_business_id, p_name, p_sale_price, p_unit, p_sku, p_barcode, p_category_id, p_low_stock_threshold);

  perform private.assert_quantity(p_initial_quantity, true);
  if p_initial_quantity > 0 then
    perform private.assert_money(p_initial_unit_cost, 'invalid_unit_cost');
  end if;

  begin
    insert into public.products (
      business_id, name, sku, barcode, category_id, unit, sale_price,
      low_stock_threshold, idempotency_key, created_by
    )
    values (
      p_business_id, v.name, v.sku, v.barcode, p_category_id, p_unit, p_sale_price,
      p_low_stock_threshold, p_idempotency_key, v_uid
    )
    returning id into v_id;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'products_idem_uq' then
      -- Otra petición con la misma clave ganó la carrera.
      select id into v_id from public.products
      where business_id = p_business_id and idempotency_key = p_idempotency_key;
      return v_id;
    end if;
    perform private.raise_product_conflict(v_constraint);
  end;

  if p_initial_quantity > 0 then
    insert into public.inventory_balances (business_id, product_id, quantity, average_cost)
    values (p_business_id, v_id, p_initial_quantity, p_initial_unit_cost);

    insert into public.stock_movements (
      business_id, product_id, movement_type, quantity_delta, unit_cost,
      balance_after, average_cost_after, reason, created_by
    )
    values (
      p_business_id, v_id, 'initial', p_initial_quantity, p_initial_unit_cost,
      p_initial_quantity, p_initial_unit_cost, 'Existencias iniciales', v_uid
    );
  else
    insert into public.inventory_balances (business_id, product_id)
    values (p_business_id, v_id);
  end if;

  return v_id;
end;
$$;

-- Cambia los datos descriptivos. La cantidad y el costo solo cambian con movimientos.
create function public.update_product(
  p_business_id         uuid,
  p_product_id          uuid,
  p_name                text,
  p_sale_price          numeric,
  p_unit                text default 'unidad',
  p_sku                 text default null,
  p_barcode             text default null,
  p_category_id         uuid default null,
  p_low_stock_threshold numeric default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_constraint text;
begin
  perform private.assert_can_write(p_business_id);

  select * into v from private.validate_product(
    p_business_id, p_name, p_sale_price, p_unit, p_sku, p_barcode, p_category_id, p_low_stock_threshold);

  update public.products
  set name = v.name,
      sku = v.sku,
      barcode = v.barcode,
      category_id = p_category_id,
      unit = p_unit,
      sale_price = p_sale_price,
      low_stock_threshold = p_low_stock_threshold
  where business_id = p_business_id and id = p_product_id;
  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
exception when unique_violation then
  get stacked diagnostics v_constraint = constraint_name;
  perform private.raise_product_conflict(v_constraint);
end;
$$;

-- Los productos no se borran (tienen historial): se archivan y se pueden reactivar.
create function public.set_product_active(p_business_id uuid, p_product_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_can_write(p_business_id);

  if p_active is null then
    raise exception 'invalid_active' using errcode = '22023';
  end if;

  update public.products
  set is_active = p_active
  where business_id = p_business_id and id = p_product_id;
  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: movimientos
-- ---------------------------------------------------------------------------

-- Entrada ('purchase', con costo) o salida ('output': daño, vencimiento,
-- consumo interno…). p_quantity siempre es positiva. Devuelve el id del
-- movimiento; con una clave idempotente repetida devuelve el ya registrado.
create function public.record_stock_movement(
  p_business_id     uuid,
  p_product_id      uuid,
  p_type            public.movement_type,
  p_quantity        numeric,
  p_unit_cost       numeric default null,
  p_reason          text default null,
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_qty      numeric(14,3);
  v_avg      numeric(14,4);
  v_active   boolean;
  v_delta    numeric(14,3);
  v_cost     numeric(14,4);
  v_new_qty  numeric(14,3);
  v_new_avg  numeric(14,4);
  v_reason   text;
  v_id       uuid;
begin
  perform private.assert_can_write(p_business_id);

  if p_type is null or p_type not in ('purchase', 'output') then
    raise exception 'invalid_movement_type' using errcode = '22023';
  end if;

  -- Bloquea el saldo: los movimientos del mismo producto se serializan.
  select b.quantity, b.average_cost, p.is_active
  into v_qty, v_avg, v_active
  from public.inventory_balances b
  join public.products p on p.business_id = b.business_id and p.id = b.product_id
  where b.business_id = p_business_id and b.product_id = p_product_id
  for update of b;
  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  if p_idempotency_key is not null then
    select id into v_id from public.stock_movements
    where business_id = p_business_id and idempotency_key = p_idempotency_key;
    if found then
      return v_id;
    end if;
  end if;

  if not v_active then
    raise exception 'product_inactive' using errcode = 'P0001';
  end if;
  perform private.assert_quantity(p_quantity);
  v_reason := private.normalize_reason(p_reason);

  if p_type = 'purchase' then
    perform private.assert_money(p_unit_cost, 'invalid_unit_cost');
    v_delta := p_quantity;
    v_cost := p_unit_cost;
    v_new_qty := v_qty + v_delta;
    v_new_avg := case
      when v_qty = 0 then v_cost
      else round((v_qty * v_avg + v_delta * v_cost) / v_new_qty, 4)
    end;
  else
    if p_quantity > v_qty then
      raise exception 'insufficient_stock' using errcode = 'P0001';
    end if;
    v_delta := -p_quantity;
    v_cost := v_avg;
    v_new_qty := v_qty + v_delta;
    v_new_avg := v_avg;
  end if;

  insert into public.stock_movements (
    business_id, product_id, movement_type, quantity_delta, unit_cost,
    balance_after, average_cost_after, reason, idempotency_key, created_by
  )
  values (
    p_business_id, p_product_id, p_type, v_delta, v_cost,
    v_new_qty, v_new_avg, v_reason, p_idempotency_key, v_uid
  )
  returning id into v_id;

  update public.inventory_balances
  set quantity = v_new_qty, average_cost = v_new_avg, updated_at = now()
  where business_id = p_business_id and product_id = p_product_id;

  return v_id;
end;
$$;

-- Ajuste por conteo físico: deja el saldo en la cantidad contada y registra
-- la diferencia. No cambia el costo promedio. El motivo es obligatorio.
create function public.adjust_stock(
  p_business_id      uuid,
  p_product_id       uuid,
  p_counted_quantity numeric,
  p_reason           text,
  p_idempotency_key  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_qty    numeric(14,3);
  v_avg    numeric(14,4);
  v_delta  numeric(14,3);
  v_reason text;
  v_id     uuid;
begin
  perform private.assert_can_write(p_business_id);

  select b.quantity, b.average_cost
  into v_qty, v_avg
  from public.inventory_balances b
  where b.business_id = p_business_id and b.product_id = p_product_id
  for update;
  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  if p_idempotency_key is not null then
    select id into v_id from public.stock_movements
    where business_id = p_business_id and idempotency_key = p_idempotency_key;
    if found then
      return v_id;
    end if;
  end if;

  perform private.assert_quantity(p_counted_quantity, true);
  v_reason := private.normalize_reason(p_reason);
  if v_reason is null then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;

  v_delta := p_counted_quantity - v_qty;
  if v_delta = 0 then
    raise exception 'no_change' using errcode = 'P0001';
  end if;

  insert into public.stock_movements (
    business_id, product_id, movement_type, quantity_delta, unit_cost,
    balance_after, average_cost_after, reason, idempotency_key, created_by
  )
  values (
    p_business_id, p_product_id, 'adjustment', v_delta, v_avg,
    p_counted_quantity, v_avg, v_reason, p_idempotency_key, v_uid
  )
  returning id into v_id;

  update public.inventory_balances
  set quantity = p_counted_quantity, updated_at = now()
  where business_id = p_business_id and product_id = p_product_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema private from public;
grant execute on function private.is_member(uuid) to authenticated;

revoke execute on function
  public.create_category(uuid, text),
  public.rename_category(uuid, uuid, text),
  public.delete_category(uuid, uuid),
  public.create_product(uuid, text, numeric, text, text, text, uuid, numeric, numeric, numeric, uuid),
  public.update_product(uuid, uuid, text, numeric, text, text, text, uuid, numeric),
  public.set_product_active(uuid, uuid, boolean),
  public.record_stock_movement(uuid, uuid, public.movement_type, numeric, numeric, text, uuid),
  public.adjust_stock(uuid, uuid, numeric, text, uuid)
from public, anon;

grant execute on function
  public.create_category(uuid, text),
  public.rename_category(uuid, uuid, text),
  public.delete_category(uuid, uuid),
  public.create_product(uuid, text, numeric, text, text, text, uuid, numeric, numeric, numeric, uuid),
  public.update_product(uuid, uuid, text, numeric, text, text, text, uuid, numeric),
  public.set_product_active(uuid, uuid, boolean),
  public.record_stock_movement(uuid, uuid, public.movement_type, numeric, numeric, text, uuid),
  public.adjust_stock(uuid, uuid, numeric, text, uuid)
to authenticated;
