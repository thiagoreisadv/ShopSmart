import type { Product, ProductSource } from './types'
import { normalizeText, uid } from '@/lib/id'
import type { PriceUnit } from '@/lib/units'

export function findByBarcode(products: Product[], code: string): Product | undefined {
  return products.find((p) => p.barcode === code)
}

export function sizeKey(size?: Product['size']): string {
  return size ? `${size.unit}${size.milli}` : ''
}

/** Identidade de produtos sem código de barras: nome + marca + tamanho (embalagens diferentes = produtos diferentes). */
export function identityKey(p: { name: string; brand?: string; size?: Product['size'] }): string {
  return [normalizeText(p.name), normalizeText(p.brand ?? ''), sizeKey(p.size)].join('|')
}

export function matchProduct(products: Product[], q: { barcode?: string; name: string; brand?: string; size?: Product['size'] }): Product | undefined {
  if (q.barcode) {
    const byCode = findByBarcode(products, q.barcode)
    if (byCode) return byCode
  }
  const key = identityKey(q)
  return products.find((p) => !p.barcode && identityKey(p) === key) ?? (q.barcode ? undefined : products.find((p) => identityKey(p) === key))
}

export function searchProducts(products: Product[], query: string, limit = 50): Product[] {
  const q = normalizeText(query)
  if (!q) return [...products].sort((a, b) => b.purchaseCount - a.purchaseCount || b.updatedAt - a.updatedAt).slice(0, limit)
  const digits = query.replace(/\D/g, '')
  const tokens = q.split(' ')
  const scored: { p: Product; s: number }[] = []
  for (const p of products) {
    if (digits.length >= 4 && p.barcode?.includes(digits)) {
      scored.push({ p, s: 100 })
      continue
    }
    const hay = normalizeText(`${p.name} ${p.brand ?? ''} ${p.category}`)
    if (!tokens.every((t) => hay.includes(t))) continue
    const s = (normalizeText(p.name).startsWith(q) ? 30 : 0) + Math.min(p.purchaseCount, 20) + 10
    scored.push({ p, s })
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.p)
}

export interface ProductDraft {
  barcode?: string
  name: string
  brand?: string
  category: string
  size?: Product['size']
  unit?: PriceUnit
  source: ProductSource
}

export function newProduct(d: ProductDraft, now = Date.now()): Product {
  return {
    id: uid('p-'),
    barcode: d.barcode,
    name: d.name.trim(),
    brand: d.brand?.trim() || undefined,
    category: d.category || 'geral',
    size: d.size,
    unit: d.unit ?? d.size?.unit ?? 'un',
    firstSeenAt: now,
    purchaseCount: 0,
    source: d.source,
    updatedAt: now,
  }
}

/**
 * Aplica dados vindos de fontes externas preservando as correções pessoais do usuário.
 * Campos marcados em `userEdited` nunca são sobrescritos.
 */
export function mergeExternal(existing: Product, incoming: Partial<Pick<Product, 'name' | 'brand' | 'category' | 'size'>>): Product {
  const ue = existing.userEdited ?? {}
  return {
    ...existing,
    name: ue.name ? existing.name : incoming.name || existing.name,
    brand: ue.brand ? existing.brand : incoming.brand || existing.brand,
    category: ue.category ? existing.category : incoming.category || existing.category,
    size: existing.size ?? incoming.size,
    updatedAt: Date.now(),
  }
}

/** Edição manual do usuário: marca os campos alterados como protegidos. */
export function applyUserEdit(p: Product, patch: Partial<Pick<Product, 'name' | 'brand' | 'category'>>): Product {
  const ue = { ...(p.userEdited ?? {}) }
  const next = { ...p }
  if (patch.name !== undefined && patch.name.trim() !== p.name) {
    next.name = patch.name.trim()
    ue.name = true
  }
  if (patch.brand !== undefined && (patch.brand.trim() || undefined) !== p.brand) {
    next.brand = patch.brand.trim() || undefined
    ue.brand = true
  }
  if (patch.category !== undefined && patch.category !== p.category) {
    next.category = patch.category
    ue.category = true
  }
  return { ...next, userEdited: ue, updatedAt: Date.now() }
}
