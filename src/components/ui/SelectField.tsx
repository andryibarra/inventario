import { useId, type Ref, type SelectHTMLAttributes } from 'react'

type Option = { value: string; label: string }

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  options: readonly Option[]
  placeholder?: string
  error?: string
  ref?: Ref<HTMLSelectElement>
}

export function SelectField({
  label,
  options,
  placeholder,
  error,
  id,
  className = '',
  ...props
}: SelectFieldProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={selectId} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={`min-h-11 rounded-lg border bg-white px-3 py-2 text-base text-slate-900 focus:outline-2 focus:outline-offset-0 focus:outline-brand-700 ${error ? 'border-red-500' : 'border-slate-300'}`}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${selectId}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
