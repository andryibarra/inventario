-- Importación (criterio de salida de la Fase 3): una importación defectuosa no
-- daña ni duplica silenciosamente el inventario.
--
-- Usuarios:
--   A  dueño del negocio A
--   E  staff del negocio A
--   B  dueño del negocio B
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@prueba.local'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'e@prueba.local'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'b@prueba.local');
insert into public.businesses (id, name) values
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'Tienda A'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'Tienda B');
insert into public.business_members (business_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'eeeeeeee-0000-0000-0000-000000000001', 'staff'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000001', 'owner');
insert into public.subscriptions (business_id, status, trial_ends_at) values
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'trialing', now() + interval '7 days'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'trialing', now() + interval '7 days');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- Producto existente antes de importar.
select public.create_product('aaaaaaaa-0000-0000-0000-00000000000b', 'Gaseosa', 2500,
  p_sku => 'GAS-1', p_initial_quantity => 10, p_initial_unit_cost => 1000);

-- ---------------------------------------------------------------------------
-- Importación inicial: solo crear
-- ---------------------------------------------------------------------------
select is(
  public.import_products(
    'aaaaaaaa-0000-0000-0000-00000000000b',
    '10000000-0000-0000-0000-000000000001',
    'inventario.xlsx',
    '[
      {"row": 2, "name": "Arroz", "sale_price": 4200, "unit": "kg", "cost": 3000, "quantity": 10.5, "category": "Granos"},
      {"row": 3, "name": "Frijol", "sale_price": 6000, "unit": "kg", "quantity": 4, "category": "granos"},
      {"row": 4, "name": "Jabón", "sale_price": 3500, "sku": "JAB-1", "low_stock_threshold": 3},
      {"row": 5, "name": "Gaseosa grande", "sale_price": 9999, "sku": "gas-1", "quantity": 99}
    ]'::jsonb,
    p_rows_total => 6, p_rows_invalid => 2) - 'import_id',
  '{"rows_total": 6, "rows_created": 3, "rows_updated": 0, "rows_stock_adjusted": 0,
    "rows_skipped": 3, "already_imported": false}'::jsonb,
  'crea los nuevos y omite el existente (y cuenta las filas inválidas como omitidas)');

select is((select count(*) from public.products), 4::bigint, 'quedan 4 productos');
select is((select count(*) from public.categories), 1::bigint,
  'las categorías se crean una sola vez sin importar mayúsculas');
select is((select row(name, sale_price)::text from public.products where sku = 'GAS-1'),
  row('Gaseosa', 2500.00)::text, 'sin permiso explícito no se modifica el producto existente');
select is((select quantity from public.product_overview where sku = 'GAS-1'),
  10.000::numeric, 'sin permiso explícito no se tocan sus existencias');
select is((select row(quantity, average_cost)::text from public.product_overview where name = 'Arroz'),
  row(10.500, 3000.0000)::text, 'las existencias iniciales entran con su costo');
select is((select average_cost from public.product_overview where name = 'Frijol'),
  0.0000::numeric, 'sin costo en el archivo el costo queda en 0');
select is(
  (select count(*) from public.stock_movements
   where reference_type = 'import' and reference_id = '10000000-0000-0000-0000-000000000001'),
  2::bigint, 'los movimientos quedan ligados a la importación');
select is((select count(*) from public.stock_movements m join public.products p on p.id = m.product_id
           where p.name = 'Jabón'), 0::bigint,
  'un producto importado sin cantidad no inventa movimientos');

-- ---------------------------------------------------------------------------
-- Reintento con el mismo id
-- ---------------------------------------------------------------------------
select is(
  public.import_products(
    'aaaaaaaa-0000-0000-0000-00000000000b',
    '10000000-0000-0000-0000-000000000001',
    'inventario.xlsx',
    '[{"row": 2, "name": "Arroz", "sale_price": 4200, "quantity": 10.5, "cost": 3000}]'::jsonb
  ) ->> 'already_imported',
  'true', 'un reintento devuelve el resumen guardado');
select is((select count(*) from public.products), 4::bigint, 'el reintento no duplica productos');
select is((select quantity from public.product_overview where name = 'Arroz'),
  10.500::numeric, 'el reintento no duplica existencias');
select is((select count(*) from public.imports), 1::bigint, 'queda registrada una sola importación');

-- ---------------------------------------------------------------------------
-- Todo o nada
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.import_products(
       'aaaaaaaa-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000002', 'malo.csv',
       '[{"row": 2, "name": "Azúcar", "sale_price": 3000},
         {"row": 7, "name": "Sal", "sale_price": -1}]'::jsonb) $$,
  'P0001', 'import_row_failed', 'una fila inválida hace fallar la importación');
select is((select count(*) from public.products where name = 'Azúcar'), 0::bigint,
  'una importación fallida no deja productos a medias');
select is((select count(*) from public.imports), 1::bigint,
  'una importación fallida no queda registrada');

create temporary table err (detail text) on commit drop;
do $$
declare
  v_detail text;
begin
  perform public.import_products(
    'aaaaaaaa-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000003', 'malo.csv',
    '[{"row": 2, "name": "Azúcar", "sale_price": 3000},
      {"row": 9, "name": "Sal", "sale_price": 2000, "unit": "bulto"}]'::jsonb);
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  insert into err values (v_detail);
end;
$$;
select is((select detail::jsonb from err),
  '{"row": 9, "error": "invalid_unit"}'::jsonb,
  'el error indica la fila y el motivo');

select throws_ok(
  $$ select public.import_products('aaaaaaaa-0000-0000-0000-00000000000b',
       '10000000-0000-0000-0000-000000000004', 'vacio.csv', '[]'::jsonb) $$,
  '22023', 'import_empty', 'un archivo sin filas se rechaza');
select throws_ok(
  format($$ select public.import_products('aaaaaaaa-0000-0000-0000-00000000000b',
       '10000000-0000-0000-0000-000000000005', 'enorme.csv', %L::jsonb) $$,
    (select jsonb_agg(jsonb_build_object('row', i, 'name', 'P' || i, 'sale_price', 1))
     from generate_series(1, 2001) i)),
  '22023', 'import_too_many_rows', 'un archivo demasiado grande se rechaza de forma controlada');
select throws_ok(
  $$ select public.import_products('aaaaaaaa-0000-0000-0000-00000000000b',
       '10000000-0000-0000-0000-000000000006', 'x.csv',
       '[{"row": 2, "name": "X", "sale_price": 1}]'::jsonb, p_adjust_stock => true) $$,
  '22023', 'import_invalid_options', 'reemplazar existencias exige actualizar productos existentes');

-- ---------------------------------------------------------------------------
-- Actualizar existentes (con confirmación explícita)
-- ---------------------------------------------------------------------------
select is(
  public.import_products(
    'aaaaaaaa-0000-0000-0000-00000000000b',
    '10000000-0000-0000-0000-000000000007',
    'precios.csv',
    '[{"row": 2, "sku": "GAS-1", "sale_price": 2800, "quantity": 7},
      {"row": 3, "sku": "JAB-1", "name": "Jabón Rey", "category": "Aseo"}]'::jsonb,
    p_update_existing => true) - 'import_id',
  '{"rows_total": 2, "rows_created": 0, "rows_updated": 2, "rows_stock_adjusted": 0,
    "rows_skipped": 0, "already_imported": false}'::jsonb,
  'con permiso explícito actualiza los existentes');
select is((select row(name, sale_price)::text from public.products where sku = 'GAS-1'),
  row('Gaseosa', 2800.00)::text, 'cambia solo lo que trae el archivo');
select is((select row(name, sale_price, low_stock_threshold, category_name)::text
           from public.product_overview where sku = 'JAB-1'),
  row('Jabón Rey', 3500.00, 3.000, 'Aseo')::text, 'lo que no trae el archivo se conserva');
select is((select quantity from public.product_overview where sku = 'GAS-1'),
  10.000::numeric, 'actualizar datos no reemplaza existencias');

select is(
  (public.import_products(
    'aaaaaaaa-0000-0000-0000-00000000000b',
    '10000000-0000-0000-0000-000000000008',
    'conteo.csv',
    '[{"row": 2, "sku": "GAS-1", "quantity": 7}, {"row": 3, "sku": "JAB-1", "quantity": 0}]'::jsonb,
    p_update_existing => true, p_adjust_stock => true)) ->> 'rows_stock_adjusted',
  '1', 'reemplazar existencias ajusta solo las que cambian');
select is(
  (select row(m.movement_type::text, m.quantity_delta, m.reason)::text
   from public.stock_movements m join public.products p on p.id = m.product_id
   where p.sku = 'GAS-1' and m.reference_id = '10000000-0000-0000-0000-000000000008'),
  row('adjustment', -3.000, 'Importación: conteo.csv')::text,
  'el reemplazo queda como ajuste trazable');

select is(
  (public.import_products(
    'aaaaaaaa-0000-0000-0000-00000000000b',
    '10000000-0000-0000-0000-000000000009',
    'ambiguo.csv',
    '[{"row": 2, "sku": "GAS-1", "barcode": "770"}]'::jsonb,
    p_update_existing => true)) ->> 'rows_updated',
  '1', 'un código de barras nuevo se agrega al producto que coincide por referencia');
select throws_ok(
  $$ select public.import_products('aaaaaaaa-0000-0000-0000-00000000000b',
       '10000000-0000-0000-0000-000000000010', 'ambiguo.csv',
       '[{"row": 2, "sku": "JAB-1", "barcode": "770"}]'::jsonb, p_update_existing => true) $$,
  'P0001', 'import_row_failed', 'referencia y código de dos productos distintos se rechaza');

select is((select count(*) from public.stock_reconciliation), 0::bigint,
  'después de importar, el saldo coincide con el historial');

-- ---------------------------------------------------------------------------
-- Permisos y aislamiento
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$ select public.import_products('aaaaaaaa-0000-0000-0000-00000000000b',
       '10000000-0000-0000-0000-000000000011', 'x.csv', '[{"row": 2, "name": "X", "sale_price": 1}]'::jsonb) $$,
  '42501', 'forbidden', 'staff no puede importar');

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.imports), 0::bigint, 'B no ve las importaciones de A');
select throws_ok(
  $$ select public.import_products('bbbbbbbb-0000-0000-0000-00000000000b',
       '10000000-0000-0000-0000-000000000001', 'robo.csv', '[{"row": 2, "name": "X", "sale_price": 1}]'::jsonb) $$,
  '22023', 'invalid_import_id', 'B no puede leer el resumen de una importación de A reutilizando su id');

select * from finish();
rollback;
