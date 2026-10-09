import { describe, expect, it } from 'vitest'
import { csvFilename, toCsv } from './csv'

type Row = { name: string; qty: number; note: string | null }

const columns = [
  { header: 'Nombre', value: (row: Row) => row.name },
  { header: 'Cantidad', value: (row: Row) => row.qty },
  { header: 'Nota', value: (row: Row) => row.note },
]

describe('toCsv', () => {
  it('usa ";" como separador, coma decimal, BOM y CRLF', () => {
    const csv = toCsv([{ name: 'Arroz', qty: 10.5, note: null }], columns)
    expect(csv).toBe('﻿Nombre;Cantidad;Nota\r\nArroz;10,5;\r\n')
  })

  it('escapa separadores, comillas y saltos de línea', () => {
    const csv = toCsv([{ name: 'Jabón "Rey"; barra', qty: 1, note: 'línea 1\nlínea 2' }], columns)
    expect(csv).toContain('"Jabón ""Rey""; barra";1;"línea 1\nlínea 2"')
  })

  it('neutraliza textos que Excel ejecutaría como fórmula', () => {
    const csv = toCsv([{ name: '=HYPERLINK("x")', qty: -3, note: '+57' }], columns)
    expect(csv).toContain(`"'=HYPERLINK(""x"")";-3;'+57`)
  })
})

describe('csvFilename', () => {
  it('genera un nombre de archivo sin tildes ni espacios', () => {
    expect(csvFilename('productos', 'Tienda Doña Rosa', new Date(2026, 9, 9))).toBe(
      'productos-tienda-dona-rosa-2026-10-09.csv',
    )
  })
})
