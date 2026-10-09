-- Aislamiento del inventario entre negocios.
--
-- Usuarios:
--   A  dueño del negocio A
--   B  dueño del negocio B (prueba vencida: solo lectura)
--   E  staff activo del negocio A
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@prueba.local'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'b@prueba.local'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'e@prueba.local');

insert into public.businesses (id, name) values
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'Tienda A'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'Tienda B');

insert into public.business_members (business_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'eeeeeeee-0000-0000-0000-000000000001', 'staff');

insert into public.subscriptions (business_id, status, trial_ends_at) values
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'trialing', now() + interval '7 days'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'trialing', now() - interval '1 day');

-- Datos de B creados como postgres (B ya no puede escribir).
insert into public.categories (id, business_id, name) values
  ('bbbbbbbb-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Cosas de B');
insert into public.products (id, business_id, name, sale_price) values
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Producto de B', 1000);
insert into public.inventory_balances (business_id, product_id, quantity, average_cost) values
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-0000000000f1', 5, 500);
insert into public.stock_movements
  (business_id, product_id, movement_type, quantity_delta, unit_cost, balance_after, average_cost_after)
values
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-0000000000f1',
   'initial', 5, 500, 5, 500);

-- La base de datos impide mezclar negocios aunque una función tuviera un error.
select throws_ok(
  $$ insert into public.products (business_id, name, category_id)
     values ('aaaaaaaa-0000-0000-0000-00000000000b', 'Mezcla', 'bbbbbbbb-0000-0000-0000-0000000000c1') $$,
  '23503', null, 'un producto de A no puede usar una categoría de B (FK compuesta)');
select throws_ok(
  $$ insert into public.stock_movements
       (business_id, product_id, movement_type, quantity_delta, unit_cost, balance_after, average_cost_after)
     values ('aaaaaaaa-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-0000000000f1',
             'purchase', 1, 1, 1, 1) $$,
  '23503', null, 'un movimiento de A no puede apuntar a un producto de B (FK compuesta)');

-- ---------------------------------------------------------------------------
-- Usuario A
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ select public.create_product('aaaaaaaa-0000-0000-0000-00000000000b', 'Producto de A', 100,
       p_initial_quantity => 3, p_initial_unit_cost => 50) $$,
  'A crea un producto en su negocio');

select is((select count(*) from public.products), 1::bigint, 'A solo ve sus productos');
select is((select count(*) from public.categories), 0::bigint, 'A no ve categorías de B');
select is((select count(*) from public.inventory_balances), 1::bigint, 'A solo ve sus saldos');
select is((select count(*) from public.stock_movements), 1::bigint, 'A solo ve sus movimientos');
select is((select count(*) from public.product_overview
           where business_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint,
  'la vista de productos respeta el aislamiento');
select is((select count(*) from public.movement_history
           where business_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint,
  'la vista de historial respeta el aislamiento');
select is((select count(*) from public.inventory_summary), 1::bigint,
  'el resumen solo incluye el negocio de A');

select throws_ok(
  $$ update public.inventory_balances set quantity = 999 $$,
  '42501', null, 'A no puede modificar saldos directamente');
select throws_ok(
  $$ insert into public.stock_movements
       (business_id, product_id, movement_type, quantity_delta, unit_cost, balance_after, average_cost_after)
     select business_id, id, 'purchase', 1, 1, 1, 1 from public.products $$,
  '42501', null, 'A no puede insertar movimientos directamente');
select throws_ok(
  $$ delete from public.stock_movements $$,
  '42501', null, 'A no puede borrar el historial');
select throws_ok(
  $$ update public.products set sale_price = 0 $$,
  '42501', null, 'A no puede editar productos sin pasar por la RPC');

select throws_ok(
  $$ select public.create_product('bbbbbbbb-0000-0000-0000-00000000000b', 'Intruso', 1) $$,
  '42501', 'forbidden', 'A no puede crear productos en B');
select throws_ok(
  $$ select public.update_product('bbbbbbbb-0000-0000-0000-00000000000b',
       'bbbbbbbb-0000-0000-0000-0000000000f1', 'Hackeado', 1) $$,
  '42501', 'forbidden', 'A no puede editar productos de B');
select throws_ok(
  $$ select public.update_product('aaaaaaaa-0000-0000-0000-00000000000b',
       'bbbbbbbb-0000-0000-0000-0000000000f1', 'Hackeado', 1) $$,
  'P0002', 'product_not_found', 'A no puede editar un producto de B usando su propio negocio');
select throws_ok(
  $$ select public.record_stock_movement('aaaaaaaa-0000-0000-0000-00000000000b',
       'bbbbbbbb-0000-0000-0000-0000000000f1', 'output', 1) $$,
  'P0002', 'product_not_found', 'A no puede mover stock de un producto de B con su negocio');
select throws_ok(
  $$ select public.adjust_stock('bbbbbbbb-0000-0000-0000-00000000000b',
       'bbbbbbbb-0000-0000-0000-0000000000f1', 0, 'Robo') $$,
  '42501', 'forbidden', 'A no puede ajustar stock de B');
select throws_ok(
  $$ select public.create_product('aaaaaaaa-0000-0000-0000-00000000000b', 'Mezcla', 1,
       p_category_id => 'bbbbbbbb-0000-0000-0000-0000000000c1') $$,
  'P0002', 'category_not_found', 'A no puede usar una categoría de B');
select throws_ok(
  $$ select public.delete_category('aaaaaaaa-0000-0000-0000-00000000000b',
       'bbbbbbbb-0000-0000-0000-0000000000c1') $$,
  'P0002', 'category_not_found', 'A no puede borrar una categoría de B');

-- ---------------------------------------------------------------------------
-- Usuario E (staff de A)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ select public.create_category('aaaaaaaa-0000-0000-0000-00000000000b', 'Aseo') $$,
  'staff puede crear categorías');
select throws_ok(
  $$ select public.delete_category('aaaaaaaa-0000-0000-0000-00000000000b',
       (select id from public.categories where name = 'Aseo')) $$,
  '42501', 'forbidden', 'staff no puede borrar categorías');

-- ---------------------------------------------------------------------------
-- Usuario B (prueba vencida)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$ select public.record_stock_movement('bbbbbbbb-0000-0000-0000-00000000000b',
       'bbbbbbbb-0000-0000-0000-0000000000f1', 'output', 1) $$,
  'P0001', 'subscription_inactive', 'B no puede mover stock con la prueba vencida');

select * from finish();
rollback;
