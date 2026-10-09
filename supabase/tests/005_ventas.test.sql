-- Ventas y reportes (criterio de salida de la Fase 4): las ventas no producen
-- descuadres de stock y los reportes se reconcilian con los registros.
-- La concurrencia real se prueba en scripts/test-concurrencia.sh.
--
-- Usuarios:
--   A  dueño del negocio A
--   E  staff del negocio A
--   B  dueño del negocio B
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

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

create temporary table ids (name text primary key, id uuid) on commit drop;
insert into ids values
  ('arroz', public.create_product('aaaaaaaa-0000-0000-0000-00000000000b', 'Arroz', 2800,
     p_initial_quantity => 10, p_initial_unit_cost => 2000)),
  ('queso', public.create_product('aaaaaaaa-0000-0000-0000-00000000000b', 'Queso', 18000,
     p_unit => 'kg', p_initial_quantity => 2.5, p_initial_unit_cost => 13500)),
  ('agua', public.create_product('aaaaaaaa-0000-0000-0000-00000000000b', 'Agua', 1800));

create function pg_temp.id(p_name text) returns uuid language sql as
  $$ select id from ids where name = p_name $$;

-- ---------------------------------------------------------------------------
-- Venta
-- ---------------------------------------------------------------------------
insert into ids values ('venta1', public.create_sale(
  'aaaaaaaa-0000-0000-0000-00000000000b',
  jsonb_build_array(
    jsonb_build_object('product_id', pg_temp.id('arroz'), 'quantity', 3),
    jsonb_build_object('product_id', pg_temp.id('queso'), 'quantity', 0.5, 'unit_price', 17000)),
  '30000000-0000-0000-0000-000000000001',
  p_payment_method => 'transfer',
  p_discount => 400));

select is(
  (select row(number, status, payment_method, subtotal, discount_total, total, cost_total, currency)::text
   from public.sales where id = pg_temp.id('venta1')),
  -- 3 × 2800 + 0,5 × 17000 = 16.900; costo 3 × 2000 + 0,5 × 13500 = 12.750
  row(1, 'completed', 'transfer', 16900.00, 400.00, 16500.00, 12750.00, 'COP')::text,
  'la venta guarda totales, descuento, costo y moneda');
select is(
  (select row(product_name, quantity, unit_price, unit_cost, line_total, line_cost)::text
   from public.sale_items where sale_id = pg_temp.id('venta1') and product_id = pg_temp.id('queso')),
  row('Queso', 0.500, 17000.00, 13500.0000, 8500.00, 6750.00)::text,
  'cada artículo guarda la foto de nombre, precio usado y costo promedio');
select is((select quantity from public.inventory_balances where product_id = pg_temp.id('arroz')),
  7.000::numeric, 'una venta confirmada reduce el stock');
select is(
  (select row(movement_type::text, quantity_delta, reference_type, reason)::text
   from public.stock_movements
   where product_id = pg_temp.id('arroz') and movement_type = 'sale'),
  row('sale', -3.000, 'sale', 'Venta 1')::text,
  'la venta queda en el historial de cada producto');

select is(
  public.create_sale('aaaaaaaa-0000-0000-0000-00000000000b',
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.id('arroz'), 'quantity', 3)),
    '30000000-0000-0000-0000-000000000001'),
  pg_temp.id('venta1'), 'repetir la venta con la misma clave devuelve la misma venta');
select is((select quantity from public.inventory_balances where product_id = pg_temp.id('arroz')),
  7.000::numeric, 'una venta repetida reduce el stock una sola vez');

-- Cambiar el precio después no altera la venta registrada.
select public.update_product('aaaaaaaa-0000-0000-0000-00000000000b', pg_temp.id('arroz'),
  'Arroz premium', 3500);
select is((select row(product_name, unit_price)::text from public.sale_items
           where sale_id = pg_temp.id('venta1') and product_id = pg_temp.id('arroz')),
  row('Arroz', 2800.00)::text, 'los cambios de precio no alteran ventas pasadas');

-- ---------------------------------------------------------------------------
-- Validaciones (todo o nada)
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$ select public.create_sale('aaaaaaaa-0000-0000-0000-00000000000b',
       jsonb_build_array(
         jsonb_build_object('product_id', %L, 'quantity', 1),
         jsonb_build_object('product_id', %L, 'quantity', 99)),
       gen_random_uuid()) $$, pg_temp.id('arroz'), pg_temp.id('queso')),
  'P0001', 'insufficient_stock', 'no se vende más de lo disponible');
select is((select quantity from public.inventory_balances where product_id = pg_temp.id('arroz')),
  7.000::numeric, 'una venta fallida no deja movimientos parciales');
select is((select count(*) from public.sales), 1::bigint, 'una venta fallida no queda registrada');

select throws_ok(
  format($$ select public.create_sale('aaaaaaaa-0000-0000-0000-00000000000b',
       jsonb_build_array(jsonb_build_object('product_id', %L, 'quantity', 1)), gen_random_uuid()) $$,
    pg_temp.id('agua')),
  'P0001', 'insufficient_stock', 'un producto agotado no se puede vender');
select throws_ok(
  $$ select public.create_sale('aaaaaaaa-0000-0000-0000-00000000000b', '[]'::jsonb, gen_random_uuid()) $$,
  '22023', 'sale_empty', 'una venta necesita al menos un producto');
select throws_ok(
  format($$ select public.create_sale('aaaaaaaa-0000-0000-0000-00000000000b',
       jsonb_build_array(
         jsonb_build_object('product_id', %1$L, 'quantity', 1),
         jsonb_build_object('product_id', %1$L, 'quantity', 1)), gen_random_uuid()) $$,
    pg_temp.id('arroz')),
  '22023', 'sale_duplicate_item', 'un producto no se repite en la misma venta');
select throws_ok(
  format($$ select public.create_sale('aaaaaaaa-0000-0000-0000-00000000000b',
       jsonb_build_array(jsonb_build_object('product_id', %L, 'quantity', 1)), gen_random_uuid(),
       p_discount => 5000) $$, pg_temp.id('arroz')),
  '22023', 'invalid_discount', 'el descuento no puede superar el subtotal');
select throws_ok(
  format($$ select public.create_sale('aaaaaaaa-0000-0000-0000-00000000000b',
       jsonb_build_array(jsonb_build_object('product_id', %L, 'quantity', 0)), gen_random_uuid()) $$,
    pg_temp.id('arroz')),
  '22023', 'invalid_quantity', 'la cantidad debe ser positiva');
select throws_ok(
  format($$ select public.create_sale('aaaaaaaa-0000-0000-0000-00000000000b',
       jsonb_build_array(jsonb_build_object('product_id', %L, 'quantity', 1)), gen_random_uuid(),
       p_payment_method => 'bitcoin') $$, pg_temp.id('arroz')),
  '22023', 'invalid_payment_method', 'el medio de pago debe ser uno de los permitidos');
select throws_ok(
  $$ select public.create_sale('aaaaaaaa-0000-0000-0000-00000000000b',
       jsonb_build_array(jsonb_build_object('product_id', 'no-es-uuid', 'quantity', 1)), gen_random_uuid()) $$,
  '22023', 'sale_invalid_item', 'un artículo mal formado se rechaza');

-- Segunda venta para los reportes.
insert into ids values ('venta2', public.create_sale(
  'aaaaaaaa-0000-0000-0000-00000000000b',
  jsonb_build_array(jsonb_build_object('product_id', pg_temp.id('arroz'), 'quantity', 2)),
  '30000000-0000-0000-0000-000000000002'));
select is((select number from public.sales where id = pg_temp.id('venta2')), 2,
  'el consecutivo aumenta por negocio');

-- ---------------------------------------------------------------------------
-- Reportes
-- ---------------------------------------------------------------------------
select is(
  (select row(sales_count, cancelled_count, subtotal, discount_total, total, cost_total, gross_margin)::text
   from public.sales_summary('aaaaaaaa-0000-0000-0000-00000000000b', current_date - 1, current_date + 1)),
  -- Venta 2 a precio nuevo: 2 × 3500 = 7000; costo 2 × 2000 = 4000.
  row(2::bigint, 0::bigint, 23900.00, 400.00, 23500.00, 16750.00, 6750.00)::text,
  'el resumen suma ventas, descuentos, costo y margen bruto');
select is(
  (select row(subtotal, cost_total)::text
   from public.sales_summary('aaaaaaaa-0000-0000-0000-00000000000b', current_date - 1, current_date + 1)),
  (select row(sum(i.line_total), sum(i.line_cost))::text
   from public.sales s join public.sale_items i on i.sale_id = s.id where s.status = 'completed'),
  'el resumen cuadra con los artículos vendidos');
select is(
  (select row(sales_count, total)::text
   from public.sales_summary('aaaaaaaa-0000-0000-0000-00000000000b', current_date - 30, current_date - 2)),
  row(0::bigint, 0::numeric)::text, 'un periodo sin ventas da ceros');
select is(
  (select array_agg(row(product_name, quantity, revenue)::text order by revenue desc)
   from public.top_products('aaaaaaaa-0000-0000-0000-00000000000b', current_date, current_date)),
  array[row('Arroz premium', 5.000, 15400.00)::text, row('Queso', 0.500, 8500.00)::text],
  'los más vendidos se ordenan por ingresos');

-- ---------------------------------------------------------------------------
-- Anulación
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$ select public.cancel_sale('aaaaaaaa-0000-0000-0000-00000000000b', %L, '  ') $$,
    pg_temp.id('venta1')),
  '22023', 'invalid_reason', 'anular exige un motivo');

-- Entrada a otro costo para comprobar el promedio al devolver.
select public.record_stock_movement('aaaaaaaa-0000-0000-0000-00000000000b', pg_temp.id('arroz'),
  'purchase', 5, 2600);
-- Saldo arroz: 5 unidades a 2000 + 5 a 2600 → 10 a 2300.
select lives_ok(
  format($$ select public.cancel_sale('aaaaaaaa-0000-0000-0000-00000000000b', %L, 'Cliente devolvió') $$,
    pg_temp.id('venta1')),
  'el dueño puede anular una venta');
select is((select row(status, cancel_reason)::text from public.sales where id = pg_temp.id('venta1')),
  row('cancelled', 'Cliente devolvió')::text, 'la venta queda anulada con su motivo, sin borrarse');
select is((select row(quantity, average_cost)::text from public.inventory_balances
           where product_id = pg_temp.id('arroz')),
  -- (10 × 2300 + 3 × 2000) / 13 = 2230,7692
  row(13.000, 2230.7692)::text, 'el stock vuelve al costo con que salió');
select is(
  (select row(quantity_delta, unit_cost, reason)::text from public.stock_movements
   where product_id = pg_temp.id('arroz') and movement_type = 'sale_reversal'),
  row(3.000, 2000.0000, 'Venta 1 anulada: Cliente devolvió')::text,
  'la anulación queda como movimiento compensatorio');
select lives_ok(
  format($$ select public.cancel_sale('aaaaaaaa-0000-0000-0000-00000000000b', %L, 'Otra vez') $$,
    pg_temp.id('venta1')),
  'anular dos veces no falla');
select is((select count(*) from public.stock_movements where movement_type = 'sale_reversal'),
  2::bigint, 'anular dos veces no devuelve el stock dos veces');
select is(
  (select row(sales_count, cancelled_count, total)::text
   from public.sales_summary('aaaaaaaa-0000-0000-0000-00000000000b', current_date, current_date)),
  row(1::bigint, 1::bigint, 7000.00)::text, 'las ventas anuladas no cuentan en los reportes');
select is((select count(*) from public.stock_reconciliation), 0::bigint,
  'después de vender y anular, el saldo coincide con el historial');

-- ---------------------------------------------------------------------------
-- Permisos y aislamiento
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ update public.sales set total = 0 $$, '42501', null, 'nadie edita ventas directamente');
select throws_ok(
  $$ delete from public.sale_items $$, '42501', null, 'nadie borra artículos vendidos');

select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok(
  format($$ select public.create_sale('aaaaaaaa-0000-0000-0000-00000000000b',
       jsonb_build_array(jsonb_build_object('product_id', %L, 'quantity', 1)), gen_random_uuid()) $$,
    pg_temp.id('arroz')),
  'staff puede vender');
select throws_ok(
  format($$ select public.cancel_sale('aaaaaaaa-0000-0000-0000-00000000000b', %L, 'Error') $$,
    pg_temp.id('venta2')),
  '42501', 'forbidden', 'staff no puede anular ventas');

select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.sales), 0::bigint, 'B no ve las ventas de A');
select is((select count(*) from public.sale_items), 0::bigint, 'B no ve los artículos de A');
select is(
  (select sales_count from public.sales_summary('aaaaaaaa-0000-0000-0000-00000000000b',
     current_date - 1, current_date + 1)),
  0::bigint, 'B no obtiene reportes de A');
select throws_ok(
  format($$ select public.create_sale('bbbbbbbb-0000-0000-0000-00000000000b',
       jsonb_build_array(jsonb_build_object('product_id', %L, 'quantity', 1)), gen_random_uuid()) $$,
    pg_temp.id('arroz')),
  'P0002', 'product_not_found', 'B no puede vender un producto de A en su negocio');
select throws_ok(
  format($$ select public.cancel_sale('bbbbbbbb-0000-0000-0000-00000000000b', %L, 'X') $$,
    pg_temp.id('venta2')),
  'P0002', 'sale_not_found', 'B no puede anular una venta de A');

reset role;
set local role anon;
select throws_ok($$ select count(*) from public.sales $$, '42501', null, 'anon no puede leer ventas');

select * from finish();
rollback;
