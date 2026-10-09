# 0003 — Importación: lectura en el navegador, confirmación explícita, todo o nada

- **Estado:** aceptada
- **Fecha:** 2026-10-09

## Contexto

La Fase 3 permite cargar el inventario desde Excel o CSV. El criterio de salida
es que una importación defectuosa no dañe ni duplique silenciosamente el
inventario. Los archivos vienen de los negocios y son datos no confiables.

## Decisión

- **El archivo se lee en el navegador.** SheetJS 0.20.3 (instalado desde
  `cdn.sheetjs.com`, la fuente oficial; la versión publicada en npm está
  desactualizada) extrae solo valores: no evalúa fórmulas ni ejecuta macros. Se
  carga de forma diferida, solo en la pantalla de importación. Los CSV se leen
  con un lector propio que detecta `;`, `,` o tabulador, y UTF-8 o Windows-1252.
- **El archivo no se guarda.** Al servidor llegan solo las filas extraídas
  (JSON). No hace falta Storage ni una política de retención de archivos para
  esta fase. El reporte de errores se genera en el navegador antes de confirmar.
- **Límites:** 5 MB por archivo y 2.000 filas por importación (también se
  verifican en la base de datos).
- **Columnas flexibles.** Se sugiere la relación entre columnas y datos según
  sinónimos ("PVP", "Existencias", "Cód. barras"…), y la persona la puede
  corregir.
- **Un producto existe solo si coincide su referencia o su código de barras.**
  Un nombre igual no basta: esas filas se marcan como "nombre repetido" y no se
  crean salvo que la persona lo pida.
- **Por defecto solo se crean productos nuevos.** Actualizar los existentes es
  una casilla aparte. Reemplazar sus existencias es otra casilla, que depende de
  la anterior y queda registrada como ajuste en el historial. Lo que el archivo
  no trae se conserva.
- **Todo o nada.** `import_products` revalida cada fila. Si una falla, se
  revierte la importación completa y el error indica el número de fila.
- **Idempotencia.** El navegador genera el id de la importación al cargar el
  archivo. Repetir la llamada devuelve el resumen guardado sin crear nada más.
- **Solo dueño o administrador** pueden importar.
- **Sin costo en el archivo, el costo queda en 0** y la vista previa lo advierte
  (no se podrá estimar la ganancia de ese producto).

## Consecuencias

- Los movimientos creados por una importación quedan ligados a ella
  (`reference_type = 'import'`) y la tabla `imports` guarda el resumen.
- La vista previa compara contra los primeros 1.000 productos del negocio. Con
  catálogos más grandes la vista previa podría no marcar un existente, pero la
  base de datos siempre lo detecta y lo omite (o lo actualiza, si se permitió).
- Las cuotas por plan (cuántas importaciones o filas al mes) quedan para la
  Fase 5, junto con la suscripción.
