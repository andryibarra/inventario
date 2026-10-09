import { PERIOD_LABELS, presetPeriod, type Period, type PeriodKey } from './periods'

export function PeriodPicker({
  period,
  today,
  onChange,
}: {
  period: Period
  today: string
  onChange: (period: Period) => void
}) {
  const keys: PeriodKey[] = ['today', 'yesterday', 'week', 'month', 'custom']
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Periodo" className="flex flex-wrap gap-2">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={period.key === key}
            onClick={() =>
              onChange(
                key === 'custom'
                  ? { key, from: period.from, to: period.to }
                  : presetPeriod(key, today),
              )
            }
            className={`min-h-10 rounded-full px-4 text-sm font-medium ring-1 ${
              period.key === key
                ? 'bg-brand-700 text-white ring-brand-700'
                : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>
      {period.key === 'custom' && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            Desde
            <input
              type="date"
              value={period.from}
              max={today}
              onChange={(event) =>
                event.target.value &&
                onChange({
                  ...period,
                  from: event.target.value,
                  to: period.to < event.target.value ? event.target.value : period.to,
                })
              }
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            Hasta
            <input
              type="date"
              value={period.to}
              min={period.from}
              max={today}
              onChange={(event) =>
                event.target.value && onChange({ ...period, to: event.target.value })
              }
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3"
            />
          </label>
        </div>
      )}
    </div>
  )
}
