import { useSubscription } from './useSubscription'

/**
 * Oculta acciones de escritura cuando la suscripción está vencida. Mientras
 * carga se asume que sí: la base de datos rechaza la operación de todos modos.
 */
export function useCanWrite(businessId: string): boolean {
  const { access } = useSubscription(businessId)
  return access?.canWrite !== false
}
