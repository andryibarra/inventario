import { Link } from 'react-router'
import { AuthCard } from '../components/ui/AuthCard'

export function NotFoundPage() {
  return (
    <AuthCard title="Página no encontrada">
      <p className="text-slate-700">La dirección que abriste no existe.</p>
      <Link to="/" className="mt-6 block text-center font-semibold text-brand-700 underline">
        Ir al inicio
      </Link>
    </AuthCard>
  )
}
