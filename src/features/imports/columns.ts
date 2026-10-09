// Campos que se pueden importar y los nombres de columna con que suelen venir
// en los archivos de los negocios. No se exige ningún encabezado exacto: se
// sugiere una relación y la persona la puede corregir.

export type FieldKey =
  | 'name'
  | 'sale_price'
  | 'cost'
  | 'quantity'
  | 'sku'
  | 'barcode'
  | 'category'
  | 'unit'
  | 'low_stock_threshold'

export type FieldDef = { key: FieldKey; label: string; required?: boolean; synonyms: string[] }

export const FIELDS: FieldDef[] = [
  {
    key: 'name',
    label: 'Nombre del producto',
    required: true,
    synonyms: [
      'nombre',
      'producto',
      'nombre producto',
      'nombre del producto',
      'descripcion',
      'articulo',
      'item',
      'detalle',
    ],
  },
  {
    key: 'sale_price',
    label: 'Precio de venta',
    required: true,
    synonyms: [
      'precio',
      'precio venta',
      'precio de venta',
      'pvp',
      'valor venta',
      'valor de venta',
      'precio unitario',
      'precio publico',
      'venta',
      'valor',
    ],
  },
  {
    key: 'cost',
    label: 'Costo por unidad',
    synonyms: [
      'costo',
      'costo unitario',
      'costo por unidad',
      'precio compra',
      'precio de compra',
      'valor compra',
      'costo compra',
      'compra',
    ],
  },
  {
    key: 'quantity',
    label: 'Cantidad disponible',
    synonyms: [
      'cantidad',
      'stock',
      'existencias',
      'existencia',
      'inventario',
      'cant',
      'unidades',
      'disponible',
      'saldo',
      'cantidad disponible',
    ],
  },
  {
    key: 'sku',
    label: 'Referencia',
    synonyms: ['referencia', 'ref', 'sku', 'codigo interno', 'codigo', 'cod', 'codigo producto'],
  },
  {
    key: 'barcode',
    label: 'Código de barras',
    synonyms: [
      'codigo de barras',
      'codigo barras',
      'barras',
      'ean',
      'upc',
      'barcode',
      'cod barras',
    ],
  },
  {
    key: 'category',
    label: 'Categoría',
    synonyms: ['categoria', 'tipo', 'linea', 'grupo', 'familia', 'seccion'],
  },
  {
    key: 'unit',
    label: 'Unidad',
    synonyms: ['unidad', 'unidad de medida', 'medida', 'um', 'und', 'presentacion'],
  },
  {
    key: 'low_stock_threshold',
    label: 'Aviso de stock bajo',
    synonyms: [
      'stock minimo',
      'minimo',
      'cantidad minima',
      'alerta',
      'aviso',
      'punto de reorden',
      'aviso de stock bajo',
    ],
  },
]

/** Columna del archivo (índice) asignada a cada campo; null = no importar. */
export type ColumnMapping = Record<FieldKey, number | null>

export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function emptyMapping(): ColumnMapping {
  return Object.fromEntries(FIELDS.map((field) => [field.key, null])) as ColumnMapping
}

/**
 * Sugiere qué columna corresponde a cada campo. Primero busca coincidencias
 * exactas; después, encabezados que contienen un sinónimo de varias palabras
 * ("Precio de venta al público"). Cada columna se usa una sola vez.
 */
export function suggestMapping(headers: readonly unknown[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader)
  const mapping = emptyMapping()
  const used = new Set<number>()

  const assign = (matches: (header: string, synonym: string) => boolean) => {
    for (const field of FIELDS) {
      if (mapping[field.key] !== null) continue
      for (const synonym of field.synonyms) {
        const index = normalized.findIndex(
          (header, i) => !used.has(i) && header !== '' && matches(header, synonym),
        )
        if (index !== -1) {
          mapping[field.key] = index
          used.add(index)
          break
        }
      }
    }
  }

  // "P.V.P" → "p v p": también se compara sin espacios.
  assign((header, synonym) => header === synonym || header.replace(/ /g, '') === synonym)
  assign((header, synonym) => synonym.includes(' ') && header.includes(synonym))
  return mapping
}

/** Cuántos campos reconoce una fila; sirve para encontrar la fila de encabezados. */
export function headerScore(row: readonly unknown[]): number {
  return Object.values(suggestMapping(row)).filter((value) => value !== null).length
}
