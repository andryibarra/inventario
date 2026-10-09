import { useLocation } from 'react-router'
import { Alert } from './Alert'

export type FlashState = { flash?: string } | null

/** Confirmación que una pantalla deja a la siguiente con navigate(…, { state: { flash } }). */
export function FlashMessage() {
  const flash = (useLocation().state as FlashState)?.flash
  return flash ? <Alert tone="success">{flash}</Alert> : null
}
