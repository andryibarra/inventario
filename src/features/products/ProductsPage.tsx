import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { FlashMessage } from '../../components/ui/FlashMessage'
import { LinkButton } from '../../components/ui/LinkButton'
import { Spinner } from '../../components/ui/Spinner'
import { toUserMessage } from '../../lib/errors'
import { formatMoney, formatQuantity } from '../../lib/format'
import { canManageBusiness } from '../business/api'
import { useActiveBusiness } from '../business/BusinessContext'
import { useCanWrite } from '../subscription/useCanWrite'
import {
  fetchCategories,
  fetchProducts,
  productKeys,
  type Product,
  type ProductFilter,
} from './api'
import { exportProducts } from './exportProducts'
import { StockBadge } from './StockBadge'
import { unitShort } from './units'

const FILTERS: { value: ProductFilter; label: string }[] = [
  { value: 'active', label: 'Activos' },
  { value: 'low', label: 'Stock bajo' },
  { value: 'archived', label: 'Archivados' },
]

function parseFilter(value: string | null): ProductFilter {
  return value === 'bajo' ? 'low' : value === 'archivados' ? 'archived' : 'active'
}

function filterParam(filter: ProductFilter): string | null {
  return filter === 'low' ? 'bajo' : filter === 'archived' ? 'archivados' : null
}

function ProductRow({ product, currency }: { product: Product; currency: string }) {
  const details = [product.sku, product.category_name].filter(Boolean).join(' · ')
  return (
    <li>
      <Link
        to={`/productos/${product.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 focus-visible:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900">{product.name}</p>
          <p className="truncate text-sm text-slate-500">
            {formatMoney(product.sale_price, currency)}
            {details && ` · ${details}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-semibold text-slate-900 tabular-nums">
            {formatQuantity(product.quantity)}{' '}
            <span className="text-sm font-normal text-slate-500">{unitShort(product.unit)}</span>
          </span>
          <StockBadge product={product} />
        </div>
      </Link>
    </li>
  )
}

export function ProductsPage() {
  const business = useActiveBusiness()
  const canWrite = useCanWrite(business.id)
  const canImport = canManageBusiness(business.role)
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const deferredSearch = useDeferredValue(search)
  const [exportError, setExportError] = useState<unknown>(null)
  const [exporting, setExporting] = useState(false)

  const filter = parseFilter(params.get('filtro'))
  const categoryId = params.get('categoria')
  const query = { filter, search: deferredSearch, categoryId }

  const products = useQuery({
    queryKey: productKeys.list(business.id, query),
    queryFn: () => fetchProducts(business.id, query),
    placeholderData: (previous) => previous,
  })
  const categories = useQuery({
    queryKey: productKeys.categories(business.id),
    queryFn: () => fetchCategories(business.id),
  })

  function updateParam(key: string, value: string | null) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      await exportProducts(business)
    } catch (error) {
      setExportError(error)
    } finally {
      setExporting(false)
    }
  }

  const isFiltered = filter !== 'active' || Boolean(categoryId) || deferredSearch.trim() !== ''
  const list = products.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Productos</h1>
        {canWrite && (
          <div className="flex gap-2">
            {canImport && (
              <LinkButton to="/productos/importar" variant="secondary">
                Importar Excel
              </LinkButton>
            )}
            <LinkButton to="/productos/nuevo">Agregar producto</LinkButton>
          </div>
        )}
      </div>

      <FlashMessage />
      {exportError !== null && <Alert tone="error">{toUserMessage(exportError)}</Alert>}

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="sr-only">Buscar producto</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              updateParam('q', event.target.value.trim() || null)
            }}
            placeholder="Buscar por nombre, referencia o código"
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base placeholder:text-slate-400 focus:outline-2 focus:outline-brand-700"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filtrar productos" className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                onClick={() => updateParam('filtro', filterParam(item.value))}
                className={`min-h-10 rounded-full px-4 text-sm font-medium ring-1 ${
                  filter === item.value
                    ? 'bg-brand-700 text-white ring-brand-700'
                    : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {(categories.data?.length ?? 0) > 0 && (
            <label className="flex items-center gap-2">
              <span className="sr-only">Categoría</span>
              <select
                value={categoryId ?? ''}
                onChange={(event) => updateParam('categoria', event.target.value || null)}
                className="min-h-10 rounded-full border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Todas las categorías</option>
                {categories.data?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="ml-auto flex gap-1">
            <LinkButton to="/productos/categorias" variant="ghost" className="text-sm">
              Categorías
            </LinkButton>
            <Button variant="ghost" className="text-sm" loading={exporting} onClick={handleExport}>
              Exportar
            </Button>
          </div>
        </div>
      </div>

      {products.isError ? (
        <Alert tone="error">{toUserMessage(products.error)}</Alert>
      ) : products.isPending ? (
        <Spinner />
      ) : list.length === 0 ? (
        isFiltered ? (
          <EmptyState title="No encontramos productos">
            Prueba con otra búsqueda o cambia el filtro.
          </EmptyState>
        ) : (
          <EmptyState
            title="Aún no tienes productos"
            action={
              canWrite && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <LinkButton to="/productos/nuevo">Agregar mi primer producto</LinkButton>
                  {canImport && (
                    <LinkButton to="/productos/importar" variant="secondary">
                      Importar desde Excel
                    </LinkButton>
                  )}
                </div>
              )
            }
          >
            Agrega los productos que vendes con su cantidad actual, o sube el Excel donde ya los
            tienes.
          </EmptyState>
        )
      ) : (
        <>
          <ul
            aria-label="Lista de productos"
            className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
          >
            {list.map((product) => (
              <ProductRow key={product.id} product={product} currency={business.currency} />
            ))}
          </ul>
          <p className="text-center text-sm text-slate-500">
            {list.length === 1 ? '1 producto' : `${list.length} productos`}
          </p>
        </>
      )}
    </div>
  )
}
