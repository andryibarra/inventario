export const BUSINESS_TYPES = [
  { value: 'tienda_barrio', label: 'Tienda de barrio' },
  { value: 'minimercado', label: 'Minimercado' },
  { value: 'ropa', label: 'Tienda de ropa' },
  { value: 'belleza', label: 'Belleza y cosméticos' },
  { value: 'ferreteria', label: 'Ferretería' },
  { value: 'papeleria', label: 'Papelería o miscelánea' },
  { value: 'otro', label: 'Otro' },
] as const

export function businessTypeLabel(value: string | null): string | null {
  if (!value) return null
  return BUSINESS_TYPES.find((type) => type.value === value)?.label ?? value
}
