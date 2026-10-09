// Plantilla de Excel con los encabezados que se reconocen automáticamente.

const HEADERS = [
  'Nombre',
  'Precio de venta',
  'Costo por unidad',
  'Cantidad',
  'Unidad',
  'Categoría',
  'Referencia',
  'Código de barras',
  'Aviso de stock bajo',
]

const EXAMPLES = [
  ['Arroz Diana 500 g', 2800, 2100, 24, 'unidad', 'Granos', 'ARR-500', '7702511000014', 6],
  ['Queso campesino', 18000, 13500, 2.5, 'kg', 'Lácteos', '', '', 1],
]

export async function downloadTemplate(): Promise<void> {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...EXAMPLES])
  sheet['!cols'] = HEADERS.map((header) => ({ wch: Math.max(14, header.length + 2) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Productos')
  XLSX.writeFile(workbook, 'plantilla-inventario.xlsx')
}
