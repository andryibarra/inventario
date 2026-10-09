import { Alert } from '../../components/ui/Alert'
import type { Access } from './access'

function days(n: number): string {
  return n === 1 ? '1 día' : `${n} días`
}

export function SubscriptionBanner({ access }: { access: Access }) {
  switch (access.kind) {
    case 'trial':
      return (
        <Alert tone="info">
          Estás en la prueba gratis. Te quedan <strong>{days(access.daysLeft)}</strong>.
        </Alert>
      )
    case 'grace':
      return (
        <Alert tone="warning">
          Tu periodo terminó. Tienes <strong>{days(access.daysLeft)}</strong> para renovar antes de
          que la cuenta pase a solo lectura.
        </Alert>
      )
    case 'expired':
      return (
        <Alert tone="warning">
          Tu periodo terminó. Tus datos están guardados y puedes consultarlos, pero no hacer cambios
          hasta renovar.
        </Alert>
      )
    case 'active':
      return null
  }
}
