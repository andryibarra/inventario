import { NavLink, Outlet } from 'react-router'
import { useActiveBusiness, useBusinesses } from '../features/business/BusinessContext'
import { SubscriptionBanner } from '../features/subscription/SubscriptionBanner'
import { useSubscription } from '../features/subscription/useSubscription'

// Las secciones se agregan a medida que cada fase queda lista.
const NAV_ITEMS = [
  { to: '/', label: 'Inicio', icon: '⌂' },
  { to: '/productos', label: 'Productos', icon: '▦' },
  { to: '/inventario', label: 'Movimientos', icon: '⇅' },
  { to: '/configuracion', label: 'Configuración', icon: '⚙' },
] as const

function BusinessSwitcher() {
  const { memberships, setActiveId } = useBusinesses()
  const active = useActiveBusiness()

  if (memberships.length < 2) {
    return <span className="truncate font-semibold text-slate-900">{active.name}</span>
  }
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="sr-only">Negocio activo</span>
      <select
        value={active.id}
        onChange={(event) => setActiveId(event.target.value)}
        className="min-h-10 max-w-full truncate rounded-lg border border-slate-300 bg-white px-2 font-semibold"
      >
        {memberships.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function navClass({ isActive }: { isActive: boolean }): string {
  return `flex flex-1 flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-xs font-medium md:flex-none md:flex-row md:gap-2 md:text-sm ${
    isActive ? 'text-brand-700 md:bg-brand-50' : 'text-slate-600 hover:text-slate-900'
  }`
}

export function AppLayout() {
  const active = useActiveBusiness()
  const { access } = useSubscription(active.id)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <span className="shrink-0 font-bold text-brand-700">Inventario</span>
          <div className="min-w-0 flex-1">
            <BusinessSwitcher />
          </div>
          <nav aria-label="Principal" className="hidden gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-24 md:pb-8">
        {access && (
          <div className="mb-4">
            <SubscriptionBanner access={access} />
          </div>
        )}
        <Outlet />
      </main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 flex border-t border-slate-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navClass}>
            <span aria-hidden="true" className="text-lg leading-none">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
