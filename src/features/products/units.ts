// Debe coincidir con el check de public.products.unit.
export const UNITS = [
  { value: 'unidad', label: 'Unidad', short: 'und.' },
  { value: 'kg', label: 'Kilogramo (kg)', short: 'kg' },
  { value: 'g', label: 'Gramo (g)', short: 'g' },
  { value: 'l', label: 'Litro (l)', short: 'l' },
  { value: 'ml', label: 'Mililitro (ml)', short: 'ml' },
  { value: 'm', label: 'Metro (m)', short: 'm' },
  { value: 'caja', label: 'Caja', short: 'cajas' },
  { value: 'paquete', label: 'Paquete', short: 'paq.' },
  { value: 'docena', label: 'Docena', short: 'doc.' },
  { value: 'par', label: 'Par', short: 'pares' },
] as const

export type Unit = (typeof UNITS)[number]['value']

export const UNIT_VALUES = UNITS.map((unit) => unit.value) as [Unit, ...Unit[]]

export function unitShort(value: string): string {
  return UNITS.find((unit) => unit.value === value)?.short ?? value
}
