-- Guardias estructurales: fallan si una migración futura olvida RLS,
-- concede escritura directa o deja una función privilegiada sin search_path.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'todas las tablas de public tienen RLS activado'
);

select is(
  (select count(*)
   from information_schema.role_table_grants
   where table_schema = 'public'
     and grantee in ('anon', 'authenticated')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')),
  0::bigint,
  'anon y authenticated no pueden escribir directamente en tablas de public'
);

select is(
  (select count(*)
   from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'),
  0::bigint,
  'anon no tiene ningún privilegio sobre tablas de public'
);

select is(
  (select count(*)
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private')
     and p.prosecdef
     and not exists (
       select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'
     )),
  0::bigint,
  'toda función SECURITY DEFINER fija su search_path'
);

select is(
  (select count(*)
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0::bigint,
  'anon no puede ejecutar funciones de public'
);

select * from finish();
rollback;
