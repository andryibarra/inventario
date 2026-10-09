export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-slate-600">
      <span
        aria-hidden="true"
        className="size-6 animate-spin rounded-full border-4 border-brand-700 border-t-transparent"
      />
      {label}
    </div>
  )
}
