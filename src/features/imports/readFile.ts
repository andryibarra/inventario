// Lee el archivo en el navegador. El contenido es un dato no confiable: no se
// evalúan fórmulas ni macros (SheetJS solo extrae valores) y se limitan el
// tamaño y la cantidad de filas antes de procesar.

import { decodeText, parseCsv } from './csvParse'

export type Cell = string | number | boolean | null
export type Sheet = { name: string; rows: Cell[][] }

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_ROWS = 2000

/** Error con un mensaje listo para mostrar. */
export class ImportFileError extends Error {}

const SPREADSHEET_EXTENSIONS = new Set(['xlsx', 'xls', 'ods'])
const TEXT_EXTENSIONS = new Set(['csv', 'txt'])

export async function readSpreadsheet(file: File): Promise<Sheet[]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportFileError(
      'El archivo pesa más de 5 MB. Guarda solo la hoja de productos o divídelo en partes.',
    )
  }
  if (file.size === 0) throw new ImportFileError('El archivo está vacío.')

  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const buffer = await file.arrayBuffer()

  let sheets: Sheet[]
  if (TEXT_EXTENSIONS.has(extension)) {
    sheets = [{ name: file.name, rows: parseCsv(decodeText(buffer)) }]
  } else if (SPREADSHEET_EXTENSIONS.has(extension)) {
    // Se carga solo cuando hace falta: es la librería más pesada de la app.
    const XLSX = await import('xlsx')
    let workbook: ReturnType<typeof XLSX.read>
    try {
      workbook = XLSX.read(buffer, {
        type: 'array',
        dense: true,
        cellFormula: false,
        cellHTML: false,
        cellStyles: false,
        // Se leen unas filas de más para poder avisar que el archivo excede el límite.
        sheetRows: MAX_ROWS + 50,
      })
    } catch {
      throw new ImportFileError(
        'No pudimos leer el archivo. Ábrelo en Excel, guárdalo de nuevo como .xlsx e inténtalo otra vez.',
      )
    }
    sheets = workbook.SheetNames.flatMap((name) => {
      const sheet = workbook.Sheets[name]
      if (!sheet) return []
      const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: false,
      })
      return [{ name, rows }]
    })
  } else {
    throw new ImportFileError(
      'Ese tipo de archivo no se puede importar. Usa Excel (.xlsx o .xls) o CSV.',
    )
  }

  const withData = sheets.filter((sheet) => sheet.rows.some((row) => row.some(hasContent)))
  if (withData.length === 0) throw new ImportFileError('El archivo no tiene datos.')
  return withData
}

export function hasContent(cell: Cell | undefined): boolean {
  return cell !== null && cell !== undefined && String(cell).trim() !== ''
}
