import type { Unit } from '../products/units'
import { normalizeHeader } from './columns'

const UNIT_ALIASES: Record<Unit, string[]> = {
  unidad: ['unidad', 'unidades', 'und', 'un', 'u', 'unid', 'pieza', 'piezas', 'pza', 'pz'],
  kg: ['kg', 'kgs', 'kilo', 'kilos', 'kilogramo', 'kilogramos'],
  g: ['g', 'gr', 'grs', 'gramo', 'gramos'],
  l: ['l', 'lt', 'lts', 'litro', 'litros'],
  ml: ['ml', 'mililitro', 'mililitros'],
  m: ['m', 'mt', 'mts', 'metro', 'metros'],
  caja: ['caja', 'cajas', 'cj'],
  paquete: ['paquete', 'paquetes', 'paq', 'pqt', 'bolsa', 'bolsas'],
  docena: ['docena', 'docenas', 'doc'],
  par: ['par', 'pares'],
}

const LOOKUP = new Map<string, Unit>(
  Object.entries(UNIT_ALIASES).flatMap(([unit, aliases]) =>
    aliases.map((alias) => [alias, unit as Unit] as const),
  ),
)

/** "Kilos" → "kg". null si no se reconoce. */
export function parseUnit(value: string): Unit | null {
  return LOOKUP.get(normalizeHeader(value).replace(/ /g, '')) ?? null
}
