import type { ReactNode } from 'react'

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 px-6 py-10 text-center">
      <p className="text-lg font-semibold text-slate-900">{title}</p>
      {children && <div className="max-w-sm text-slate-600">{children}</div>}
      {action}
    </div>
  )
}
