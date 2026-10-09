-- Fase 3 — Importación de productos desde Excel/CSV.
--
-- El archivo se lee en el navegador (ver docs/decisiones/0003-importacion.md):
-- el servidor nunca abre archivos Office. Llegan filas ya extraídas en JSON y
-- aquí se vuelven a validar todas.
--
--   * Todo o nada: si una fila falla, la importación completa se revierte y el
--     error indica el número de fila.
--   * Idempotente: el navegador genera el id de la importación. Repetirla
--     devuelve el resumen guardado sin volver a crear nada.
--   * Por defecto solo crea productos nuevos. Actualizar los existentes y
--     reemplazar sus existencias son opciones explícitas y separadas.
--   * Un producto existe si coincide su referencia (SKU) o su código de barras.
--     El nombre por sí solo no identifica un producto.

-- ---------------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------------

create table public.imports (
  id                  uuid primary key,
  business_id         uuid not null references public.businesses (id) on delete cascade,
  created_by          uuid references auth.users (id) on delete set null,
  file_name           text not null check (length(file_name) between 1 and 200),
  update_existing     boolean not null,
  adjust_stock        boolean not null,
  status              text not null default 'processing' check (status in ('processing', 'completed')),
  rows_total          int not null default 0 check (rows_total >= 0),
  rows_created        int not null default 0 check (rows_created >= 0),
  rows_updated        int not null default 0 check (rows_updated >= 0),
  rows_stock_adjusted int not null default 0 check (rows_stock_adjusted >= 0),
  rows_skipped        int not null default 0 check (rows_skipped >= 0),
  created_at          timestamptz not null default now(),
  finished_at         timestamptz
);

create index imports_business_idx on public.imports (business_id, created_at desc);

alter table public.imports enable row level security;
revoke all on public.imports from anon, authenticated;
grant select on public.imports to authenticated;

create policy imports_select on public.imports
  for select to authenticated
  using ((select private.is_member(business_id)));

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

-- Devuelve la categoría con ese nombre (sin distinguir mayúsculas) o la crea.
create function private.ensure_category(p_business_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_id   uuid;
begin
  if v_name is null or v_name = '' then
    return null;
  end if;
  if length(v_name) > 60 then
    raise exception 'invalid_category_name' using errcode = '22023';
  end if;

  insert into public.categories (business_id, name)
  values (p_business_id, v_name)
  on conflict (business_id, lower(name)) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.categories
    where business_id = p_business_id and lower(name) = lower(v_name);
  end if;
  return v_id;
end;
$$;

create function private.import_summary(p public.imports, p_already_imported boolean)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'import_id', p.id,
    'rows_total', p.rows_total,
    'rows_created', p.rows_created,
    'rows_updated', p.rows_updated,
    'rows_stock_adjusted', p.rows_stock_adjusted,
    'rows_skipped', p.rows_skipped,
    'already_imported', p_already_imported
  );
$$;

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

-- p_rows: arreglo de objetos con las claves
--   row (número de fila en el archivo, para los mensajes de error),
--   name, sku, barcode, category, unit, sale_price, cost, quantity,
--   low_stock_threshold.
-- Una clave ausente o null significa "el archivo no trae ese dato".
--
-- p_rows_total y p_rows_invalid son informativos (filas del archivo y filas
-- descartadas en la vista previa) y solo alimentan el resumen.
create function public.import_products(
  p_business_id     uuid,
  p_import_id       uuid,
  p_file_name       text,
  p_rows            jsonb,
  p_update_existing boolean default false,
  p_adjust_stock    boolean default false,
  p_rows_total      int default null,
  p_rows_invalid    int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_import    public.imports;
  v_file_name text := left(nullif(btrim(p_file_name), ''), 200);
  v_row       jsonb;
  v_row_no    int;
  v_sku       text;
  v_barcode   text;
  v_match     public.products;
  v_by_sku    uuid;
  v_by_code   uuid;
  v_category  uuid;
  v_quantity  numeric;
  v_balance   numeric;
  v_product   uuid;
  v_movement  uuid;
  v_created   int := 0;
  v_updated   int := 0;
  v_adjusted  int := 0;
  v_skipped   int := 0;
begin
  perform private.assert_can_write(p_business_id, array['owner', 'admin']::public.member_role[]);

  if p_import_id is null then
    raise exception 'invalid_import_id' using errcode = '22023';
  end if;

  -- Reintento de una importación ya hecha: devolver lo que se hizo.
  select * into v_import from public.imports where id = p_import_id;
  if found then
    if v_import.business_id <> p_business_id then
      raise exception 'invalid_import_id' using errcode = '22023';
    end if;
    return private.import_summary(v_import, true);
  end if;

  if v_file_name is null then
    raise exception 'invalid_file_name' using errcode = '22023';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'import_empty' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'import_too_many_rows' using errcode = '22023';
  end if;
  if p_adjust_stock and not coalesce(p_update_existing, false) then
    raise exception 'import_invalid_options' using errcode = '22023';
  end if;

  begin
    insert into public.imports (id, business_id, created_by, file_name, update_existing, adjust_stock)
    values (p_import_id, p_business_id, (select auth.uid()), v_file_name,
            coalesce(p_update_existing, false), coalesce(p_adjust_stock, false))
    returning * into v_import;
  exception when unique_violation then
    -- Otra petición con el mismo id terminó primero.
    select * into v_import from public.imports where id = p_import_id;
    if v_import.business_id <> p_business_id then
      raise exception 'invalid_import_id' using errcode = '22023';
    end if;
    return private.import_summary(v_import, true);
  end;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_row_no := case when jsonb_typeof(v_row -> 'row') = 'number'
                     then floor((v_row ->> 'row')::numeric)::int else 0 end;
    begin
      if jsonb_typeof(v_row) <> 'object' then
        raise exception 'import_invalid_row' using errcode = '22023';
      end if;

      v_sku := nullif(btrim(v_row ->> 'sku'), '');
      v_barcode := nullif(btrim(v_row ->> 'barcode'), '');
      v_quantity := (v_row ->> 'quantity')::numeric;

      select id into v_by_sku from public.products
      where business_id = p_business_id and v_sku is not null and lower(sku) = lower(v_sku);
      select id into v_by_code from public.products
      where business_id = p_business_id and v_barcode is not null and barcode = v_barcode;

      if v_by_sku is not null and v_by_code is not null and v_by_sku <> v_by_code then
        raise exception 'import_ambiguous_match' using errcode = 'P0001';
      end if;
      v_product := coalesce(v_by_sku, v_by_code);

      if v_product is null then
        -- Producto nuevo.
        v_category := private.ensure_category(p_business_id, v_row ->> 'category');
        if v_row ->> 'sale_price' is null then
          raise exception 'invalid_price' using errcode = '22023';
        end if;
        v_product := public.create_product(
          p_business_id         => p_business_id,
          p_name                => v_row ->> 'name',
          p_sale_price          => (v_row ->> 'sale_price')::numeric,
          p_unit                => coalesce(v_row ->> 'unit', 'unidad'),
          p_sku                 => v_sku,
          p_barcode             => v_barcode,
          p_category_id         => v_category,
          p_low_stock_threshold => coalesce((v_row ->> 'low_stock_threshold')::numeric, 0),
          p_initial_quantity    => coalesce(v_quantity, 0),
          -- Sin costo en el archivo: se registra en 0 (la ganancia no se podrá estimar).
          p_initial_unit_cost   => coalesce((v_row ->> 'cost')::numeric, 0)
        );
        update public.stock_movements
        set reference_type = 'import', reference_id = p_import_id,
            reason = 'Existencias iniciales (importación)'
        where business_id = p_business_id and product_id = v_product and movement_type = 'initial';
        v_created := v_created + 1;

      elsif not coalesce(p_update_existing, false) then
        v_skipped := v_skipped + 1;

      else
        -- Producto existente: lo que el archivo no trae se conserva.
        select * into v_match from public.products where id = v_product;
        v_category := coalesce(
          private.ensure_category(p_business_id, v_row ->> 'category'), v_match.category_id);
        perform public.update_product(
          p_business_id         => p_business_id,
          p_product_id          => v_product,
          p_name                => coalesce(v_row ->> 'name', v_match.name),
          p_sale_price          => coalesce((v_row ->> 'sale_price')::numeric, v_match.sale_price),
          p_unit                => coalesce(v_row ->> 'unit', v_match.unit),
          p_sku                 => coalesce(v_sku, v_match.sku),
          p_barcode             => coalesce(v_barcode, v_match.barcode),
          p_category_id         => v_category,
          p_low_stock_threshold => coalesce(
            (v_row ->> 'low_stock_threshold')::numeric, v_match.low_stock_threshold)
        );
        v_updated := v_updated + 1;

        if p_adjust_stock and v_quantity is not null then
          select quantity into v_balance from public.inventory_balances
          where business_id = p_business_id and product_id = v_product;
          if v_balance <> v_quantity then
            v_movement := public.adjust_stock(
              p_business_id, v_product, v_quantity, left('Importación: ' || v_file_name, 200));
            update public.stock_movements
            set reference_type = 'import', reference_id = p_import_id
            where id = v_movement;
            v_adjusted := v_adjusted + 1;
          end if;
        end if;
      end if;
    exception when others then
      -- Revierte toda la importación e indica qué fila falló y por qué.
      raise exception 'import_row_failed' using
        errcode = 'P0001',
        detail = jsonb_build_object('row', v_row_no, 'error', sqlerrm)::text;
    end;
  end loop;

  update public.imports
  set status = 'completed',
      rows_total = greatest(coalesce(p_rows_total, 0), jsonb_array_length(p_rows)),
      rows_created = v_created,
      rows_updated = v_updated,
      rows_stock_adjusted = v_adjusted,
      rows_skipped = v_skipped + greatest(coalesce(p_rows_invalid, 0), 0),
      finished_at = now()
  where id = p_import_id
  returning * into v_import;

  return private.import_summary(v_import, false);
end;
$$;

revoke execute on all functions in schema private from public;
grant execute on function private.is_member(uuid) to authenticated;

revoke execute on function
  public.import_products(uuid, uuid, text, jsonb, boolean, boolean, int, int)
from public, anon;
grant execute on function
  public.import_products(uuid, uuid, text, jsonb, boolean, boolean, int, int)
to authenticated;
