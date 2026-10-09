import type { HTMLAttributes } from 'react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${className}`}
      {...props}
    />
  )
}
