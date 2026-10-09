# 0004 — Ventas: bloqueo ordenado, fotos de precio y costo, anulación compensatoria

- **Estado:** aceptada
- **Fecha:** 2026-10-09

## Contexto

El criterio de salida de la Fase 4 es que las ventas concurrentes no produzcan
descuadres de stock y que los reportes se reconcilien con los registros. El plan
pide además guardar el precio y el costo del momento, permitir anular con
trazabilidad y no presentar el módulo como facturación electrónica.

## Decisión

- **`create_sale` en una sola transacción:** valida los artículos, bloquea los
  saldos, comprueba las existencias, guarda la venta y sus artículos, crea los
  movimientos `sale` y descuenta el stock. Si algo falla, no queda nada.
- **Bloqueo en orden por `product_id`.** Dos ventas con los mismos productos,
  aunque los listen en distinto orden, esperan en vez de bloquearse mutuamente.
  `scripts/test-concurrencia.sh` lanza 20 ventas simultáneas sobre 6 unidades y
  exige 6 aceptadas, 14 rechazadas, cero deadlocks y stock final 0. Corre en CI.
- **Fotos (snapshots).** Cada artículo guarda el nombre, la unidad, el precio
  usado y el costo promedio del momento, además de `line_total` y `line_cost`.
  La venta guarda `subtotal`, `discount_total`, `total` y `cost_total`. Cambiar
  después el producto no altera ventas pasadas.
- **Precio editable por línea.** Por defecto es el precio de venta del producto;
  se puede cambiar (regateo, precio especial).
- **Descuento general** por venta, nunca mayor que el subtotal.
- **Medios de pago:** efectivo, transferencia, tarjeta, fiado y otro. "Fiado"
  solo etiqueta la venta: no hay cuentas por cobrar en el MVP.
- **Consecutivo por negocio** ("Venta 25"), asignado con un bloqueo de asesoría
  solo durante la asignación del número.
- **Idempotencia** con la clave que genera la pantalla al abrirse.
- **Anulación, no borrado.** `cancel_sale` (solo dueño o administrador) marca la
  venta como anulada con su motivo y devuelve cada artículo con un movimiento
  `sale_reversal` al costo con que salió, recalculando el promedio ponderado.
  Anular dos veces no hace nada.
- **Reportes** (`sales_summary`, `top_products`): funciones con
  `security invoker` (aplican RLS). El periodo se expresa en días del
  calendario del negocio y se convierte con su zona horaria. Solo cuentan las
  ventas no anuladas. "Margen bruto estimado" = total − costo de lo vendido; la
  pantalla aclara que no es utilidad neta.

## Consecuencias

- Las ventas del mismo negocio se serializan brevemente al asignar el número.
  Es aceptable para el volumen de un negocio pequeño.
- La anulación es total. Las devoluciones parciales (tipo `return`, ya
  reservado) quedan para después del piloto si se necesitan.
- Los ingresos por producto en "Más vendidos" son antes del descuento general
  de cada venta. La pantalla lo indica.
