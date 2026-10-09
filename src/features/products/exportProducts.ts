import { csvFilename, downloadCsv, toCsv, type CsvColumn } from '../../lib/csv'
import type { Membership } from '../business/api'
import { fetchProducts, type Product } from './api'
import { UNITS } from './units'

const COLUMNS: CsvColumn<Product>[] = [
  { header: 'Nombre', value: (p) => p.name },
  { header: 'Referencia', value: (p) => p.sku },
  { header: 'Código de barras', value: (p) => p.barcode },
  { header: 'Categoría', value: (p) => p.category_name },
  { header: 'Unidad', value: (p) => UNITS.find((u) => u.value === p.unit)?.label ?? p.unit },
  { header: 'Cantidad', value: (p) => p.quantity },
  { header: 'Costo promedio', value: (p) => p.average_cost },
  { header: 'Valor a costo', value: (p) => p.stock_value },
  { header: 'Precio de venta', value: (p) => p.sale_price },
  { header: 'Aviso de stock bajo', value: (p) => p.low_stock_threshold },
  { header: 'Estado', value: (p) => (p.is_active ? 'Activo' : 'Archivado') },
]

/** Exporta todo el catálogo (incluidos archivados). Funciona aunque la suscripción esté vencida. */
export async function exportProducts(business: Pick<Membership, 'id' | 'name'>): Promise<void> {
  const products = await fetchProducts(business.id, {
    filter: 'all',
    search: '',
    categoryId: null,
  })
  downloadCsv(csvFilename('productos', business.name), toCsv(products, COLUMNS))
}
