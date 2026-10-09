import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { decodeText, parseCsv } from './csvParse'
import { ImportFileError, MAX_FILE_BYTES, readSpreadsheet } from './readFile'

function bytes(text: string, encoding: 'utf-8' | 'latin1' = 'utf-8'): ArrayBuffer {
  if (encoding === 'utf-8') return new TextEncoder().encode(text).buffer as ArrayBuffer
  return Uint8Array.from(text, (char) => char.charCodeAt(0)).buffer
}

describe('parseCsv', () => {
  it('detecta ";" como separador y respeta comillas', () => {
    expect(parseCsv('Nombre;Precio\r\n"Jabón ""Rey""; barra";2.500\r\nArroz;1,5\r\n')).toEqual([
      ['Nombre', 'Precio'],
      ['Jabón "Rey"; barra', '2.500'],
      ['Arroz', '1,5'],
    ])
  })

  it('acepta "," y tabulador, y la última línea sin salto', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(parseCsv('a\tb\n1\t2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('admite saltos de línea dentro de comillas', () => {
    expect(parseCsv('a;b\n"línea 1\nlínea 2";x\n')).toEqual([
      ['a', 'b'],
      ['línea 1\nlínea 2', 'x'],
    ])
  })
})

describe('decodeText', () => {
  it('lee UTF-8 (con o sin BOM) y Windows-1252', () => {
    expect(decodeText(bytes('\uFEFFJabón'))).toBe('Jabón')
    expect(decodeText(bytes('Jabón'))).toBe('Jabón')
    expect(decodeText(bytes('Jabón año', 'latin1'))).toBe('Jabón año')
  })
})

describe('readSpreadsheet', () => {
  it('lee un .xlsx con sus valores numéricos', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Nombre', 'Precio'],
      ['Arroz', 2500],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Productos')
    const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const file = new File([data], 'inventario.xlsx')

    const sheets = await readSpreadsheet(file)
    expect(sheets).toEqual([
      {
        name: 'Productos',
        rows: [
          ['Nombre', 'Precio'],
          ['Arroz', 2500],
        ],
      },
    ])
  })

  it('lee un CSV', async () => {
    const sheets = await readSpreadsheet(new File(['Nombre;Precio\nArroz;2.500\n'], 'lista.csv'))
    expect(sheets[0]?.rows).toEqual([
      ['Nombre', 'Precio'],
      ['Arroz', '2.500'],
    ])
  })

  it('rechaza de forma controlada archivos grandes, vacíos o de otro tipo', async () => {
    const big = new File(['x'], 'grande.xlsx')
    Object.defineProperty(big, 'size', { value: MAX_FILE_BYTES + 1 })
    await expect(readSpreadsheet(big)).rejects.toThrow(/5 MB/)
    await expect(readSpreadsheet(new File([''], 'vacio.csv'))).rejects.toBeInstanceOf(
      ImportFileError,
    )
    await expect(readSpreadsheet(new File(['x'], 'foto.png'))).rejects.toThrow(/tipo de archivo/)
    await expect(readSpreadsheet(new File([';;\n;;\n'], 'blanco.csv'))).rejects.toThrow(
      /no tiene datos/,
    )
  })

  it('un archivo dañado da un mensaje entendible', async () => {
    await expect(
      readSpreadsheet(new File([new Uint8Array([80, 75, 3, 4, 0, 0])], 'roto.xlsx')),
    ).rejects.toBeInstanceOf(ImportFileError)
  })
})
