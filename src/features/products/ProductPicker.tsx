import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState, type KeyboardEvent } from 'react'
import { Alert } from '../../components/ui/Alert'
import { LinkButton } from '../../components/ui/LinkButton'
import { Spinner } from '../../components/ui/Spinner'
import { TextField } from '../../components/ui/TextField'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, formatQuantity } from '../../lib/format'
import { useActiveBusiness } from '../business/BusinessContext'
import { fetchProducts, productKeys, type Product } from './api'
import { unitShort } from './units'

type ProductPickerProps = {
  onPick: (product: Product) => void
  label?: string
  /** Limpia la búsqueda al elegir, para agregar varios seguidos (ventas). */
  clearOnPick?: boolean
  showPrice?: boolean
}

const MAX_RESULTS = 8

export function ProductPicker({
  onPick,
  label = '¿Qué producto?',
  clearOnPick = false,
  showPrice = false,
}: ProductPickerProps) {
  const business = useActiveBusiness()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const query = { filter: 'active' as const, search: deferredSearch, categoryId: null }

  const products = useQuery({
    queryKey: productKeys.list(business.id, query),
    queryFn: () => fetchProducts(business.id, query),
    placeholderData: (previous) => previous,
  })
  const results = (products.data ?? []).slice(0, MAX_RESULTS)

  function pick(product: Product) {
    onPick(product)
    if (clearOnPick) setSearch('')
  }

  // Los lectores de código de barras escriben el código y presionan Enter.
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const term = search.trim().toLowerCase()
    if (!term || deferredSearch !== search) return
    const exact = (products.data ?? []).find(
      (product) => product.barcode === search.trim() || product.sku?.toLowerCase() === term,
    )
    const match = exact ?? (results.length === 1 ? results[0] : undefined)
    if (match) pick(match)
  }

  return (
    <div className="flex flex-col gap-3">
      <TextField
        label={label}
        type="search"
        autoFocus
        autoComplete="off"
        placeholder="Nombre, referencia o código de barras"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {products.isError ? (
        <Alert tone="error">{toUserMessage(products.error)}</Alert>
      ) : products.isPending ? (
        <Spinner />
      ) : results.length === 0 ? (
        <p className="text-slate-600">
          {deferredSearch.trim() ? 'No encontramos ese producto.' : 'Aún no tienes productos.'}{' '}
          <LinkButton to="/productos/nuevo" variant="ghost" className="text-sm">
            Crear producto
          </LinkButton>
        </p>
      ) : (
        <ul
          aria-label="Resultados"
          className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200"
        >
          {results.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => pick(product)}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{product.name}</span>
                  {showPrice && (
                    <span className="block text-sm text-slate-500">
                      {formatMoney(product.sale_price, business.currency)}
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 text-sm tabular-nums ${product.quantity === 0 ? 'text-red-700' : 'text-slate-500'}`}
                >
                  {product.quantity === 0
                    ? 'Agotado'
                    : `${formatQuantity(product.quantity)} ${unitShort(product.unit)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
