#!/usr/bin/env bash
# Prueba de concurrencia de ventas (criterio de salida de la Fase 4).
#
# Lanza ventas simultáneas, cada una en su propia conexión, contra el stock de
# dos productos. La mitad de las ventas lista los productos en orden inverso:
# si el bloqueo no fuera ordenado, aparecerían deadlocks.
#
# Comprueba que:
#   * se venden exactamente las unidades disponibles (ni una más),
#   * el stock termina en 0, nunca negativo,
#   * no hay deadlocks,
#   * el saldo cuadra con el historial.
#
# Requiere Supabase local encendido (npm run db:start). Los datos de prueba se
# crean con ids aleatorios y se borran al final.
#
# Todo corre dentro del contenedor de Postgres: abrir decenas de conexiones
# desde Windows agota la memoria del equipo de desarrollo.
set -euo pipefail

CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_inventario}"

docker exec -i "$CONTAINER" bash -s <<'INNER'
set -euo pipefail

SALES=20
STOCK=6

psql_db() {
  psql -U postgres -v ON_ERROR_STOP=1 -qtA "$@"
}

USER_ID=$(psql_db -c "select gen_random_uuid()")
BIZ_ID=$(psql_db -c "select gen_random_uuid()")
P1=$(psql_db -c "select gen_random_uuid()")
P2=$(psql_db -c "select gen_random_uuid()")
CLAIMS="{\"sub\":\"$USER_ID\",\"role\":\"authenticated\"}"
TMP=$(mktemp -d)

cleanup() {
  psql_db -c "delete from public.businesses where id = '$BIZ_ID'; delete from auth.users where id = '$USER_ID';" >/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT

psql_db >/dev/null <<SQL
insert into auth.users (id, email) values ('$USER_ID', 'concurrencia-$USER_ID@prueba.local');
insert into public.businesses (id, name) values ('$BIZ_ID', 'Concurrencia');
insert into public.business_members (business_id, user_id, role) values ('$BIZ_ID', '$USER_ID', 'owner');
insert into public.subscriptions (business_id, status, trial_ends_at)
  values ('$BIZ_ID', 'trialing', now() + interval '1 day');
begin;
set local role authenticated;
select set_config('request.jwt.claims', '$CLAIMS', true);
select public.create_product('$BIZ_ID', 'Producto 1', 1000, p_initial_quantity => $STOCK, p_initial_unit_cost => 500);
select public.create_product('$BIZ_ID', 'Producto 2', 2000, p_initial_quantity => $STOCK, p_initial_unit_cost => 900);
commit;
SQL

# create_product genera sus propios ids: se recuperan por nombre.
P1=$(psql_db -c "select id from public.products where business_id = '$BIZ_ID' and name = 'Producto 1'")
P2=$(psql_db -c "select id from public.products where business_id = '$BIZ_ID' and name = 'Producto 2'")

echo "Lanzando $SALES ventas simultáneas sobre $STOCK unidades de cada producto…"
for i in $(seq 1 "$SALES"); do
  if (( i % 2 )); then
    ITEMS="[{\"product_id\":\"$P1\",\"quantity\":1},{\"product_id\":\"$P2\",\"quantity\":1}]"
  else
    ITEMS="[{\"product_id\":\"$P2\",\"quantity\":1},{\"product_id\":\"$P1\",\"quantity\":1}]"
  fi
  (
    psql -U postgres -qtA >"$TMP/$i.out" 2>"$TMP/$i.err" <<SQL || true
begin;
set local role authenticated;
select set_config('request.jwt.claims', '$CLAIMS', true);
-- Pequeña pausa para que todas las conexiones lleguen a la vez al bloqueo.
select pg_sleep(0.2);
select public.create_sale('$BIZ_ID', '$ITEMS'::jsonb, gen_random_uuid());
commit;
SQL
  ) &
done
wait

OK=0; INSUFFICIENT=0; DEADLOCKS=0; OTHER=0
for i in $(seq 1 "$SALES"); do
  if grep -qE '^[0-9a-f-]{36}$' "$TMP/$i.out"; then OK=$((OK + 1))
  elif grep -q 'insufficient_stock' "$TMP/$i.err"; then INSUFFICIENT=$((INSUFFICIENT + 1))
  elif grep -q 'deadlock' "$TMP/$i.err"; then DEADLOCKS=$((DEADLOCKS + 1))
  else OTHER=$((OTHER + 1)); cat "$TMP/$i.err"
  fi
done

RESULT=$(psql_db -c "
  select (select count(*) from public.sales where business_id = '$BIZ_ID') || ' ' ||
         (select string_agg(quantity::text, ' ' order by product_id) from public.inventory_balances
          where business_id = '$BIZ_ID') || ' ' ||
         (select count(*) from public.stock_reconciliation where business_id = '$BIZ_ID')")
read -r SALES_DB Q1 Q2 DIFF <<<"$RESULT"

echo "Ventas aceptadas: $OK · rechazadas por stock: $INSUFFICIENT · deadlocks: $DEADLOCKS · otros errores: $OTHER"
echo "Ventas guardadas: $SALES_DB · stock final: $Q1 y $Q2 · diferencias con el historial: $DIFF"

FAIL=0
[[ "$OK" == "$STOCK" && "$SALES_DB" == "$STOCK" ]] || { echo "ERROR: se esperaban $STOCK ventas"; FAIL=1; }
[[ "$INSUFFICIENT" == "$((SALES - STOCK))" ]] || { echo "ERROR: se esperaban $((SALES - STOCK)) rechazos por stock"; FAIL=1; }
[[ "$DEADLOCKS" == "0" && "$OTHER" == "0" ]] || { echo "ERROR: hubo deadlocks u otros errores"; FAIL=1; }
[[ "$Q1" == "0.000" && "$Q2" == "0.000" ]] || { echo "ERROR: el stock debía terminar en 0"; FAIL=1; }
[[ "$DIFF" == "0" ]] || { echo "ERROR: el saldo no cuadra con el historial"; FAIL=1; }

if (( FAIL )); then exit 1; fi
echo "OK: la concurrencia no produce descuadres de stock."
INNER
