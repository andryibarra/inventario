export function FullPageSpinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-dvh flex-col items-center justify-center gap-3">
      <span
        aria-hidden="true"
        className="size-8 animate-spin rounded-full border-4 border-brand-700 border-t-transparent"
      />
      <span className="text-slate-600">{label}</span>
    </div>
  )
}
