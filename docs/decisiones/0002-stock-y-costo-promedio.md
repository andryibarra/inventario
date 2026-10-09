# 0002 — Saldo materializado y costo promedio ponderado

- **Estado:** aceptada
- **Fecha:** 2026-10-09

## Contexto

El criterio de salida de la Fase 2 es que el stock sea consistente y que toda
modificación quede trazada. El plan pide elegir y documentar un método de costo
(decisión abierta D9) y evitar que dos operaciones simultáneas dejen el stock
negativo o dupliquen una entrada.

## Decisión

- **Saldo materializado.** `inventory_balances` guarda cantidad y costo promedio
  por producto. Solo lo modifican las funciones `create_product`,
  `record_stock_movement` y `adjust_stock`, que bloquean la fila con
  `FOR UPDATE` y escriben el saldo y el movimiento en la misma transacción.
- **Historial inmutable.** `stock_movements` no se actualiza ni se borra (nadie
  tiene permiso). Una corrección es un movimiento nuevo de tipo `adjustment`.
  Cada movimiento guarda el saldo y el costo promedio resultantes.
- **Reconciliación.** La vista `stock_reconciliation` lista los productos cuyo
  saldo no coincide con la suma del historial. Una prueba pgTAP exige que esté
  vacía.
- **Costo promedio ponderado.** Solo las entradas (`purchase`, `initial`) lo
  recalculan: `(cantidad × promedio + entrada × costo) / cantidad nueva`,
  redondeado a 4 decimales. Salidas y ajustes salen al promedio vigente y no lo
  cambian. Si el saldo estaba en 0, el promedio pasa a ser el costo de la entrada.
- **Idempotencia.** Los formularios generan una clave (UUID) al abrirse. Si la
  misma petición llega dos veces, la función devuelve el registro ya creado sin
  repetir el efecto (índices únicos parciales por negocio).
- **Productos archivados, no borrados.** Un producto con historial no se elimina.
  Al archivarlo deja de recibir entradas y salidas y sale de las alertas. Sí
  admite ajustes (para dejarlo en cero).
- **Stock bajo.** `cantidad <= umbral` en productos activos. Con umbral 0 la
  alerta salta solo cuando el producto se agota.
- **Ventas.** Los tipos `sale`, `sale_reversal` y `return` quedan reservados para
  la Fase 4. `record_stock_movement` los rechaza.

## Consecuencias

- Leer existencias es barato (una fila por producto) y no depende de sumar el
  historial.
- Las operaciones sobre un mismo producto se serializan. Para un negocio pequeño
  la contención es despreciable.
- Si en el futuro se cambia a FIFO, el historial tiene la información necesaria
  (cantidad y costo por movimiento) para recalcular.
- Los números del frontend son solo de presentación. Los cálculos de dinero se
  hacen en la base de datos con `numeric`.
- Las exportaciones CSV usan `;` y coma decimal, para que Excel en español las
  abra bien con doble clic.
