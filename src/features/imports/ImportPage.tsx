import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { buttonClasses } from '../../components/ui/buttonStyles'
import { Card } from '../../components/ui/Card'
import { LinkButton } from '../../components/ui/LinkButton'
import { SelectField } from '../../components/ui/SelectField'
import { csvFilename, downloadCsv, toCsv, type CsvColumn } from '../../lib/csv'
import { toUserMessage } from '../../lib/errors'
import { formatDateTime, formatMoney, formatQuantity } from '../../lib/format'
import { canManageBusiness } from '../business/api'
import { useActiveBusiness } from '../business/BusinessContext'
import { fetchProducts, invalidateInventory, productKeys } from '../products/api'
import { useCanWrite } from '../subscription/useCanWrite'
import {
  fetchImports,
  importErrorMessage,
  importKeys,
  importProducts,
  type ImportSummary,
} from './api'
import { FIELDS, suggestMapping, type ColumnMapping, type FieldKey } from './columns'
import {
  buildPreview,
  countPreview,
  DEFAULT_OPTIONS,
  detectHeaderRow,
  rowsToImport,
  type ImportOptions,
  type PreviewRow,
  type RowStatus,
} from './preview'
import { ImportFileError, MAX_ROWS, readSpreadsheet, type Cell, type Sheet } from './readFile'
import { downloadTemplate } from './template'

type Loaded = {
  fileName: string
  sheets: Sheet[]
  sheetIndex: number
  headerIndex: number
  mapping: ColumnMapping
  importId: string
}

type Step = 'upload' | 'map' | 'preview' | 'done'

const ALL_PRODUCTS = { filter: 'all', search: '', categoryId: null } as const
const PREVIEW_LIMIT = 300

function columnLetter(index: number): string {
  let letter = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter
  }
  return letter
}

function sheetRows(loaded: Loaded): Cell[][] {
  return loaded.sheets[loaded.sheetIndex]?.rows ?? []
}

function prepareSheet(loaded: Omit<Loaded, 'headerIndex' | 'mapping'>): Loaded {
  const rows = loaded.sheets[loaded.sheetIndex]?.rows ?? []
  const headerIndex = detectHeaderRow(rows)
  return { ...loaded, headerIndex, mapping: suggestMapping(rows[headerIndex] ?? []) }
}

// ---------------------------------------------------------------------------
// Paso 1: archivo
// ---------------------------------------------------------------------------

function PreviousImports() {
  const business = useActiveBusiness()
  const imports = useQuery({
    queryKey: importKeys.list(business.id),
    queryFn: () => fetchImports(business.id),
  })
  if (!imports.data?.length) return null

  return (
    <Card>
      <h2 className="mb-2 text-lg font-semibold">Importaciones anteriores</h2>
      <ul className="divide-y divide-slate-100">
        {imports.data.map((item) => (
          <li key={item.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2 text-sm">
            <span className="min-w-0 truncate font-medium">{item.file_name}</span>
            <span className="text-slate-600">
              {item.rows_created} creados · {item.rows_updated} actualizados ·{' '}
              {formatDateTime(item.created_at, business.timezone)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function UploadStep({ onLoaded }: { onLoaded: (loaded: Loaded) => void }) {
  const inputId = useId()
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [templateError, setTemplateError] = useState(false)

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    setReading(true)
    try {
      const sheets = await readSpreadsheet(file)
      onLoaded(
        prepareSheet({ fileName: file.name, sheets, sheetIndex: 0, importId: crypto.randomUUID() }),
      )
    } catch (caught) {
      setError(
        caught instanceof ImportFileError
          ? caught.message
          : 'No pudimos leer el archivo. Revisa que sea un Excel o CSV y vuelve a intentarlo.',
      )
    } finally {
      setReading(false)
    }
  }

  return (
    <>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-slate-700">
          <p>
            Sube el Excel o CSV donde llevas tus productos. No tiene que tener un formato especial:
            en el siguiente paso nos dices qué columna es cada dato.
          </p>
          <p className="text-sm text-slate-500">
            Hasta {formatQuantity(MAX_ROWS)} productos y 5 MB por archivo. Nada se guarda hasta que
            confirmes.
          </p>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        {templateError && (
          <Alert tone="error">No pudimos generar la plantilla. Intenta de nuevo.</Alert>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <label
            htmlFor={inputId}
            className={`${buttonClasses('primary')} cursor-pointer ${reading ? 'pointer-events-none opacity-60' : ''}`}
          >
            {reading ? 'Leyendo archivo…' : 'Elegir archivo'}
          </label>
          <input
            id={inputId}
            type="file"
            accept=".xlsx,.xls,.ods,.csv,.txt"
            className="sr-only"
            onChange={(event) => void handleFile(event)}
          />
          <Button
            variant="secondary"
            onClick={() => {
              setTemplateError(false)
              downloadTemplate().catch(() => setTemplateError(true))
            }}
          >
            Descargar plantilla
          </Button>
        </div>
      </Card>
      <PreviousImports />
    </>
  )
}

// ---------------------------------------------------------------------------
// Paso 2: columnas
// ---------------------------------------------------------------------------

function MapStep({
  loaded,
  onChange,
  onBack,
  onNext,
}: {
  loaded: Loaded
  onChange: (loaded: Loaded) => void
  onBack: () => void
  onNext: () => void
}) {
  const [showError, setShowError] = useState(false)
  const rows = sheetRows(loaded)
  const headers = rows[loaded.headerIndex] ?? []
  const firstData = rows[loaded.headerIndex + 1] ?? []
  const width = Math.max(headers.length, firstData.length)
  const dataRows = rows.length - loaded.headerIndex - 1

  const columnOptions = Array.from({ length: width }, (_, index) => {
    const header = String(headers[index] ?? '').trim()
    return {
      value: String(index),
      label: `Columna ${columnLetter(index)}${header ? `: ${header}` : ''}`,
    }
  })

  const identified =
    loaded.mapping.name !== null || loaded.mapping.sku !== null || loaded.mapping.barcode !== null

  function setField(key: FieldKey, value: string) {
    const column = value === '' ? null : Number(value)
    const mapping = { ...loaded.mapping }
    // Una columna alimenta un solo dato.
    for (const field of FIELDS) {
      if (column !== null && mapping[field.key] === column) mapping[field.key] = null
    }
    mapping[key] = column
    onChange({ ...loaded, mapping })
  }

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="font-medium break-all text-slate-900">{loaded.fileName}</p>
        <p className="text-sm text-slate-600">
          {formatQuantity(Math.max(dataRows, 0))} filas con datos. Revisa qué columna corresponde a
          cada dato; las que no relaciones no se importan.
        </p>
      </div>

      {dataRows > MAX_ROWS && (
        <Alert tone="error">
          El archivo tiene más de {formatQuantity(MAX_ROWS)} filas. Divídelo en partes e impórtalas
          por separado.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {loaded.sheets.length > 1 && (
          <SelectField
            label="Hoja"
            options={loaded.sheets.map((sheet, index) => ({
              value: String(index),
              label: sheet.name,
            }))}
            value={String(loaded.sheetIndex)}
            onChange={(event) =>
              onChange(prepareSheet({ ...loaded, sheetIndex: Number(event.target.value) }))
            }
          />
        )}
        <SelectField
          label="Los encabezados están en la fila"
          options={rows.slice(0, 10).map((row, index) => ({
            value: String(index),
            label: `${index + 1}: ${row
              .filter((cell) => cell !== null && cell !== '')
              .slice(0, 3)
              .join(' · ')}`,
          }))}
          value={String(loaded.headerIndex)}
          onChange={(event) => {
            const headerIndex = Number(event.target.value)
            onChange({ ...loaded, headerIndex, mapping: suggestMapping(rows[headerIndex] ?? []) })
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => {
          const column = loaded.mapping[field.key]
          return (
            <SelectField
              key={field.key}
              label={field.required ? field.label : `${field.label} (opcional)`}
              placeholder="No importar"
              options={columnOptions}
              value={column === null ? '' : String(column)}
              onChange={(event) => setField(field.key, event.target.value)}
            />
          )
        })}
      </div>

      {showError && !identified && (
        <Alert tone="error">
          Elige al menos la columna con el nombre del producto (o su referencia o código de barras,
          si solo vas a actualizar productos).
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          disabled={dataRows > MAX_ROWS}
          onClick={() => {
            if (!identified) {
              setShowError(true)
              return
            }
            onNext()
          }}
        >
          Ver vista previa
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Elegir otro archivo
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Paso 3: vista previa y confirmación
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<RowStatus, string> = {
  new: 'Nuevo',
  update: 'Se actualiza',
  skip: 'Ya existe',
  duplicate: 'Nombre repetido',
  error: 'Con error',
}

const STATUS_TONE: Record<RowStatus, 'success' | 'neutral' | 'warning' | 'danger'> = {
  new: 'success',
  update: 'success',
  skip: 'neutral',
  duplicate: 'warning',
  error: 'danger',
}

function reportColumns(options: ImportOptions): CsvColumn<PreviewRow>[] {
  return [
    { header: 'Fila', value: (row) => row.rowNumber },
    {
      header: 'Resultado',
      value: (row) =>
        row.status === 'duplicate' && options.includeDuplicates
          ? 'Se crea (nombre repetido)'
          : STATUS_LABEL[row.status],
    },
    { header: 'Detalle', value: (row) => row.messages.join(' ') },
    ...FIELDS.map((field) => ({
      header: field.label,
      value: (row: PreviewRow) => row.raw[field.key] ?? null,
    })),
  ]
}

function Checkbox({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className={`flex gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={`${id}-hint`}
        className="mt-1 size-5 shrink-0 accent-brand-700"
      />
      <div>
        <label htmlFor={id} className="font-medium text-slate-900">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-sm text-slate-600">
          {hint}
        </p>
      </div>
    </div>
  )
}

function PreviewStep({
  loaded,
  onBack,
  onDone,
}: {
  loaded: Loaded
  onBack: () => void
  onDone: (summary: ImportSummary) => void
}) {
  const business = useActiveBusiness()
  const queryClient = useQueryClient()
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_OPTIONS)
  const [filter, setFilter] = useState<RowStatus | 'all'>('all')

  const existing = useQuery({
    queryKey: productKeys.list(business.id, ALL_PRODUCTS),
    queryFn: () => fetchProducts(business.id, ALL_PRODUCTS),
  })

  const preview = useMemo(
    () =>
      existing.data
        ? buildPreview(
            sheetRows(loaded),
            loaded.headerIndex,
            loaded.mapping,
            existing.data,
            options,
          )
        : [],
    [existing.data, loaded, options],
  )
  const counts = countPreview(preview)
  const toImport = rowsToImport(preview, options)
  const toCreate = counts.new + (options.includeDuplicates ? counts.duplicate : 0)
  const problems = counts.error + counts.skip + (options.includeDuplicates ? 0 : counts.duplicate)
  const visible = preview.filter((row) => filter === 'all' || row.status === filter)

  const mutation = useMutation({
    mutationFn: importProducts,
    onSuccess: async (summary) => {
      await Promise.all([
        invalidateInventory(queryClient, business.id),
        queryClient.invalidateQueries({ queryKey: productKeys.categories(business.id) }),
        queryClient.invalidateQueries({ queryKey: importKeys.list(business.id) }),
      ])
      onDone(summary)
    },
  })

  if (existing.isError) return <Alert tone="error">{toUserMessage(existing.error)}</Alert>
  if (existing.isPending) return <Card>Preparando la vista previa…</Card>

  const importLabel = [
    toCreate > 0 && `crear ${toCreate}`,
    counts.update > 0 && `actualizar ${counts.update}`,
  ]
    .filter(Boolean)
    .join(' y ')

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <p className="font-medium break-all text-slate-900">{loaded.fileName}</p>
        <div className="flex flex-wrap gap-2" aria-label="Resumen de la vista previa">
          {(Object.keys(STATUS_LABEL) as RowStatus[]).map(
            (status) =>
              counts[status] > 0 && (
                <Badge key={status} tone={STATUS_TONE[status]}>
                  {STATUS_LABEL[status]}: {counts[status]}
                </Badge>
              ),
          )}
        </div>
      </Card>

      {(counts.skip > 0 || counts.update > 0 || counts.duplicate > 0) && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">¿Qué hacemos con lo que ya tienes?</h2>
          {(counts.skip > 0 || counts.update > 0) && (
            <>
              <Checkbox
                label={
                  counts.skip + counts.update === 1
                    ? 'Actualizar el producto que ya existe'
                    : `Actualizar los ${counts.skip + counts.update} productos que ya existen`
                }
                hint="Coinciden por referencia o código de barras. Sus datos (nombre, precio, categoría…) se reemplazan por los del archivo; lo que el archivo no trae se conserva."
                checked={options.updateExisting}
                onChange={(checked) =>
                  setOptions((current) => ({
                    ...current,
                    updateExisting: checked,
                    adjustStock: checked && current.adjustStock,
                  }))
                }
              />
              {loaded.mapping.quantity !== null && (
                <div className="pl-8">
                  <Checkbox
                    label="También reemplazar su cantidad disponible por la del archivo"
                    hint="Queda registrado como un ajuste en el historial de cada producto."
                    checked={options.adjustStock}
                    disabled={!options.updateExisting}
                    onChange={(checked) =>
                      setOptions((current) => ({ ...current, adjustStock: checked }))
                    }
                  />
                </div>
              )}
            </>
          )}
          {counts.duplicate > 0 && (
            <Checkbox
              label={
                counts.duplicate === 1
                  ? 'Crear también el producto con nombre repetido'
                  : `Crear también los ${counts.duplicate} productos con nombre repetido`
              }
              hint="Tienen el mismo nombre que otro producto pero no la misma referencia ni código. Puede tratarse de otro producto (otra marca o tamaño) o de uno repetido."
              checked={options.includeDuplicates}
              onChange={(checked) =>
                setOptions((current) => ({ ...current, includeDuplicates: checked }))
              }
            />
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Vista previa</h2>
          <label className="flex items-center gap-2 text-sm">
            <span>Mostrar</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as RowStatus | 'all')}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-2"
            >
              <option value="all">Todas las filas</option>
              {(Object.keys(STATUS_LABEL) as RowStatus[]).map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]} ({counts[status]})
                </option>
              ))}
            </select>
          </label>
        </div>

        {preview.length === 0 ? (
          <p className="text-slate-600">
            No encontramos filas con datos debajo de los encabezados.
          </p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Fila</th>
                  <th className="py-2 pr-3 font-medium">Resultado</th>
                  <th className="py-2 pr-3 font-medium">Producto</th>
                  <th className="py-2 pr-3 text-right font-medium">Precio</th>
                  <th className="py-2 pr-3 text-right font-medium">Cantidad</th>
                  <th className="py-2 font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.slice(0, PREVIEW_LIMIT).map((row) => (
                  <tr key={row.rowNumber} className="align-top">
                    <td className="py-2 pr-3 text-slate-500 tabular-nums">{row.rowNumber}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {row.payload.name ?? row.raw.name ?? row.payload.sku ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.payload.sale_price !== undefined
                        ? formatMoney(row.payload.sale_price, business.currency)
                        : '—'}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.payload.quantity !== undefined
                        ? formatQuantity(row.payload.quantity)
                        : '—'}
                    </td>
                    <td className="py-2 text-slate-600">{row.messages.join(' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length > PREVIEW_LIMIT && (
              <p className="pt-2 text-sm text-slate-500">
                Se muestran las primeras {PREVIEW_LIMIT} filas. El reporte incluye todas.
              </p>
            )}
          </div>
        )}
      </Card>

      {mutation.isError && <Alert tone="error">{importErrorMessage(mutation.error)}</Alert>}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          disabled={toImport.length === 0}
          loading={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              businessId: business.id,
              importId: loaded.importId,
              fileName: loaded.fileName,
              rows: toImport,
              options,
              rowsTotal: preview.length,
            })
          }
        >
          {toImport.length === 0 ? 'No hay productos para importar' : `Importar: ${importLabel}`}
        </Button>
        {problems > 0 && (
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv(
                csvFilename('reporte-importacion', business.name),
                toCsv(
                  preview.filter((row) => !toImport.includes(row.payload)),
                  reportColumns(options),
                ),
              )
            }
          >
            Descargar filas que no se importan ({problems})
          </Button>
        )}
        <Button variant="ghost" onClick={onBack} disabled={mutation.isPending}>
          Cambiar columnas
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Paso 4: resultado
// ---------------------------------------------------------------------------

function DoneStep({ summary, onRestart }: { summary: ImportSummary; onRestart: () => void }) {
  const items = [
    { label: 'Productos creados', value: summary.rows_created },
    { label: 'Productos actualizados', value: summary.rows_updated },
    { label: 'Cantidades reemplazadas', value: summary.rows_stock_adjusted },
    { label: 'Filas no importadas', value: summary.rows_skipped },
  ]
  return (
    <Card className="flex flex-col gap-4">
      <Alert tone="success">
        {summary.already_imported
          ? 'Esta importación ya se había hecho. No se repitió nada.'
          : 'Importación terminada.'}
      </Alert>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-sm text-slate-500">{item.label}</dt>
            <dd className="text-2xl font-bold tabular-nums">{formatQuantity(item.value)}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-3 sm:flex-row">
        <LinkButton to="/productos">Ver mis productos</LinkButton>
        <Button variant="secondary" onClick={onRestart}>
          Importar otro archivo
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------

export function ImportPage() {
  const business = useActiveBusiness()
  const canWrite = useCanWrite(business.id)
  const [step, setStep] = useState<Step>('upload')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const header = (
    <div className="flex flex-col gap-2">
      <Link to="/productos" className="text-sm font-medium text-brand-700 underline">
        ← Productos
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Importar productos</h1>
    </div>
  )

  if (!canManageBusiness(business.role) || !canWrite) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Alert tone="info">
          {canWrite
            ? 'Solo el dueño o un administrador del negocio puede importar productos.'
            : 'Tu suscripción no está activa. Puedes consultar tus datos, pero no importar.'}
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {header}
      {step === 'upload' || !loaded ? (
        <UploadStep
          onLoaded={(next) => {
            setLoaded(next)
            setStep('map')
          }}
        />
      ) : step === 'map' ? (
        <MapStep
          loaded={loaded}
          onChange={setLoaded}
          onBack={() => setStep('upload')}
          onNext={() => setStep('preview')}
        />
      ) : step === 'preview' ? (
        <PreviewStep
          loaded={loaded}
          onBack={() => setStep('map')}
          onDone={(result) => {
            setSummary(result)
            setStep('done')
          }}
        />
      ) : (
        summary && (
          <DoneStep
            summary={summary}
            onRestart={() => {
              setLoaded(null)
              setSummary(null)
              setStep('upload')
            }}
          />
        )
      )}
    </div>
  )
}
