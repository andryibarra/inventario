import { Badge } from '../../components/ui/Badge'
import type { Product } from './api'

export function StockBadge({ product }: { product: Product }) {
  if (!product.is_active) return <Badge>Archivado</Badge>
  if (product.quantity === 0) return <Badge tone="danger">Agotado</Badge>
  if (product.is_low_stock) return <Badge tone="warning">Stock bajo</Badge>
  return null
}
