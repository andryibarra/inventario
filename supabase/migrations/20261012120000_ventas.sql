-- Fase 4 — Ventas y reportes.
--
-- Ver docs/decisiones/0004-ventas.md:
--   * Una venta descuenta stock en la misma transacción que la registra, con
--     movimientos 'sale' ligados a ella.
--   * Los saldos se bloquean en orden por product_id: dos ventas con los mismos
--     productos no se bloquean mutuamente (sin deadlocks) y nunca dejan stock
--     negativo.
--   * Cada artículo guarda una foto (snapshot) del nombre, el precio y el costo
--     promedio del momento. Los reportes usan esas fotos.
--   * Anular una venta no la borra: la marca como anulada y devuelve el stock
--     con movimientos 'sale_reversal' al costo con que salió.
--   * Esto no es facturación electrónica.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.sales (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  -- Consecutivo por negocio, para hablar de "la venta 25".
  number          int not null check (number > 0),
  status          text not null default 'completed' check (status in ('completed', 'cancelled')),
  payment_method  text not null default 'cash'
                  check (payment_method in ('cash', 'transfer', 'card', 'credit', 'other')),
  subtotal        numeric(14,2) not null check (subtotal >= 0),
  discount_total  numeric(14,2) not null default 0 check (discount_total >= 0),
  total           numeric(14,2) not null check (total >= 0),
  cost_total      numeric(14,2) not null check (cost_total >= 0),
  currency        char(3) not null,
  note            text check (length(note) <= 200),
  idempotency_key uuid not null,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  cancelled_at    timestamptz,
  cancelled_by    uuid references auth.users (id) on delete set null,
  cancel_reason   text check (length(cancel_reason) <= 200),
  check (total = subtotal - discount_total),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  unique (business_id, id),
  unique (business_id, number),
  unique (business_id, idempotency_key)
);

create index sales_business_created_idx on public.sales (business_id, created_at desc);

create table public.sale_items (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null,
  sale_id       uuid not null,
  product_id    uuid not null,
  product_name  text not null,
  unit          text not null,
  quantity      numeric(14,3) not null check (quantity > 0),
  unit_price    numeric(14,2) not null check (unit_price >= 0),
  unit_cost     numeric(14,4) not null check (unit_cost >= 0),
  line_total    numeric(14,2) not null check (line_total >= 0),
  line_cost     numeric(14,2) not null check (line_cost >= 0),
  foreign key (business_id, sale_id) references public.sales (business_id, id) on delete cascade,
  foreign key (business_id, product_id) references public.products (business_id, id) on delete cascade,
  unique (sale_id, product_id)
);

create index sale_items_product_idx on public.sale_items (business_id, product_id);

-- ---------------------------------------------------------------------------
-- RLS: lectura
-- ---------------------------------------------------------------------------

alter table public.sales      enable row level security;
alter table public.sale_items enable row level security;

revoke all on public.sales, public.sale_items from anon, authenticated;
grant select on public.sales, public.sale_items to authenticated;

create policy sales_select on public.sales
  for select to authenticated
  using ((select private.is_member(business_id)));

create policy sale_items_select on public.sale_items
  for select to authenticated
  using ((select private.is_member(business_id)));

-- ---------------------------------------------------------------------------
-- RPC: ventas
-- ---------------------------------------------------------------------------

-- p_items: [{"product_id": "...", "quantity": 2, "unit_price": 2500}, ...]
-- unit_price es opcional: si falta se usa el precio de venta del producto.
-- Con la misma clave idempotente devuelve la venta ya registrada.
create function public.create_sale(
  p_business_id     uuid,
  p_items           jsonb,
  p_idempotency_key uuid,
  p_payment_method  text default 'cash',
  p_discount        numeric default 0,
  p_note            text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_sale_id   uuid;
  v_number    int;
  v_currency  char(3);
  v_note      text;
  v_item      record;
  v_subtotal  numeric(14,2) := 0;
  v_cost      numeric(14,2) := 0;
  v_count     int;
begin
  perform private.assert_can_write(p_business_id);

  if p_idempotency_key is null then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;
  select id into v_sale_id from public.sales
  where business_id = p_business_id and idempotency_key = p_idempotency_key;
  if found then
    return v_sale_id;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'sale_empty' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'sale_too_many_items' using errcode = '22023';
  end if;
  if p_payment_method is null
     or p_payment_method not in ('cash', 'transfer', 'card', 'credit', 'other') then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;
  if p_discount is null or p_discount < 0 or p_discount <> round(p_discount, 2) then
    raise exception 'invalid_discount' using errcode = '22023';
  end if;
  v_note := private.normalize_reason(p_note);

  -- Artículos normalizados en una tabla temporal de la transacción.
  create temporary table if not exists pg_temp.sale_lines (
    product_id uuid primary key,
    quantity   numeric,
    unit_price numeric
  ) on commit drop;
  truncate pg_temp.sale_lines;

  begin
    insert into pg_temp.sale_lines (product_id, quantity, unit_price)
    select (e ->> 'product_id')::uuid, (e ->> 'quantity')::numeric, (e ->> 'unit_price')::numeric
    from jsonb_array_elements(p_items) e;
  exception
    when unique_violation then
      raise exception 'sale_duplicate_item' using errcode = '22023';
    when invalid_text_representation or not_null_violation then
      raise exception 'sale_invalid_item' using errcode = '22023';
  end;

  -- Bloqueo en orden por product_id: evita deadlocks entre ventas simultáneas.
  perform 1
  from public.inventory_balances b
  where b.business_id = p_business_id
    and b.product_id in (select product_id from pg_temp.sale_lines)
  order by b.product_id
  for update;

  select count(*) into v_count
  from pg_temp.sale_lines l
  join public.products p on p.business_id = p_business_id and p.id = l.product_id;
  if v_count <> (select count(*) from pg_temp.sale_lines) then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  for v_item in
    select l.product_id, l.quantity, coalesce(l.unit_price, p.sale_price) as unit_price,
           p.name, p.unit, p.is_active, b.quantity as available, b.average_cost
    from pg_temp.sale_lines l
    join public.products p on p.business_id = p_business_id and p.id = l.product_id
    join public.inventory_balances b on b.business_id = p_business_id and b.product_id = l.product_id
    order by l.product_id
  loop
    if not v_item.is_active then
      raise exception 'product_inactive' using errcode = 'P0001',
        detail = jsonb_build_object('product', v_item.name)::text;
    end if;
    perform private.assert_quantity(v_item.quantity);
    if v_item.unit_price < 0 or v_item.unit_price <> round(v_item.unit_price, 2)
       or v_item.unit_price >= 1000000000000 then
      raise exception 'invalid_price' using errcode = '22023';
    end if;
    if v_item.quantity > v_item.available then
      raise exception 'insufficient_stock' using errcode = 'P0001',
        detail = jsonb_build_object('product', v_item.name, 'available', v_item.available)::text;
    end if;
    v_subtotal := v_subtotal + round(v_item.quantity * v_item.unit_price, 2);
    v_cost := v_cost + round(v_item.quantity * v_item.average_cost, 2);
  end loop;

  if p_discount > v_subtotal then
    raise exception 'invalid_discount' using errcode = '22023';
  end if;

  -- Consecutivo por negocio (serializado solo para asignar el número).
  perform pg_advisory_xact_lock(hashtextextended('sale_number:' || p_business_id::text, 0));
  select coalesce(max(number), 0) + 1 into v_number from public.sales where business_id = p_business_id;
  select currency into v_currency from public.businesses where id = p_business_id;

  begin
    insert into public.sales (
      business_id, number, payment_method, subtotal, discount_total, total, cost_total,
      currency, note, idempotency_key, created_by
    )
    values (
      p_business_id, v_number, p_payment_method, v_subtotal, p_discount, v_subtotal - p_discount,
      v_cost, v_currency, v_note, p_idempotency_key, v_uid
    )
    returning id into v_sale_id;
  exception when unique_violation then
    -- Otra petición con la misma clave terminó primero.
    select id into v_sale_id from public.sales
    where business_id = p_business_id and idempotency_key = p_idempotency_key;
    if v_sale_id is null then
      raise;
    end if;
    return v_sale_id;
  end;

  insert into public.sale_items (
    business_id, sale_id, product_id, product_name, unit, quantity, unit_price, unit_cost,
    line_total, line_cost
  )
  select p_business_id, v_sale_id, l.product_id, p.name, p.unit, l.quantity,
         coalesce(l.unit_price, p.sale_price), b.average_cost,
         round(l.quantity * coalesce(l.unit_price, p.sale_price), 2),
         round(l.quantity * b.average_cost, 2)
  from pg_temp.sale_lines l
  join public.products p on p.business_id = p_business_id and p.id = l.product_id
  join public.inventory_balances b on b.business_id = p_business_id and b.product_id = l.product_id;

  insert into public.stock_movements (
    business_id, product_id, movement_type, quantity_delta, unit_cost,
    balance_after, average_cost_after, reference_type, reference_id, reason, created_by
  )
  select p_business_id, l.product_id, 'sale', -l.quantity, b.average_cost,
         b.quantity - l.quantity, b.average_cost, 'sale', v_sale_id,
         'Venta ' || v_number, v_uid
  from pg_temp.sale_lines l
  join public.inventory_balances b on b.business_id = p_business_id and b.product_id = l.product_id;

  update public.inventory_balances b
  set quantity = b.quantity - l.quantity, updated_at = now()
  from pg_temp.sale_lines l
  where b.business_id = p_business_id and b.product_id = l.product_id;

  return v_sale_id;
end;
$$;

-- Anula la venta y devuelve las existencias al costo con que salieron. Repetir
-- la anulación no hace nada. Solo dueño o administrador.
create function public.cancel_sale(p_business_id uuid, p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_sale   public.sales;
  v_reason text;
begin
  perform private.assert_can_write(p_business_id, array['owner', 'admin']::public.member_role[]);

  select * into v_sale from public.sales
  where business_id = p_business_id and id = p_sale_id
  for update;
  if not found then
    raise exception 'sale_not_found' using errcode = 'P0002';
  end if;
  if v_sale.status = 'cancelled' then
    return;
  end if;

  v_reason := private.normalize_reason(p_reason);
  if v_reason is null then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;

  perform 1
  from public.inventory_balances b
  where b.business_id = p_business_id
    and b.product_id in (select product_id from public.sale_items where sale_id = p_sale_id)
  order by b.product_id
  for update;

  insert into public.stock_movements (
    business_id, product_id, movement_type, quantity_delta, unit_cost,
    balance_after, average_cost_after, reference_type, reference_id, reason, created_by
  )
  select p_business_id, i.product_id, 'sale_reversal', i.quantity, i.unit_cost,
         b.quantity + i.quantity,
         case when b.quantity = 0 then i.unit_cost
              else round((b.quantity * b.average_cost + i.quantity * i.unit_cost)
                         / (b.quantity + i.quantity), 4) end,
         'sale', p_sale_id, left('Venta ' || v_sale.number || ' anulada: ' || v_reason, 200), v_uid
  from public.sale_items i
  join public.inventory_balances b on b.business_id = p_business_id and b.product_id = i.product_id
  where i.sale_id = p_sale_id;

  update public.inventory_balances b
  set quantity = m.balance_after, average_cost = m.average_cost_after, updated_at = now()
  from public.stock_movements m
  where m.reference_type = 'sale' and m.reference_id = p_sale_id
    and m.movement_type = 'sale_reversal'
    and b.business_id = p_business_id and b.product_id = m.product_id;

  update public.sales
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid, cancel_reason = v_reason
  where id = p_sale_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reportes (security invoker: aplican la RLS de quien consulta)
-- ---------------------------------------------------------------------------

-- Rango de fechas [p_from, p_to] en la zona horaria del negocio.
create function public.sales_summary(p_business_id uuid, p_from date, p_to date)
returns table (
  sales_count     bigint,
  cancelled_count bigint,
  subtotal        numeric,
  discount_total  numeric,
  total           numeric,
  cost_total      numeric,
  gross_margin    numeric
)
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select (p_from::timestamp at time zone b.timezone) as since,
           ((p_to + 1)::timestamp at time zone b.timezone) as until
    from public.businesses b
    where b.id = p_business_id
  )
  select
    count(*) filter (where s.status = 'completed'),
    count(*) filter (where s.status = 'cancelled'),
    coalesce(sum(s.subtotal) filter (where s.status = 'completed'), 0),
    coalesce(sum(s.discount_total) filter (where s.status = 'completed'), 0),
    coalesce(sum(s.total) filter (where s.status = 'completed'), 0),
    coalesce(sum(s.cost_total) filter (where s.status = 'completed'), 0),
    coalesce(sum(s.total - s.cost_total) filter (where s.status = 'completed'), 0)
  from bounds
  left join public.sales s
    on s.business_id = p_business_id
   and s.created_at >= bounds.since
   and s.created_at < bounds.until;
$$;

-- Ingresos por producto antes del descuento general de la venta.
create function public.top_products(
  p_business_id uuid,
  p_from        date,
  p_to          date,
  p_limit       int default 10
)
returns table (
  product_id   uuid,
  product_name text,
  unit         text,
  quantity     numeric,
  revenue      numeric,
  cost         numeric
)
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select (p_from::timestamp at time zone b.timezone) as since,
           ((p_to + 1)::timestamp at time zone b.timezone) as until
    from public.businesses b
    where b.id = p_business_id
  )
  select i.product_id, max(p.name), max(p.unit), sum(i.quantity), sum(i.line_total), sum(i.line_cost)
  from bounds
  join public.sales s
    on s.business_id = p_business_id
   and s.status = 'completed'
   and s.created_at >= bounds.since
   and s.created_at < bounds.until
  join public.sale_items i on i.sale_id = s.id
  join public.products p on p.business_id = i.business_id and p.id = i.product_id
  group by i.product_id
  order by sum(i.line_total) desc, max(p.name)
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke execute on function
  public.create_sale(uuid, jsonb, uuid, text, numeric, text),
  public.cancel_sale(uuid, uuid, text),
  public.sales_summary(uuid, date, date),
  public.top_products(uuid, date, date, int)
from public, anon;

grant execute on function
  public.create_sale(uuid, jsonb, uuid, text, numeric, text),
  public.cancel_sale(uuid, uuid, text),
  public.sales_summary(uuid, date, date),
  public.top_products(uuid, date, date, int)
to authenticated;
