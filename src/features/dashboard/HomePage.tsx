import { useActiveBusiness } from '../business/BusinessContext'

type Step = { label: string; done: boolean; note?: string }

export function HomePage() {
  const business = useActiveBusiness()

  // Las acciones pendientes se habilitan con las fases 2 a 4.
  const steps: Step[] = [
    { label: 'Crear tu negocio', done: true },
    { label: 'Agregar tu primer producto', done: false, note: 'Disponible pronto' },
    { label: 'Registrar una entrada o una venta', done: false, note: 'Disponible pronto' },
  ]
  const doneCount = steps.filter((step) => step.done).length

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">{business.name}</h1>

      <section
        aria-labelledby="pasos-titulo"
        className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
      >
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="pasos-titulo" className="text-lg font-semibold">
            Primeros pasos
          </h2>
          <span className="text-sm text-slate-500">
            {doneCount} de {steps.length}
          </span>
        </div>
        <ol className="flex flex-col gap-3">
          {steps.map((step) => (
            <li key={step.label} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  step.done ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step.done ? '✓' : '·'}
              </span>
              <span className={step.done ? 'text-slate-500 line-through' : 'text-slate-900'}>
                {step.label}
                <span className="sr-only">{step.done ? ' (hecho)' : ' (pendiente)'}</span>
              </span>
              {step.note && <span className="ml-auto text-xs text-slate-400">{step.note}</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
