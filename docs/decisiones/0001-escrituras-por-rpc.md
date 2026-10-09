# 0001 — Se lee con RLS, se escribe con RPC

- **Estado:** aceptada
- **Fecha:** 2026-10-09

## Contexto

Cada negocio debe estar aislado de los demás, el stock debe ser consistente y la
suscripción vencida debe impedir cambios sin borrar datos. Si el navegador
escribe directamente en las tablas, estas reglas quedan repartidas entre
políticas RLS de INSERT/UPDATE, triggers y código del frontend.

## Decisión

- `anon` y `authenticated` solo tienen `SELECT` sobre tablas de `public`,
  filtrado por RLS con `private.is_member(business_id)`.
- Toda escritura pasa por funciones `SECURITY DEFINER` con `search_path = ''`
  que empiezan con `private.assert_can_write(business_id, roles)`.
- Los privilegios por defecto de `public` están revocados: una tabla o función
  nueva nace cerrada y la migración concede explícitamente lo que necesita.
- `supabase/tests/000_estructura.test.sql` falla si una tabla queda sin RLS, si
  alguien concede escritura directa o si una función privilegiada no fija
  `search_path`.

## Consecuencias

- La validación de membresía, rol y suscripción vive en un solo lugar.
- Las operaciones de varias tablas (venta + movimientos + saldo) son atómicas.
- Cada función `SECURITY DEFINER` es código sensible: necesita su prueba de
  aislamiento en `supabase/tests/`.
- Editar un dato simple (p. ej. el nombre del negocio) también requiere una
  función; es más código, pero mantiene la regla sin excepciones.
