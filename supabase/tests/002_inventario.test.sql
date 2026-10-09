-- Inventario (criterio de salida de la Fase 2): el stock es consistente y toda
-- modificación queda trazada.
--
-- Usuario A: dueño del negocio A (prueba vigente).
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@prueba.local');
insert into public.businesses (id, name) values
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'Tienda A');
insert into public.business_members (business_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner');
insert into public.subscriptions (business_id, status, trial_ends_at) values
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'trialing', now() + interval '7 days');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- Atajos para no repetir el id del negocio.
create temporary table ids (name text primary key, id uuid) on commit drop;

-- ---------------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------------
insert into ids values ('bebidas',
  public.create_category('aaaaaaaa-0000-0000-0000-00000000000b', '  Bebidas '));

select is((select name from public.categories where id = (select id from ids where name = 'bebidas')),
  'Bebidas', 'create_category guarda el nombre sin espacios sobrantes');
select throws_ok(
  $$ select public.create_category('aaaaaaaa-0000-0000-0000-00000000000b', 'BEBIDAS') $$,
  '23505', 'duplicate_category', 'no se repiten categorías aunque cambien mayúsculas');
select throws_ok(
  $$ select public.create_category('aaaaaaaa-0000-0000-0000-00000000000b', '  ') $$,
  '22023', 'invalid_category_name', 'create_category rechaza nombres vacíos');

-- ---------------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------------
insert into ids values ('gaseosa', public.create_product(
  p_business_id => 'aaaaaaaa-0000-0000-0000-00000000000b',
  p_name => 'Gaseosa 400 ml',
  p_sale_price => 2500,
  p_sku => 'GAS-400',
  p_category_id => (select id from ids where name = 'bebidas'),
  p_low_stock_threshold => 5));

select is((select count(*) from public.stock_movements), 0::bigint,
  'crear un producto sin existencias no inventa movimientos');
select is((select quantity from public.inventory_balances
           where product_id = (select id from ids where name = 'gaseosa')),
  0::numeric, 'el producto nace con saldo 0');
select is((select is_low_stock from public.product_overview
           where id = (select id from ids where name = 'gaseosa')),
  true, 'un producto agotado aparece con stock bajo');

insert into ids values ('arroz', public.create_product(
  p_business_id => 'aaaaaaaa-0000-0000-0000-00000000000b',
  p_name => 'Arroz',
  p_sale_price => 4200,
  p_unit => 'kg',
  p_initial_quantity => 10.5,
  p_initial_unit_cost => 3000,
  p_idempotency_key => '11111111-0000-0000-0000-000000000001'));

select is(
  (select row(movement_type::text, quantity_delta, unit_cost, balance_after)::text
   from public.stock_movements where product_id = (select id from ids where name = 'arroz')),
  row('initial', 10.500, 3000.0000, 10.500)::text,
  'las existencias iniciales quedan como movimiento initial con su costo');
select is((select row(quantity, average_cost)::text from public.inventory_balances
           where product_id = (select id from ids where name = 'arroz')),
  row(10.500, 3000.0000)::text, 'el saldo inicial toma cantidad y costo');

select is(
  public.create_product(
    p_business_id => 'aaaaaaaa-0000-0000-0000-00000000000b',
    p_name => 'Arroz',
    p_sale_price => 4200,
    p_unit => 'kg',
    p_initial_quantity => 10.5,
    p_initial_unit_cost => 3000,
    p_idempotency_key => '11111111-0000-0000-0000-000000000001'),
  (select id from ids where name = 'arroz'),
  'repetir create_product con la misma clave devuelve el mismo producto');
select is((select count(*) from public.products where name = 'Arroz'), 1::bigint,
  'el reintento no duplica el producto');
select is((select quantity from public.inventory_balances
           where product_id = (select id from ids where name = 'arroz')),
  10.500::numeric, 'el reintento no duplica las existencias');

select throws_ok(
  $$ select public.create_product('aaaaaaaa-0000-0000-0000-00000000000b', 'Otra', 100, p_sku => 'gas-400') $$,
  '23505', 'duplicate_sku', 'no se repite el SKU dentro del negocio (sin importar mayúsculas)');
select lives_ok(
  $$ select public.create_product('aaaaaaaa-0000-0000-0000-00000000000b', 'Gaseosa 400 ml', 2500) $$,
  'se permiten dos productos con el mismo nombre (no se asume que son el mismo)');
select throws_ok(
  $$ select public.create_product('aaaaaaaa-0000-0000-0000-00000000000b', 'Negativo', -1) $$,
  '22023', 'invalid_price', 'el precio no puede ser negativo');
select throws_ok(
  $$ select public.create_product('aaaaaaaa-0000-0000-0000-00000000000b', 'Centavos', 10.123) $$,
  '22023', 'invalid_price', 'el precio admite máximo 2 decimales');
select throws_ok(
  $$ select public.create_product('aaaaaaaa-0000-0000-0000-00000000000b', 'Sin costo', 100,
       p_initial_quantity => 5) $$,
  '22023', 'invalid_unit_cost', 'existencias iniciales sin costo se rechazan');
select throws_ok(
  $$ select public.create_product('aaaaaaaa-0000-0000-0000-00000000000b', 'Rara', 100, p_unit => 'galaxia') $$,
  '22023', 'invalid_unit', 'la unidad debe ser una de las permitidas');
select throws_ok(
  $$ select public.create_product('aaaaaaaa-0000-0000-0000-00000000000b', 'Huérfana', 100,
       p_category_id => gen_random_uuid()) $$,
  'P0002', 'category_not_found', 'la categoría debe existir en el mismo negocio');

select lives_ok(
  format($$ select public.update_product('aaaaaaaa-0000-0000-0000-00000000000b', %L,
       'Gaseosa 400 ml fría', 2800, 'unidad', ' GAS-400 ', null, %L, 6) $$,
    (select id from ids where name = 'gaseosa'), (select id from ids where name = 'bebidas')),
  'update_product cambia los datos descriptivos');
select is((select row(name, sale_price, sku, low_stock_threshold)::text from public.products
           where id = (select id from ids where name = 'gaseosa')),
  row('Gaseosa 400 ml fría', 2800.00, 'GAS-400', 6.000)::text, 'los cambios quedaron guardados');

-- ---------------------------------------------------------------------------
-- Entradas y costo promedio ponderado
-- ---------------------------------------------------------------------------
select lives_ok(
  format($$ select public.record_stock_movement('aaaaaaaa-0000-0000-0000-00000000000b', %L,
       'purchase', 10, 1000, 'Compra proveedor', '22222222-0000-0000-0000-000000000001') $$,
    (select id from ids where name = 'gaseosa')),
  'una entrada válida se registra');
select is((select row(quantity, average_cost)::text from public.inventory_balances
           where product_id = (select id from ids where name = 'gaseosa')),
  row(10.000, 1000.0000)::text, 'la primera entrada fija cantidad y costo');

select lives_ok(
  format($$ select public.record_stock_movement('aaaaaaaa-0000-0000-0000-00000000000b', %L,
       'purchase', 10, 1000, 'Compra proveedor', '22222222-0000-0000-0000-000000000001') $$,
    (select id from ids where name = 'gaseosa')),
  'repetir la entrada con la misma clave no falla');
select is((select quantity from public.inventory_balances
           where product_id = (select id from ids where name = 'gaseosa')),
  10.000::numeric, 'una operación repetida con la misma clave no duplica stock');

select lives_ok(
  format($$ select public.record_stock_movement('aaaaaaaa-0000-0000-0000-00000000000b', %L,
       'purchase', 5, 1300) $$,
    (select id from ids where name = 'gaseosa')),
  'segunda entrada con otro costo');
-- (10 × 1000 + 5 × 1300) / 15 = 1100
select is((select row(quantity, average_cost)::text from public.inventory_balances
           where product_id = (select id from ids where name = 'gaseosa')),
  row(15.000, 1100.0000)::text, 'el costo promedio se recalcula ponderado');

select throws_ok(
  format($$ select public.record_stock_movement('aaaaaaaa-0000-0000-0000-00000000000b', %L,
       'purchase', 5, null) $$, (select id from ids where name = 'gaseosa')),
  '22023', 'invalid_unit_cost', 'una entrada exige costo');
select throws_ok(
  format($$ select public.record_stock_movement('aaaaaaaa-0000-0000-0000-00000000000b', %L,
       'purchase', -5, 1000) $$, (select id from ids where name = 'gaseosa')),
  '22023', 'invalid_quantity', 'la cantidad debe ser positiva');
select throws_ok(
  format($$ select public.record_stock_movement('aaaaaaaa-0000-0000-0000-00000000000b', %L,
       'purchase', 1.0001, 1000) $$, (select id from ids where name = 'gaseosa')),
  '22023', 'invalid_quantity', 'la cantidad admite máximo 3 decimales');
select throws_ok(
  format($$ select public.record_stock_movement('aaaaaaaa-0000-0000-0000-00000000000b', %L,
       'sale', 1, 1000) $$, (select id from ids where name = 'gaseosa')),
  '22023', 'invalid_movement_type', 'las ventas no se registran por esta función');

-- ---------------------------------------------------------------------------
-- Salidas
-- ---------------------------------------------------------------------------
select lives_ok(
  format($$ select public.record_stock_movement('aaaaaaaa-0000-0000-0000-00000000000b', %L,
       'output', 3, null, 'Vencidas') $$, (select id from ids where name = 'gaseosa')),
  'una salida válida se registra');
select is(
  (select row(quantity_delta, unit_cost, balance_after, reason)::text from public.stock_movements
   where product_id = (select id from ids where name = 'gaseosa') and movement_type = 'output'),
  row(-3.000, 1100.0000, 12.000, 'Vencidas')::text,
  'la salida descuenta al costo promedio vigente y guarda el motivo');
select is((select average_cost from public.inventory_balances
           where product_id = (select id from ids where name = 'gaseosa')),
  1100.0000::numeric, 'una salida no cambia el costo promedio');

select throws_ok(
  format($$ select public.record_stock_movement('aaaaaaaa-0000-0000-0000-00000000000b', %L,
       'output', 12.001) $$, (select id from ids where name = 'gaseosa')),
  'P0001', 'insufficient_stock', 'no se puede sacar más de lo disponible');
select is((select quantity from public.inventory_balances
           where product_id = (select id from ids where name = 'gaseosa')),
  12.000::numeric, 'una salida rechazada no deja cambios parciales');

-- ---------------------------------------------------------------------------
-- Ajustes por conteo
-- ---------------------------------------------------------------------------
select lives_ok(
  format($$ select public.adjust_stock('aaaaaaaa-0000-0000-0000-00000000000b', %L, 9, 'Conteo físico') $$,
    (select id from ids where name = 'gaseosa')),
  'un ajuste deja el saldo en la cantidad contada');
select is(
  (select row(quantity_delta, balance_after)::text from public.stock_movements
   where product_id = (select id from ids where name = 'gaseosa') and movement_type = 'adjustment'),
  row(-3.000, 9.000)::text, 'el ajuste registra la diferencia');
select throws_ok(
  format($$ select public.adjust_stock('aaaaaaaa-0000-0000-0000-00000000000b', %L, 9, 'Otra vez') $$,
    (select id from ids where name = 'gaseosa')),
  'P0001', 'no_change', 'un ajuste sin diferencia se rechaza');
select throws_ok(
  format($$ select public.adjust_stock('aaaaaaaa-0000-0000-0000-00000000000b', %L, 20, '  ') $$,
    (select id from ids where name = 'gaseosa')),
  '22023', 'invalid_reason', 'un ajuste exige motivo');

-- ---------------------------------------------------------------------------
-- Archivar
-- ---------------------------------------------------------------------------
select lives_ok(
  format($$ select public.set_product_active('aaaaaaaa-0000-0000-0000-00000000000b', %L, false) $$,
    (select id from ids where name = 'gaseosa')),
  'un producto se puede archivar');
select throws_ok(
  format($$ select public.record_stock_movement('aaaaaaaa-0000-0000-0000-00000000000b', %L,
       'purchase', 1, 1000) $$, (select id from ids where name = 'gaseosa')),
  'P0001', 'product_inactive', 'un producto archivado no recibe entradas');
select is((select is_low_stock from public.product_overview
           where id = (select id from ids where name = 'gaseosa')),
  false, 'un producto archivado no genera alerta de stock bajo');

-- ---------------------------------------------------------------------------
-- Categoría eliminada y consistencia
-- ---------------------------------------------------------------------------
select lives_ok(
  format($$ select public.delete_category('aaaaaaaa-0000-0000-0000-00000000000b', %L) $$,
    (select id from ids where name = 'bebidas')),
  'el dueño puede borrar una categoría');
select is((select category_id from public.products where id = (select id from ids where name = 'gaseosa')),
  null, 'sus productos quedan sin categoría, sin borrarse');

select is((select count(*) from public.stock_reconciliation), 0::bigint,
  'el saldo de cada producto coincide con la suma de su historial');
select is(
  (select row(active_products, low_stock_products, stock_value)::text from public.inventory_summary),
  -- Activos: Arroz (10,5 × 3000 = 31.500) y la segunda Gaseosa (agotada).
  row(2::bigint, 1::bigint, 31500.00)::text,
  'el resumen cuenta productos activos, stock bajo y valor a costo');

select * from finish();
rollback;
