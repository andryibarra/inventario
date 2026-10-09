-- Aislamiento entre negocios (criterio de salida de la Fase 1).
--
-- Usuarios:
--   A  dueño del negocio A
--   B  dueño del negocio B (prueba vencida)
--   C  sin negocio
--   D  miembro REVOCADO del negocio A
--   E  staff activo del negocio A
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- ---------------------------------------------------------------------------
-- Datos (como postgres)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@prueba.local', '{"display_name":"Ana"}'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'b@prueba.local', '{}'),
  ('cccccccc-0000-0000-0000-000000000001', 'c@prueba.local', '{}'),
  ('dddddddd-0000-0000-0000-000000000001', 'd@prueba.local', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000001', 'e@prueba.local', '{}');

insert into public.businesses (id, name) values
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'Tienda A'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'Tienda B');

insert into public.business_members (business_id, user_id, role, status) values
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner', 'active'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000001', 'owner', 'active'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'dddddddd-0000-0000-0000-000000000001', 'admin', 'revoked'),
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'eeeeeeee-0000-0000-0000-000000000001', 'staff', 'active');

insert into public.subscriptions (business_id, status, trial_ends_at) values
  ('aaaaaaaa-0000-0000-0000-00000000000b', 'trialing', now() + interval '7 days'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'trialing', now() - interval '1 day');

select is(
  (select count(*) from public.profiles
   where id::text like '%-0000-0000-0000-000000000001'),
  5::bigint,
  'el trigger crea un perfil por cada usuario registrado'
);

select is(
  (select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'Ana',
  'el perfil toma display_name de los metadatos del registro'
);

-- ---------------------------------------------------------------------------
-- Usuario A
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.businesses), 1::bigint,
  'A solo ve un negocio');
select is((select count(*) from public.businesses
           where id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint,
  'A no ve el negocio B aunque lo pida por id');
select is((select count(*) from public.business_members
           where business_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint,
  'A no ve los miembros de B');
select is((select count(*) from public.subscriptions
           where business_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 0::bigint,
  'A no ve la suscripción de B');
select is((select count(*) from public.profiles), 1::bigint,
  'A solo ve su propio perfil');

select throws_ok(
  $$ update public.businesses set name = 'X' where id = 'aaaaaaaa-0000-0000-0000-00000000000b' $$,
  '42501', null, 'A no puede actualizar su negocio directamente (solo por RPC)');
select throws_ok(
  $$ insert into public.businesses (name) values ('Intrusa') $$,
  '42501', null, 'A no puede insertar negocios directamente');
select throws_ok(
  $$ insert into public.business_members (business_id, user_id, role)
     values ('bbbbbbbb-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner') $$,
  '42501', null, 'A no puede agregarse como miembro de B');
select throws_ok(
  $$ delete from public.business_members $$,
  '42501', null, 'A no puede borrar membresías');
select throws_ok(
  $$ update public.subscriptions set status = 'active' $$,
  '42501', null, 'A no puede modificar su suscripción');

select throws_ok(
  $$ select public.update_business('bbbbbbbb-0000-0000-0000-00000000000b', 'Hackeada') $$,
  '42501', 'forbidden', 'A no puede renombrar B por RPC');
select lives_ok(
  $$ select public.update_business('aaaaaaaa-0000-0000-0000-00000000000b', 'Tienda A2', 'minimercado') $$,
  'A puede renombrar su propio negocio por RPC');
select is((select name from public.businesses where id = 'aaaaaaaa-0000-0000-0000-00000000000b'),
  'Tienda A2', 'el cambio de nombre quedó guardado');
select throws_ok(
  $$ select public.update_business('aaaaaaaa-0000-0000-0000-00000000000b', 'Tienda A', null, 'Marte/Olimpo') $$,
  '22023', 'invalid_timezone', 'update_business rechaza zonas horarias inválidas');

select throws_ok(
  $$ select public.create_business('   ') $$,
  '22023', 'invalid_name', 'create_business rechaza nombres vacíos');
select lives_ok(
  $$ select public.create_business('Segunda tienda de A', 'belleza') $$,
  'A puede crear un segundo negocio');
select is((select count(*) from public.businesses), 2::bigint,
  'A ve sus dos negocios y ninguno ajeno');
select is(
  (select s.status::text from public.subscriptions s
   join public.businesses b on b.id = s.business_id
   where b.name = 'Segunda tienda de A'),
  'trialing',
  'el negocio nuevo empieza en prueba');

-- ---------------------------------------------------------------------------
-- Usuario B (prueba vencida)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.businesses), 1::bigint,
  'B ve su negocio aunque la prueba haya vencido (datos preservados)');
select throws_ok(
  $$ select public.update_business('bbbbbbbb-0000-0000-0000-00000000000b', 'Nuevo nombre') $$,
  'P0001', 'subscription_inactive', 'B no puede escribir con la prueba vencida');

-- ---------------------------------------------------------------------------
-- Usuario C (sin negocio)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.businesses), 0::bigint,
  'C no ve ningún negocio');

-- ---------------------------------------------------------------------------
-- Usuario D (membresía revocada en A)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.businesses), 0::bigint,
  'D pierde acceso a A al ser revocado');
select throws_ok(
  $$ select public.update_business('aaaaaaaa-0000-0000-0000-00000000000b', 'Revancha') $$,
  '42501', 'forbidden', 'D no puede escribir en A');

-- ---------------------------------------------------------------------------
-- Usuario E (staff de A)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$ select public.update_business('aaaaaaaa-0000-0000-0000-00000000000b', 'Por staff') $$,
  '42501', 'forbidden', 'staff no puede cambiar la configuración del negocio');

-- ---------------------------------------------------------------------------
-- Anónimo
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$ select count(*) from public.businesses $$,
  '42501', null, 'anon no puede leer negocios');
select throws_ok(
  $$ select public.create_business('Anónima') $$,
  '42501', null, 'anon no puede crear negocios');

select * from finish();
rollback;
