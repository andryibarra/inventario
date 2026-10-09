// CSV pensado para abrirse con doble clic en Excel en español:
// separador ";", BOM para que reconozca UTF-8 (tildes, ñ) y saltos CRLF.

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null }

function escapeCell(value: string): string {
  // Evita que Excel interprete el contenido como fórmula (inyección CSV).
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((column) => escapeCell(column.header)).join(';')]
  for (const row of rows) {
    lines.push(
      columns
        .map((column) => {
          const value = column.value(row)
          if (value === null) return ''
          // Coma decimal: Excel con configuración regional colombiana.
          if (typeof value === 'number') return String(value).replace('.', ',')
          return escapeCell(value)
        })
        .join(';'),
    )
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** "inventario-tienda-dona-rosa-2026-10-09.csv" */
export function csvFilename(prefix: string, businessName: string, date = new Date()): string {
  const slug = businessName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const day = date.toLocaleDateString('sv-SE')
  return `${prefix}-${slug || 'negocio'}-${day}.csv`
}
