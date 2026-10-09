import { useId, type InputHTMLAttributes, type Ref } from 'react'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
  ref?: Ref<HTMLInputElement>
}

export function TextField({ label, error, hint, id, className = '', ...props }: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={inputId} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-11 rounded-lg border bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 focus:outline-brand-700 ${error ? 'border-red-500' : 'border-slate-300'}`}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
