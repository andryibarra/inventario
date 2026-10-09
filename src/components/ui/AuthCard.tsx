import type { ReactNode } from 'react'

// Contenedor de las pantallas públicas (ingreso, registro, recuperación).
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-lg font-bold text-brand-700">Inventario</p>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="mb-5 text-2xl font-bold text-slate-900">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  )
}
