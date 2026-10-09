import type { ReactNode } from 'react'

type Tone = 'error' | 'success' | 'info' | 'warning'

const TONES: Record<Tone, string> = {
  error: 'bg-red-50 text-red-800 ring-red-200',
  success: 'bg-brand-50 text-brand-800 ring-brand-100',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
}

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg px-4 py-3 text-sm ring-1 ${TONES[tone]}`}
    >
      {children}
    </div>
  )
}
